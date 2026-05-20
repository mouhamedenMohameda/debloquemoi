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
  freeHintConsume,
  walletDebit,
  walletInfo,
} from "@/lib/auth-api";
import { MIN_HINT_BALANCE_MRU } from "@/lib/pricing";
import { bestExamRef, formatChunksForPrompt, ragSearch } from "@/lib/rag";
import { validateCitations } from "@/lib/citations";
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

  // ─── 3. Free hint d'abord ; sinon vérification solde MRU ──────────────
  // Politique : à l'inscription, le user reçoit 10 hints gratuits valides 24h.
  // On les consomme en premier ; après expiration/épuisement, on bascule sur
  // le portefeuille MRU classique.
  let freeHintUsed = false;
  let freeHintsRemaining: number | undefined;
  try {
    const fh = await freeHintConsume(session.user_id);
    if (fh.consumed) {
      freeHintUsed = true;
    }
    freeHintsRemaining = fh.remaining;
  } catch (e) {
    // Hard error sur auth-api : on REFUSE plutôt que de tomber sur MRU.
    // Sinon, un user avec des free hints dispos serait débité de son MRU
    // chaque fois qu'auth-api flickerait, sans s'en rendre compte.
    if (e instanceof AuthApiError && e.status === 404) {
      return NextResponse.json(
        { error: "Compte introuvable. Reconnecte-toi." },
        { status: 401 },
      );
    }
    console.error("[hint] freeHintConsume hard error", e);
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
          { status: 402 }, // Payment Required
        );
      }
      // Seuil minimum : on refuse upfront si le solde ne couvre pas un
      // hint typique. Évite le découvert systématique sur les Solutions
      // complètes qui coûtent souvent ~0.5 MRU.
      if (w.balance_mru < MIN_HINT_BALANCE_MRU) {
        return NextResponse.json(
          {
            error: `Il te faut au moins ${MIN_HINT_BALANCE_MRU} MRU pour demander un indice. Recharge ou utilise tes corrections gratuites.`,
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

  // ─── 4. RAG : récupérer les passages les plus pertinents ─────────────
  // Best-effort : si le rag-service est down, ragSearch renvoie un résultat
  // vide marqué low_confidence=true et on continue sans contexte. Le hint
  // reste utile, mais le prompt explique au modèle qu'il doit raisonner sans
  // s'appuyer sur des extraits (Phase 1 — anti-hallucination).
  const ragQuery = [
    focusQuestion?.trim(),
    correction?.trim(),
    exercise,
  ]
    .filter(Boolean)
    .join("\n")
    .slice(0, 2000);
  const ragResult = await ragSearch({
    subject: subject.id,
    query: ragQuery,
    top_k: 5,
  });
  const { text: ragContext, included: ragChunks } = formatChunksForPrompt(
    ragResult.chunks,
  );
  const similarExam = bestExamRef(ragResult.chunks);
  const lowConfidence = ragResult.low_confidence;

  // ─── 5. Appel Groq ────────────────────────────────────────────────────
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
            content: buildExplainSystemPrompt(subject, chapter, ragContext, lowConfidence),
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
            content: buildSystemPrompt(subject, chapter, ragContext, lowConfidence),
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

  // ─── 5. Débit du portefeuille après succès Groq (sauf si free hint) ──
  const units = unitsForUsage(usage);
  let balanceAfter: number | undefined;
  let debitStatus: "ok" | "skipped" | "failed" = "skipped";
  if (!freeHintUsed && units > 0) {
    try {
      const r = await walletDebit({
        user_id: session.user_id,
        amount_units: units,
        external_ref: `hint-l${level}-${Date.now()}`,
        note: `${isExplainMode ? "explain" : "hint"} L${level} (${subject.id})`,
      });
      balanceAfter = r.balance_mru;
      debitStatus = "ok";
    } catch (e) {
      // Groq a déjà répondu : on conserve la réponse mais on signale le
      // problème pour que le client puisse afficher un avertissement.
      console.error(
        "[hint] walletDebit FAILED — user_id=%s units=%d err=%s",
        session.user_id,
        units,
        e instanceof Error ? e.message : String(e),
      );
      debitStatus = "failed";
    }
  }

  // ─── 6. Validation des citations RAG (Phase 1 anti-hallucination) ────
  // On extrait toutes les balises `[#N]` de la réponse, on vérifie qu'elles
  // pointent vers un chunk effectivement injecté, et on remonte la liste des
  // sources utilisées pour que l'UI puisse afficher un badge.
  const citationStats = validateCitations(content, ragChunks);
  if (citationStats.invalid.length > 0) {
    console.warn(
      "[hint] citations invalides — user=%s invalid=%j (modele a inventé une source ?)",
      session.user_id,
      citationStats.invalid,
    );
  }

  return NextResponse.json({
    hint: content,
    level,
    usage,
    truncated: finishReason === "length",
    mode: isExplainMode ? "explain" : "correct",
    debited_units: freeHintUsed ? 0 : units,
    balance_mru: balanceAfter,
    debit_status: debitStatus,
    // Free hint info (utile pour la maj UI côté client)
    free_hint_used: freeHintUsed,
    free_hints_remaining: freeHintsRemaining,
    // Référence d'examen similaire (null si aucun match RAG pertinent)
    similar_exam: similarExam,
    // Phase 1 — anti-hallucination
    rag: {
      low_confidence: lowConfidence,
      sources_used: citationStats.sourcesUsed,
      citations: {
        total: citationStats.raw.length,
        unique: citationStats.unique.length,
        valid: citationStats.valid.length,
        invalid: citationStats.invalid.length,
        accuracy: citationStats.accuracy,
      },
    },
  });
}
