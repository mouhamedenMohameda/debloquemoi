import { NextRequest, NextResponse } from "next/server";
import { chat } from "@/lib/groq";
import { getSubject, getChapter } from "@/lib/subjects";
import {
  buildSystemPrompt,
  buildUserPrompt,
  buildExplainSystemPrompt,
  buildExplainUserPrompt,
  type HintLevel,
} from "@/lib/prompts";

export const runtime = "nodejs";

type Body = {
  exercise: string;
  subjectId: string;
  chapterId?: string;
  level: HintLevel;
  previousHints?: string[];
  focusQuestion?: string;
  treatAll?: boolean;
  // Mode "Expliquer" : si une correction est fournie, on bascule sur le prompt d'explication.
  correction?: string;
};

export async function POST(req: NextRequest) {
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
      { error: "GROQ_API_KEY manquante. Ajoute-la dans .env.local." },
      { status: 500 },
    );
  }

  // Mode "Expliquer" : si correction non-vide, on utilise le prompt d'explication.
  const trimmedCorrection = correction?.trim();
  const isExplainMode = !!trimmedCorrection && trimmedCorrection.length >= 3;

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

    const { content, usage } = await chat(messages);
    return NextResponse.json({
      hint: content,
      level,
      usage,
      mode: isExplainMode ? "explain" : "correct",
    });
  } catch (err) {
    console.error("Groq error", err);
    const message = err instanceof Error ? err.message : "Erreur inconnue";
    return NextResponse.json({ error: `Erreur Groq: ${message}` }, { status: 500 });
  }
}
