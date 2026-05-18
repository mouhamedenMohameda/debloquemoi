/**
 * Conversion MRU → unités portefeuille pour les débits sur auth-api.
 *
 * auth-api stocke les soldes en entiers (unités). Le ratio est défini par
 * `MRU_WALLET_MICRO` côté Python (1000 par défaut → 1 MRU = 1000 unités).
 *
 * Pour rester safe (ne jamais sous-facturer le user), on arrondit au plus haut.
 */

import "server-only";

import type { Usage } from "@/lib/groq";
import { costFor } from "@/lib/pricing";

// Doit correspondre à MRU_WALLET_MICRO côté auth-api. Si tu changes la valeur
// dans /opt/auth-api/.env, mets à jour ici aussi (ou expose-la via env Next.js).
const WALLET_MICRO_PER_MRU = Number(
  process.env.WALLET_MICRO_PER_MRU ?? "1000",
);

/** Convertit une valeur en MRU → unités entières (ceil pour ne pas sous-facturer). */
export function mruToUnits(mru: number): number {
  if (!Number.isFinite(mru) || mru <= 0) return 0;
  return Math.ceil(mru * WALLET_MICRO_PER_MRU);
}

/** Calcule le coût en unités à débiter pour un Usage Groq donné. */
export function unitsForUsage(usage: Usage | null | undefined): number {
  if (!usage) return 0;
  const { mru } = costFor(usage.model, usage.prompt, usage.completion);
  return mruToUnits(mru);
}
