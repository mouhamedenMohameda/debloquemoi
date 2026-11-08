import { NextRequest, NextResponse } from "next/server";

import { unitsForUsage } from "@/lib/billing";
import { chat, DEFAULT_MODEL } from "@/lib/groq";
import { getCachedHint, hintCacheKey, putCachedHint } from "@/lib/hint-cache";
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
  me,
  walletDebit,
  walletInfo,
} from "@/lib/auth-api";
import { MIN_HINT_BALANCE_MRU } from "@/lib/pricing";
import { getChapter, getSubject } from "@/lib/subjects";
import { getJwt, getSession } from "@/lib/session";
import { analyzeExercise, type AnalyzeResult } from "@/lib/catalog";
import { newtonValidateExercise } from "@/lib/newton";

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

  // ─── 2b. Ce que l'on sait VRAIMENT de cet exercice (gratuit, sans IA) ─
  // Règle : toujours aider, ne jamais mentir.
  //   - sujet du bac reconnu + correction validée → on s'appuie dessus (et la
  //     solution complète EST la correction validée : pas d'IA, pas de débit) ;
  //   - chapitre publié → aide IA signalée comme telle + vraies années ;
  //   - sinon → aide IA « non vérifiée », sans aucune référence au bac.
  const jwt = await getJwt();
  let filiere: string | null = null;
  try {
    filiere = jwt ? ((await me(jwt)).user.bac_filiere ?? null) : null;
  } catch (e) {
    console.error("[hint] me() pour la série", e);
  }
  let analysis: AnalyzeResult | null = null;
  if (filiere) {
    try {
      analysis = await analyzeExercise(filiere, `${exercise}\n${correction ?? ""}`.slice(0, 20000));
    } catch (e) {
      console.error("[hint] analyse indisponible — réponse IA non vérifiée", e);
    }
  }
  const publishedChapter =
    analysis && (analysis.status === "matched" || analysis.status === "detected") ? analysis : null;
  const knownExercise = analysis?.status === "matched" ? analysis.exercise ?? null : null;
  const verifiedCorrection = knownExercise?.correction ?? null;
  const examRef = knownExercise
    ? `Bac ${filiere} ${knownExercise.annee} · session ${/compl/i.test(knownExercise.session) ? "complémentaire" : "normale"} · Exercice ${knownExercise.exercice_numero}`
    : null;
  const source: "verified" | "ai_verified_chapter" | "ai" = verifiedCorrection
    ? "verified"
    : publishedChapter
      ? "ai_verified_chapter"
      : "ai";
  const isExplain = !!correction?.trim() && correction.trim().length >= 3;

  const banner = (() => {
    if (source === "verified") {
      return `> ✅ **Sujet du bac reconnu : ${examRef}.** Cette aide s'appuie sur la correction vérifiée par un professeur.\n\n`;
    }
    const lines: string[] = [];
    if (examRef) {
      lines.push(`✅ **Sujet du bac reconnu : ${examRef}.** Sa correction vérifiée n'est pas encore disponible.`);
    }
    lines.push("⚠️ **Réponse générée par l'IA, non vérifiée par un professeur.**");
    if (publishedChapter) {
      const years = (publishedChapter.notions ?? [])
        .filter((n) => n.years.length > 0)
        .slice(0, 3)
        .map((n) => `${n.label} (${n.years.join(", ")})`);
      if (years.length) {
        lines.push(`Au bac (série ${filiere}), ces notions sont tombées : ${years.join(" · ")}. Retrouve-les dans « Mes annales ».`);
      }
    } else if (analysis?.status === "not_published" && analysis.chapitre) {
      lines.push(`Les annales vérifiées du chapitre « ${analysis.chapitre} » ne sont pas encore disponibles pour la série ${filiere}.`);
    } else if (!filiere) {
      lines.push("Choisis ta série dans « Mes annales » pour retrouver les sujets du bac vérifiés.");
    }
    return lines.map((l) => `> ${l}`).join("\n>\n") + "\n\n";
  })();

  const emptyRag = {
    low_confidence: false,
    sources_used: [] as string[],
    citations: { total: 0, unique: 0, valid: 0, invalid: 0, accuracy: 1 },
  };

  // Solution complète demandée pour un sujet dont on a la correction validée :
  // on donne la vérité, sans appel IA et sans débit.
  if (!isExplain && level === 3 && !focusQuestion?.trim() && verifiedCorrection) {
    return NextResponse.json({
      hint: banner + verifiedCorrection,
      level,
      usage: { prompt: 0, completion: 0, total: 0, model: "verified" },
      truncated: false,
      mode: "correct",
      debited_units: 0,
      debit_status: "skipped",
      free_hint_used: false,
      similar_exam: examRef,
      source,
      chapitre: publishedChapter?.chapitre ?? null,
      rag: emptyRag,
    });
  }

  // ─── 2c. Cache : réponse IA déjà générée pour la même demande ─────────
  // On ne repaie jamais l'IA pour une réponse qu'on a déjà : servie gratuitement,
  // sans consommer d'indice gratuit. Le bandeau de vérité est recalculé à chaque
  // fois (il n'est pas dans le cache).
  const cacheKey = hintCacheKey({
    exerciseId: knownExercise?.id ?? null,
    exercise,
    subjectId: subject.id,
    chapterId: chapter?.id,
    level,
    mode: isExplain ? "explain" : "correct",
    focusQuestion,
    treatAll,
    previousHints,
    correction: isExplain ? correction : undefined,
    source,
    hasVerifiedCorrection: !!verifiedCorrection,
    model: DEFAULT_MODEL,
  });
  const cached = await getCachedHint(cacheKey);
  if (cached) {
    return NextResponse.json({
      hint: banner + cached.content,
      level,
      usage: { prompt: 0, completion: 0, total: 0, model: "cache" },
      truncated: false,
      mode: isExplain ? "explain" : "correct",
      debited_units: 0,
      debit_status: "skipped",
      free_hint_used: false,
      cached: true,
      similar_exam: examRef,
      source,
      chapitre: publishedChapter?.chapitre ?? null,
      rag: emptyRag,
    });
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

  // ─── 4. Contexte : UNIQUEMENT du contenu vérifié ─────────────────────
  // Plus d'extraits de corrigés non vérifiés : ils pouvaient faire citer à
  // l'IA des sujets ou des années non contrôlés.
  const ragContext = verifiedCorrection
    ? [
        `=== CORRECTION VÉRIFIÉE (${examRef}) ===`,
        "C'est la correction validée par un professeur pour CET exercice.",
        "Appuie-toi dessus et ne la contredis jamais.",
        "",
        verifiedCorrection,
        "",
      ].join("\n")
    : "";
  const lowConfidence = false;
  const honestyRule =
    source === "verified"
      ? `\n\nRÈGLE D'HONNÊTETÉ : la seule référence au bac que tu peux citer est « ${examRef} ».`
      : "\n\nRÈGLE D'HONNÊTETÉ : ne cite AUCUN sujet du bac (année, série, numéro d'exercice), n'affirme jamais qu'un exercice ou une méthode « est tombé au bac » et n'invente aucune source.";

  // ─── 5. Appel Groq ────────────────────────────────────────────────────
  const trimmedCorrection = correction?.trim();
  const isExplainMode = isExplain;

  // ─── 4b. Newton — validation expression math (best-effort) ───────────
  // Pour les exercices de maths, on tente de simplifier une expression LaTeX
  // extraite de l'énoncé. Le résultat est concaténé au contexte RAG pour
  // ancrer les calculs de Groq. Entièrement non-bloquant.
  let ragContextFinal = ragContext;
  if (subject.id === "math" && !isExplainMode) {
    const newtonCheck = await newtonValidateExercise(exercise);
    if (newtonCheck.valid && newtonCheck.expression && newtonCheck.result) {
      ragContextFinal +=
        `\n\n[Calcul Newton vérifié] simplify(${newtonCheck.expression}) = ${newtonCheck.result}`;
    }
  }

  let content: string;
  let usage;
  let finishReason: string | undefined;
  try {
    const messages = isExplainMode
      ? [
          {
            role: "system" as const,
            content: buildExplainSystemPrompt(subject, chapter, ragContextFinal, lowConfidence) + honestyRule,
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
            content: buildSystemPrompt(subject, chapter, ragContextFinal, lowConfidence) + honestyRule,
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

  // Réponse complète uniquement (une réponse tronquée serait resservie tronquée).
  if (finishReason !== "length" && content.trim()) {
    await putCachedHint(cacheKey, { content, model: DEFAULT_MODEL, usage_total: usage?.total ?? 0 });
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

  return NextResponse.json({
    hint: banner + content,
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
    // Référence de bac : seulement un sujet reconnu dans les annales vérifiées
    similar_exam: examRef,
    // verified | ai_verified_chapter | ai — l'UI peut l'afficher
    source,
    chapitre: publishedChapter?.chapitre ?? null,
    rag: emptyRag,
  });
}
