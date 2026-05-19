/**
 * Client TypeScript pour rag-service.
 *
 * Server-only : utilise une clé S2S secrète. Ne JAMAIS importer ce module
 * dans un composant client.
 */

import "server-only";

const BASE = process.env.RAG_SERVICE_URL ?? "http://127.0.0.1:8001";
const S2S_KEY = process.env.RAG_S2S_KEY ?? "";

export type RagChunk = {
  text: string;
  source: string;
  page: number;
  score: number;
};

export type RagSearchResult = {
  chunks: RagChunk[];
  subject: string;
  query: string;
};

/**
 * Cherche les passages les plus pertinents dans le corpus indexé. Renvoie une
 * liste vide en cas d'erreur (le RAG est une amélioration : si le service est
 * down, on doit pouvoir continuer à servir des hints sans contexte).
 */
export async function ragSearch(input: {
  subject: string;
  query: string;
  top_k?: number;
}): Promise<RagChunk[]> {
  if (!S2S_KEY) return []; // pas configuré → RAG désactivé silencieusement
  try {
    const ctrl = new AbortController();
    const timeout = setTimeout(() => ctrl.abort(), 4000);
    const res = await fetch(`${BASE}/search`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Api-Key": S2S_KEY,
      },
      body: JSON.stringify({
        subject: input.subject,
        query: input.query,
        top_k: input.top_k ?? 5,
      }),
      cache: "no-store",
      signal: ctrl.signal,
    });
    clearTimeout(timeout);
    if (!res.ok) {
      console.warn("[rag] /search non OK", res.status);
      return [];
    }
    const data = (await res.json()) as RagSearchResult;
    return data.chunks ?? [];
  } catch (e) {
    console.warn("[rag] /search error", e);
    return [];
  }
}

/**
 * Formate les chunks récupérés en bloc texte à injecter dans le system prompt.
 * Limite la longueur totale pour ne pas exploser le contexte (les chunks Chroma
 * peuvent être longs ; on tronque à ~6000 caractères au total).
 */
export function formatChunksForPrompt(chunks: RagChunk[], maxChars = 6000): string {
  if (chunks.length === 0) return "";
  const parts: string[] = [];
  let total = 0;
  for (const c of chunks) {
    const header = `[Source : ${c.source} p.${c.page}]`;
    const body = c.text.trim();
    const piece = `${header}\n${body}`;
    if (total + piece.length > maxChars) {
      const remaining = maxChars - total;
      if (remaining > 200) parts.push(piece.slice(0, remaining) + "…");
      break;
    }
    parts.push(piece);
    total += piece.length;
  }
  return parts.join("\n\n---\n\n");
}
