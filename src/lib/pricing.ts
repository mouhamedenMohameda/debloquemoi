// Tarifs Groq publics — à mettre à jour si Groq change ses prix.
// Source : console.groq.com/pricing
// Prix en USD par 1M de tokens.

import { DEFAULT_MODEL, VISION_MODEL } from "./groq";

export const USD_TO_MRU = 40;

// Multiplicateur appliqué au coût réel Groq pour facturer l'utilisateur.
// 2.5 = on charge 2.5× le coût IA (marge brute 60%).
export const PRICE_MARKUP = 2.5;

// Tarification forfaitaire (prévisible pour le user — pas de surprise selon
// la longueur du texte généré).
//   - OCR : 1 MRU par photo, peu importe la taille du texte transcrit
//   - Hint : pas de forfait (débit du coût réel) mais solde minimum 0.5 MRU
//     requis pour démarrer la requête
export const OCR_FLAT_COST_MRU = 1.0;
export const MIN_HINT_BALANCE_MRU = 0.5;

type ModelPrice = {
  inputPerMillion: number; // USD / 1M tokens
  outputPerMillion: number;
};

const PRICES: Record<string, ModelPrice> = {
  // GPT-OSS-120B (open weights, raisonnement) — tarifs Groq
  [DEFAULT_MODEL]: { inputPerMillion: 0.15, outputPerMillion: 0.6 },
  // Llama 4 Scout (vision OCR)
  [VISION_MODEL]: { inputPerMillion: 0.11, outputPerMillion: 0.34 },
  // Anciens modèles encore listés au cas où
  "llama-3.3-70b-versatile": { inputPerMillion: 0.59, outputPerMillion: 0.79 },
  "deepseek-r1-distill-llama-70b": {
    inputPerMillion: 0.75,
    outputPerMillion: 0.99,
  },
};

// Fallback prudent si un nouveau modèle apparaît
const FALLBACK_PRICE: ModelPrice = { inputPerMillion: 0.6, outputPerMillion: 0.8 };

export type CostBreakdown = {
  usd: number;
  mru: number;
};

export function costFor(
  model: string,
  promptTokens: number,
  completionTokens: number,
): CostBreakdown {
  const p = PRICES[model] ?? FALLBACK_PRICE;
  const realUsd =
    (promptTokens * p.inputPerMillion + completionTokens * p.outputPerMillion) /
    1_000_000;
  const usd = realUsd * PRICE_MARKUP;
  return { usd, mru: usd * USD_TO_MRU };
}

// Format MRU lisible : 0,003 / 0,12 / 1,4 / 15
export function formatMRU(mru: number): string {
  if (mru === 0) return "0";
  if (mru < 0.001) return "<0,001";
  if (mru < 0.01) return mru.toFixed(3).replace(".", ",");
  if (mru < 1) return mru.toFixed(2).replace(".", ",");
  if (mru < 10) return mru.toFixed(1).replace(".", ",");
  return Math.round(mru).toLocaleString("fr-FR");
}
