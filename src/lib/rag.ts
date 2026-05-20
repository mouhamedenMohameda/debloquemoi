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
  low_confidence: boolean;
  min_score_threshold: number;
};

/**
 * Résultat sain renvoyé même en cas d'erreur réseau / service down. Permet aux
 * callers d'avoir un type stable sans null-checks partout.
 */
const EMPTY_RESULT: RagSearchResult = {
  chunks: [],
  subject: "",
  query: "",
  low_confidence: true,
  min_score_threshold: 0.55,
};

/**
 * Cherche les passages les plus pertinents dans le corpus indexé. Renvoie un
 * résultat vide (low_confidence=true) en cas d'erreur — le RAG est une
 * amélioration : si le service est down, on continue sans contexte mais en
 * signalant à l'appelant que la confiance est faible.
 */
export async function ragSearch(input: {
  subject: string;
  query: string;
  top_k?: number;
}): Promise<RagSearchResult> {
  if (!S2S_KEY) return EMPTY_RESULT; // pas configuré → RAG désactivé silencieusement
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
      return { ...EMPTY_RESULT, subject: input.subject, query: input.query };
    }
    const data = (await res.json()) as RagSearchResult;
    return {
      chunks: data.chunks ?? [],
      subject: data.subject ?? input.subject,
      query: data.query ?? input.query,
      low_confidence: data.low_confidence ?? true,
      min_score_threshold: data.min_score_threshold ?? 0.55,
    };
  } catch (e) {
    console.warn("[rag] /search error", e);
    return { ...EMPTY_RESULT, subject: input.subject, query: input.query };
  }
}

/**
 * Formate les chunks récupérés en bloc texte à injecter dans le system prompt.
 *
 * Chaque chunk est numéroté `[#1]`, `[#2]`… pour permettre au modèle de citer
 * précisément une source (Phase 1 — anti-hallucination). Limite la longueur
 * totale à ~6000 caractères pour ne pas exploser le contexte.
 *
 * Retourne aussi `included` : la liste des chunks effectivement inclus (après
 * éventuelle troncature), pour que le caller puisse valider les citations.
 */
export function formatChunksForPrompt(
  chunks: RagChunk[],
  maxChars = 6000,
): { text: string; included: RagChunk[] } {
  if (chunks.length === 0) return { text: "", included: [] };
  const parts: string[] = [];
  const included: RagChunk[] = [];
  let total = 0;
  for (let i = 0; i < chunks.length; i++) {
    const c = chunks[i];
    const tag = `[#${i + 1}]`;
    const header = `${tag} [Source : ${c.source} p.${c.page}]`;
    const body = c.text.trim();
    const piece = `${header}\n${body}`;
    if (total + piece.length > maxChars) {
      const remaining = maxChars - total;
      if (remaining > 200) {
        parts.push(piece.slice(0, remaining) + "…");
        included.push(c);
      }
      break;
    }
    parts.push(piece);
    included.push(c);
    total += piece.length;
  }
  return { text: parts.join("\n\n---\n\n"), included };
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
 * Cherche une année spécifique (YYYY entre minYear et maxYear) dans le texte
 * d'un chunk extrait d'une compilation. Utile quand le filename donne une
 * plage (« Bac C 2002 a 2012 ») et qu'on veut savoir à quelle année précise
 * appartient ce passage.
 *
 * Heuristique : on cherche d'abord des marqueurs forts (IPN/Mr/YYYY,
 * « Baccalauréat YYYY », « session YYYY »), puis on fallback à la première
 * année rencontrée dans la plage.
 */
function extractYearFromChunkText(
  text: string,
  minYear: number,
  maxYear: number,
): number | null {
  const tryYear = (y: number): boolean => y >= minYear && y <= maxYear;

  // Marqueur fort 1 : « IPN ... /YYYY » (en-tête typique des compilations)
  const ipnMatch = text.match(/IPN[\s\S]{0,60}\b(20\d{2})\b/i);
  if (ipnMatch) {
    const y = parseInt(ipnMatch[1], 10);
    if (tryYear(y)) return y;
  }
  // Marqueur fort 2 : « Bac C/D YYYY » ou « Baccalauréat ... YYYY »
  const bacMatch = text.match(/(?:bac(?:calaur[ée]at)?)\s*[cd]?\s*(?:\d{4}\s*-\s*)?(20\d{2})\b/i);
  if (bacMatch) {
    const y = parseInt(bacMatch[1], 10);
    if (tryYear(y)) return y;
  }
  // Marqueur 3 : « session YYYY » ou « année YYYY »
  const sessionMatch = text.match(/(?:session|année)\s+(?:normale\s+|compl[ée]mentaire\s+)?(20\d{2})\b/i);
  if (sessionMatch) {
    const y = parseInt(sessionMatch[1], 10);
    if (tryYear(y)) return y;
  }
  // Fallback : première année 20XX présente dans le texte qui tombe dans la
  // plage. Évite de matcher des bornes d'intégrale, exposants etc.
  const allYears = text.match(/\b(20\d{2})\b/g);
  if (allYears) {
    for (const ys of allYears) {
      const y = parseInt(ys, 10);
      if (tryYear(y)) return y;
    }
  }
  return null;
}

/**
 * À partir d'une liste de chunks (triés par pertinence décroissante), renvoie
 * la référence d'examen la plus pertinente AVEC ANNÉE EXACTE.
 *
 * - Si le chunk top vient d'un PDF d'année individuelle → retourne directement.
 * - Si le chunk vient d'une compilation (plage AAAA-BBBB) → on tente
 *   d'extraire l'année précise depuis le texte. Si trouvée, on retourne.
 *   Si pas trouvée, on passe au chunk suivant.
 * - Si aucun chunk top ne donne d'année exacte → renvoie null (pas de badge),
 *   plutôt qu'une plage vague qui n'apporte rien à l'utilisateur.
 */
export function bestExamRef(chunks: RagChunk[], minScore = 0.5): string | null {
  for (const c of chunks) {
    if (c.score < minScore) continue;
    const baseRef = parseExamRef(c.source);
    if (!baseRef) continue;
    const rangeMatch = /^Bac ([CD]) (\d{4})-(\d{4})$/.exec(baseRef);
    if (rangeMatch) {
      const series = rangeMatch[1];
      const minYear = parseInt(rangeMatch[2], 10);
      const maxYear = parseInt(rangeMatch[3], 10);
      const specific = extractYearFromChunkText(c.text, minYear, maxYear);
      if (specific !== null) return `Bac ${series} ${specific}`;
      // Plage sans année extractible → on saute, peut-être qu'un chunk suivant
      // (potentiellement issu d'un PDF d'année individuelle) sera meilleur.
      continue;
    }
    return baseRef;
  }
  return null;
}
