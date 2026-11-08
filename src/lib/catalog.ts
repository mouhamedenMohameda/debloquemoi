/**
 * Client serveur du catalogue élève (rag-service /catalog/*).
 *
 * Server-only : utilise la clé S2S. Seul le contenu des chapitres PUBLIÉS est
 * renvoyé par le rag-service ; un chapitre en brouillon répond
 * « Pas encore disponible ».
 */
import "server-only";

const BASE = process.env.RAG_SERVICE_URL ?? "http://127.0.0.1:8001";
const S2S_KEY = process.env.RAG_S2S_KEY ?? "";

export type AnalyzeOccurrence = {
  id: string;
  annee: number;
  session: string;
  exercice_numero: string | number;
  chapitre: string;
  enonce: string;
  correction: string | null;
};

export type AnalyzeNotion = {
  notion_id: string;
  label: string;
  lesson: string | null;
  years: number[];
  occurrences: AnalyzeOccurrence[];
};

export type AnalyzeResult = {
  status: "matched" | "detected" | "not_published" | "unknown";
  filiere_id: string;
  best_score: number;
  matiere_id?: string;
  chapitre?: string | null;
  message?: string;
  exercise?: {
    id: string;
    annee: number;
    session: string;
    exercice_numero: string | number;
    score: number;
    enonce: string;
    correction: string | null;
  } | null;
  notions?: AnalyzeNotion[];
  other_notions?: { notion_id: string; label: string }[];
};

export class CatalogError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export async function analyzeExercise(filiere: string, text: string): Promise<AnalyzeResult> {
  if (!S2S_KEY) throw new CatalogError(500, "RAG_S2S_KEY non configurée côté Next.js.");
  const res = await fetch(`${BASE}/catalog/analyze`, {
    method: "POST",
    headers: { "X-Api-Key": S2S_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ filiere, text }),
    cache: "no-store",
  });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new CatalogError(res.status, t || res.statusText);
  }
  return (await res.json()) as AnalyzeResult;
}
