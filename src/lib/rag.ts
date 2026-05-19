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

/**
 * Extrait un label « Bac C/D AAAA » d'un nom de fichier de corrigé.
 * Retourne null si le fichier ne suit pas une convention reconnue.
 *
 *   "BacC2020sn corr.pdf"                → "Bac C 2020"
 *   "Bac C 2002 a 2012 sn et sc corr"   → "Bac C 2002-2012"
 *   "Bac_C_science_2022_SC.pdf"          → "Bac C 2022"
 *   "Bac PC 2021 corrigé sn.pdf"         → "Bac C 2021" (PC implique série C)
 *   "BAC D MA 2019 sn corrigé.pdf"       → "Bac D 2019"
 *   "Bac D SN 2000 a 2010 corrigé"       → "Bac D 2000-2010"
 *
 * On omet volontairement le suffixe matière (SN/SC/PC) car « sn » dans un
 * nom de fichier désigne souvent la « session normale » d'examen et non la
 * matière « Sciences Naturelles ». Le contexte (la question est posée en
 * math, physique, etc.) suffit déjà à indiquer la matière.
 */
export function parseExamRef(filename: string): string | null {
  // Normalise les underscores en espaces, tolère majuscules.
  const f = filename.toLowerCase().replace(/_/g, " ");

  // Détecte la série (C, D). « Bac PC/MA/SN/SC » sans C/D explicite → C
  // par convention (la majorité du corpus Bac C Mauritanie suit ce schéma).
  let series: "C" | "D" | null = null;
  if (f.includes("bac c") || /bacc\d/.test(f)) series = "C";
  else if (f.includes("bac d")) series = "D";
  else if (/\bbac\s+(pc|ma|sn|sc)\b/.test(f)) series = "C";
  if (!series) return null;

  const rangeMatch = /(\d{4})\s*(?:a|à|-)\s*(\d{4})/i.exec(filename);
  const singleMatch = /(?<!\d)(\d{4})(?!\d)/.exec(filename);

  let yearLabel: string | null = null;
  if (rangeMatch) yearLabel = `${rangeMatch[1]}-${rangeMatch[2]}`;
  else if (singleMatch) yearLabel = singleMatch[1];
  if (!yearLabel) return null;

  return `Bac ${series} ${yearLabel}`;
}

/**
 * À partir d'une liste de chunks (triés par pertinence décroissante), renvoie
 * la référence d'examen la plus pertinente (premier chunk au-dessus du seuil
 * de score) ou null si aucun n'est suffisamment proche.
 */
export function bestExamRef(chunks: RagChunk[], minScore = 0.5): string | null {
  for (const c of chunks) {
    if (c.score < minScore) continue;
    const ref = parseExamRef(c.source);
    if (ref) return ref;
  }
  return null;
}
