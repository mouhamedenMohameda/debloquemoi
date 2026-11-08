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
 * Stockage : un fichier JSON par clé dans HINT_CACHE_DIR (défaut
 * `<cwd>/.cache/hints`), écriture atomique. Best-effort : toute erreur de
 * cache est ignorée et l'on retombe sur l'appel IA normal.
 */
import { createHash } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

const TTL_MS = 180 * 24 * 3600 * 1000; // 6 mois

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
  usage_total: number;
};

function cacheDir(): string {
  return process.env.HINT_CACHE_DIR || path.join(process.cwd(), ".cache", "hints");
}

/** Normalise un texte pour que les variations sans importance (espaces, casse) partagent la clé. */
export function normalizeText(s: string | undefined | null): string {
  return (s ?? "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
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
    prev: (k.previousHints ?? []).map(normalizeText),
    corr: normalizeText(k.correction),
    src: k.source,
    verified: k.hasVerifiedCorrection,
    model: k.model,
  };
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}

function fileFor(key: string): string {
  return path.join(cacheDir(), key.slice(0, 2), `${key}.json`);
}

export async function getCachedHint(key: string): Promise<CachedHint | null> {
  try {
    const raw = await readFile(fileFor(key), "utf8");
    const c = JSON.parse(raw) as CachedHint;
    if (!c.content || Date.now() - Date.parse(c.created_at) > TTL_MS) return null;
    return c;
  } catch {
    return null;
  }
}

export async function putCachedHint(key: string, value: Omit<CachedHint, "created_at">): Promise<void> {
  try {
    const file = fileFor(key);
    await mkdir(path.dirname(file), { recursive: true });
    const tmp = `${file}.${process.pid}.${Date.now()}.tmp`;
    await writeFile(tmp, JSON.stringify({ ...value, created_at: new Date().toISOString() }), "utf8");
    await rename(tmp, file);
  } catch (e) {
    console.error("[hint-cache] écriture impossible", e);
  }
}
