import { NextRequest, NextResponse } from "next/server";

import { mruToUnits } from "@/lib/billing";
import { extractTextFromImage } from "@/lib/groq";
import {
  AuthApiError,
  freeHintConsume,
  walletDebit,
  walletInfo,
} from "@/lib/auth-api";
import { OCR_FLAT_COST_MRU } from "@/lib/pricing";
import { getSession } from "@/lib/session";

const OCR_FLAT_COST_UNITS = mruToUnits(OCR_FLAT_COST_MRU);

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
    }
    freeHintsRemaining = fh.remaining;
  } catch (e) {
    if (e instanceof AuthApiError && e.status === 404) {
      return NextResponse.json(
        { error: "Compte introuvable. Reconnecte-toi." },
        { status: 401 },
      );
    }
    console.error("[ocr] freeHintConsume hard error", e);
    return NextResponse.json(
      {
        error:
          "Service temporairement indisponible. Réessaie dans quelques instants.",
      },
      { status: 503 },
    );
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
      // Tarif forfaitaire : 1 MRU par photo. Refuse upfront si solde < 1 MRU.
      if (w.balance_mru < OCR_FLAT_COST_MRU) {
        return NextResponse.json(
          {
            error: `Il te faut au moins ${OCR_FLAT_COST_MRU} MRU pour extraire une photo. Recharge ton portefeuille.`,
            blocked: true,
            balance_mru: w.balance_mru,
          },
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

  // ─── 5. Débit forfaitaire 1 MRU (sauf si free hint) ───────────────────
  const units = OCR_FLAT_COST_UNITS;
  let balanceAfter: number | undefined;
  let debitStatus: "ok" | "skipped" | "failed" = "skipped";
  if (!freeHintUsed) {
    try {
      const r = await walletDebit({
        user_id: session.user_id,
        amount_units: units,
        external_ref: `ocr-${Date.now()}`,
        note: "OCR énoncé (forfait)",
      });
      balanceAfter = r.balance_mru;
      debitStatus = "ok";
    } catch (e) {
      console.error(
        "[ocr] walletDebit FAILED — user_id=%s units=%d err=%s",
        session.user_id,
        units,
        e instanceof Error ? e.message : String(e),
      );
      debitStatus = "failed";
    }
  }

  return NextResponse.json({
    text,
    usage,
    debited_units: freeHintUsed ? 0 : units,
    balance_mru: balanceAfter,
    debit_status: debitStatus,
    free_hint_used: freeHintUsed,
    free_hints_remaining: freeHintsRemaining,
  });
}
