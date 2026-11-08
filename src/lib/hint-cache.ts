/**
 * Cache des réponses IA des indices : on ne paie jamais deux fois l'IA pour
 * une réponse déjà générée.
 *
 * Clé = empreinte de tout ce qui détermine la réponse :
 *   - l'exercice : son id s'il est reconnu dans les annales (toutes les photos
 *     d'un même sujet partagent alors le cache), sinon le texte normalisé ;
 *   - le niveau, le mode (correction / explication), la question ciblée,
 *     « traiter tout », les indices précédents, la correction de l'élève ;
 *   - la matière, le chapitre, la source de vérité (vérifiée / IA) et le
 *     modèle — une correction nouvellement validée invalide donc le cache.
 *
 * Stockage : rag-service (/cache/hints/{clé}), dont le dossier de données est
 * déjà accessible en écriture et partagé par le web et le mobile. Best-effort :
 * toute erreur de cache est ignorée (journalisée) et l'on retombe sur l'appel
 * IA normal — le cache ne bloque jamais un élève.
 */
import "server-only";
import { createHash } from "node:crypto";

const BASE = process.env.RAG_SERVICE_URL ?? "http://127.0.0.1:8001";
const S2S_KEY = process.env.RAG_S2S_KEY ?? "";
const TIMEOUT_MS = 2500;

export type HintCacheKeyInput = {
  exerciseId: string | null;
  exercise: string;
  subjectId: string;
  chapterId?: string;
  level: number;
  mode: "correct" | "explain";
  focusQuestion?: string;
  treatAll?: boolean;
  previousHints?: string[];
  correction?: string;
  source: string;
  hasVerifiedCorrection: boolean;
  model: string;
};

export type CachedHint = {
  content: string;
  model: string;
  created_at: string;
  hits: number;
};

/** Normalise un texte pour que les variations sans importance (espaces, casse) partagent la clé. */
export function normalizeText(s: string | undefined | null): string {
  return (s ?? "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** Retire le bandeau de vérité (citation « > … » en tête) d'un indice précédent :
 *  il dépend du profil de l'élève (série, langue), pas de la réponse de l'IA. */
export function stripBanner(h: string): string {
  const lines = (h ?? "").split("\n");
  let i = 0;
  while (i < lines.length && (lines[i].startsWith(">") || (i > 0 && lines[i].trim() === "" && lines[i - 1].startsWith(">")))) i++;
  return i > 0 ? lines.slice(i).join("\n") : h;
}

export function hintCacheKey(k: HintCacheKeyInput): string {
  const payload = {
    // v2 : prompts « TA TÂCHE » + validation LaTeX/couverture — les réponses
    // générées avec les anciens prompts ne sont plus resservies.
    v: 2,
    ex: k.exerciseId ? `id:${k.exerciseId}` : `txt:${normalizeText(k.exercise)}`,
    subj: k.subjectId,
    chap: k.chapterId ?? "",
    lvl: k.level,
    mode: k.mode,
    focus: normalizeText(k.focusQuestion),
    all: !!k.treatAll,
    prev: (k.previousHints ?? []).map((h) => normalizeText(stripBanner(h))),
    corr: normalizeText(k.correction),
    src: k.source,
    verified: k.hasVerifiedCorrection,
    model: k.model,
  };
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}

async function call(method: "GET" | "PUT", key: string, body?: unknown): Promise<Response | null> {
  if (!S2S_KEY) return null;
  try {
    return await fetch(`${BASE}/cache/hints/${key}`, {
      method,
      headers: { "X-Api-Key": S2S_KEY, ...(body ? { "Content-Type": "application/json" } : {}) },
      body: body ? JSON.stringify(body) : undefined,
      cache: "no-store",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (e) {
    console.error("[hint-cache] rag-service injoignable", e instanceof Error ? e.message : e);
    return null;
  }
}

export async function getCachedHint(key: string): Promise<CachedHint | null> {
  const r = await call("GET", key);
  if (!r) return null;
  if (r.status === 404) return null;
  if (!r.ok) {
    console.error("[hint-cache] lecture", r.status);
    return null;
  }
  try {
    const c = (await r.json()) as CachedHint;
    return c.content ? c : null;
  } catch {
    return null;
  }
}

export async function putCachedHint(
  key: string,
  value: { content: string; model: string; usage_total: number },
): Promise<void> {
  const r = await call("PUT", key, value);
  if (r && !r.ok) console.error("[hint-cache] écriture", r.status, await r.text().catch(() => ""));
}
