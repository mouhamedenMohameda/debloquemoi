/**
 * Module de validation des citations RAG (Phase 1 — anti-hallucination).
 *
 * Le system prompt force le modèle à citer `[#N]` après chaque rappel
 * théorique tiré d'un extrait du corpus. Ce module :
 *  1. extrait toutes les références `[#N]` de la réponse,
 *  2. les valide contre la liste des chunks effectivement fournis,
 *  3. produit un récap (sources utilisées, citations invalides éventuelles).
 *
 * **Pourquoi côté Node et pas dans le prompt** : un prompt peut être ignoré
 * par le modèle. Une validation programmatique garantit qu'on saura toujours
 * a posteriori si la réponse est "groundée" ou pas. Ces métriques alimentent
 * eval.py et l'UI (badge sources).
 */
import type { RagChunk } from "./rag";

const CITATION_RE = /\[#(\d+)\]/g;

export type CitationStats = {
  /** Tous les `[#N]` rencontrés dans le texte (ordre d'apparition, doublons inclus). */
  raw: number[];
  /** `[#N]` distincts dans le texte. */
  unique: number[];
  /** `[#N]` valides : 1 ≤ N ≤ chunks.length. */
  valid: number[];
  /** `[#N]` invalides : N hors plage (le modèle a halluciné une source). */
  invalid: number[];
  /** Chunks effectivement cités (typiquement injectés dans la réponse client). */
  sourcesUsed: Array<{ n: number; source: string; page: number; score: number }>;
  /**
   * Citation accuracy = valid / unique. 1.0 = parfait, 0 = aucune citation
   * valide trouvée. Vaut 1.0 par convention si aucune citation (cas légitime
   * où le modèle s'est appuyé sur le cours général, low_confidence).
   */
  accuracy: number;
};

export function extractCitations(text: string): number[] {
  const out: number[] = [];
  for (const m of text.matchAll(CITATION_RE)) {
    const n = parseInt(m[1], 10);
    if (Number.isFinite(n)) out.push(n);
  }
  return out;
}

export function validateCitations(text: string, chunks: RagChunk[]): CitationStats {
  const raw = extractCitations(text);
  const unique = Array.from(new Set(raw));
  const valid = unique.filter((n) => n >= 1 && n <= chunks.length);
  const invalid = unique.filter((n) => n < 1 || n > chunks.length);

  const sourcesUsed = valid
    .map((n) => {
      const c = chunks[n - 1];
      return { n, source: c.source, page: c.page, score: c.score };
    });

  const accuracy = unique.length === 0 ? 1.0 : valid.length / unique.length;

  return { raw, unique, valid, invalid, sourcesUsed, accuracy };
}
