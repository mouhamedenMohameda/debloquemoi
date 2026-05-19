import { NextRequest, NextResponse } from "next/server";

import { unitsForUsage } from "@/lib/billing";
import { extractTextFromImage } from "@/lib/groq";
import {
  AuthApiError,
  freeHintConsume,
  walletDebit,
  walletInfo,
} from "@/lib/auth-api";
import { getSession } from "@/lib/session";

export const runtime = "nodejs";
export const maxDuration = 30;

type Body = { imageDataUrl: string };

export async function POST(req: NextRequest) {
  // ─── 1. Auth obligatoire ───────────────────────────────────────────────
  const session = await getSession();
  if (!session) {
    return NextResponse.json(
      { error: "Connecte-toi pour utiliser l'OCR." },
      { status: 401 },
    );
  }

  if (!process.env.GROQ_API_KEY) {
    return NextResponse.json({ error: "GROQ_API_KEY manquante." }, { status: 500 });
  }

  // ─── 2. Parse body ─────────────────────────────────────────────────────
  let body: Body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 });
  }
  const { imageDataUrl } = body;
  if (!imageDataUrl?.startsWith("data:image/")) {
    return NextResponse.json(
      { error: "Image attendue (data URL)." },
      { status: 400 },
    );
  }
  // Limite ~6 MB de payload après base64 (Groq accepte jusqu'à ~20 MB mais on évite les abus)
  if (imageDataUrl.length > 8_000_000) {
    return NextResponse.json(
      { error: "Image trop lourde (>6 MB). Réduis la résolution." },
      { status: 413 },
    );
  }

  // ─── 3. Free hint d'abord ; sinon vérification solde MRU ──────────────
  let freeHintUsed = false;
  let freeHintsRemaining: number | undefined;
  try {
    const fh = await freeHintConsume(session.user_id);
    if (fh.consumed) {
      freeHintUsed = true;
      freeHintsRemaining = fh.remaining;
    }
  } catch (e) {
    if (!(e instanceof AuthApiError)) {
      console.warn("freeHintConsume failed, falling back to MRU", e);
    }
  }

  if (!freeHintUsed) {
    try {
      const w = await walletInfo(session.user_id);
      if (w.blocked_reason) {
        return NextResponse.json(
          { error: w.blocked_reason, blocked: true, balance_mru: w.balance_mru },
          { status: 402 },
        );
      }
    } catch (e) {
      if (e instanceof AuthApiError && e.status === 404) {
        return NextResponse.json(
          { error: "Compte introuvable. Reconnecte-toi." },
          { status: 401 },
        );
      }
      console.error("walletInfo error", e);
      return NextResponse.json(
        { error: "Erreur de vérification du portefeuille." },
        { status: 502 },
      );
    }
  }

  // ─── 4. Appel Groq Vision ─────────────────────────────────────────────
  let text: string;
  let usage;
  try {
    const r = await extractTextFromImage(imageDataUrl);
    text = r.text;
    usage = r.usage;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erreur inconnue";
    return NextResponse.json({ error: `Erreur Groq: ${message}` }, { status: 500 });
  }

  if (text === "IMAGE_INVALIDE" || text.length < 5) {
    // On ne débite pas l'utilisateur si l'image est inutilisable.
    return NextResponse.json(
      { error: "Énoncé illisible. Reprends la photo, bien cadrée et nette.", usage },
      { status: 422 },
    );
  }

  // ─── 5. Débit du portefeuille après succès Groq (sauf si free hint) ──
  const units = unitsForUsage(usage);
  let balanceAfter: number | undefined;
  if (!freeHintUsed && units > 0) {
    try {
      const r = await walletDebit({
        user_id: session.user_id,
        amount_units: units,
        external_ref: `ocr-${Date.now()}`,
        note: "OCR énoncé",
      });
      balanceAfter = r.balance_mru;
    } catch (e) {
      console.error("walletDebit error", e);
      // On NE renvoie pas d'erreur — la réponse Groq est déjà produite.
    }
  }

  return NextResponse.json({
    text,
    usage,
    debited_units: freeHintUsed ? 0 : units,
    balance_mru: balanceAfter,
    free_hint_used: freeHintUsed,
    free_hints_remaining: freeHintsRemaining,
  });
}
