import { NextRequest, NextResponse } from "next/server";

import { unitsForUsage } from "@/lib/billing";
import { chat } from "@/lib/groq";
import {
  buildExplainSystemPrompt,
  buildExplainUserPrompt,
  buildSystemPrompt,
  buildUserPrompt,
  type HintLevel,
} from "@/lib/prompts";
import {
  AuthApiError,
  walletDebit,
  walletInfo,
} from "@/lib/auth-api";
import { getChapter, getSubject } from "@/lib/subjects";
import { getSession } from "@/lib/session";

export const runtime = "nodejs";

type Body = {
  exercise: string;
  subjectId: string;
  chapterId?: string;
  level: HintLevel;
  previousHints?: string[];
  focusQuestion?: string;
  treatAll?: boolean;
  correction?: string;
};

export async function POST(req: NextRequest) {
  // ─── 1. Auth obligatoire ───────────────────────────────────────────────
  const session = await getSession();
  if (!session) {
    return NextResponse.json(
      { error: "Connecte-toi pour utiliser Débloque-moi." },
      { status: 401 },
    );
  }

  // ─── 2. Parse body ─────────────────────────────────────────────────────
  let body: Body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 });
  }

  const {
    exercise,
    subjectId,
    chapterId,
    level,
    previousHints = [],
    focusQuestion,
    treatAll = false,
    correction,
  } = body;

  if (!exercise || exercise.trim().length < 3) {
    return NextResponse.json(
      { error: "Merci de saisir un énoncé d'exercice." },
      { status: 400 },
    );
  }
  if (![1, 2, 3].includes(level)) {
    return NextResponse.json({ error: "Niveau d'indice invalide." }, { status: 400 });
  }

  const subject = getSubject(subjectId);
  if (!subject) {
    return NextResponse.json({ error: "Matière inconnue." }, { status: 400 });
  }
  const chapter = chapterId ? getChapter(subjectId, chapterId) : undefined;

  if (!process.env.GROQ_API_KEY) {
    return NextResponse.json(
      { error: "GROQ_API_KEY manquante (config serveur)." },
      { status: 500 },
    );
  }

  // ─── 3. Vérification solde avant l'appel coûteux ──────────────────────
  try {
    const w = await walletInfo(session.user_id);
    if (w.blocked_reason) {
      return NextResponse.json(
        { error: w.blocked_reason, blocked: true, balance_mru: w.balance_mru },
        { status: 402 }, // Payment Required
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

  // ─── 4. Appel Groq ────────────────────────────────────────────────────
  const trimmedCorrection = correction?.trim();
  const isExplainMode = !!trimmedCorrection && trimmedCorrection.length >= 3;

  let content: string;
  let usage;
  let finishReason: string | undefined;
  try {
    const messages = isExplainMode
      ? [
          {
            role: "system" as const,
            content: buildExplainSystemPrompt(subject, chapter),
          },
          {
            role: "user" as const,
            content: buildExplainUserPrompt(
              exercise,
              trimmedCorrection!,
              focusQuestion,
            ),
          },
        ]
      : [
          {
            role: "system" as const,
            content: buildSystemPrompt(subject, chapter),
          },
          {
            role: "user" as const,
            content: buildUserPrompt(
              exercise,
              level,
              previousHints,
              focusQuestion,
              treatAll,
            ),
          },
        ];

    const r = await chat(messages);
    content = r.content;
    usage = r.usage;
    finishReason = r.finishReason;
  } catch (err) {
    console.error("Groq error", err);
    const message = err instanceof Error ? err.message : "Erreur inconnue";
    return NextResponse.json({ error: `Erreur Groq: ${message}` }, { status: 500 });
  }

  // ─── 5. Débit du portefeuille après succès Groq ───────────────────────
  const units = unitsForUsage(usage);
  let balanceAfter: number | undefined;
  if (units > 0) {
    try {
      const r = await walletDebit({
        user_id: session.user_id,
        amount_units: units,
        external_ref: `hint-l${level}-${Date.now()}`,
        note: `${isExplainMode ? "explain" : "hint"} L${level} (${subject.id})`,
      });
      balanceAfter = r.balance_mru;
    } catch (e) {
      console.error("walletDebit error", e);
      // On NE renvoie pas d'erreur au user — la réponse Groq est déjà produite.
      // Le débit échoué est juste loggé. (Anti-fraude : voir auth-api.)
    }
  }

  return NextResponse.json({
    hint: content,
    level,
    usage,
    truncated: finishReason === "length",
    mode: isExplainMode ? "explain" : "correct",
    debited_units: units,
    balance_mru: balanceAfter,
  });
}
