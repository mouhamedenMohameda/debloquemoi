/**
 * Newton API — calculateur mathématique gratuit, sans auth.
 * https://newton.vercel.app/api/v2/{operation}/{expression}
 *
 * Utilisé pour vérifier si une expression extraite d'un exercice BAC
 * est bien calculable avant d'appeler Groq (évite les appels LLM inutiles
 * sur des expressions mal formées).
 *
 * Opérations supportées :
 *   simplify | factor | derive | integrate | zeroes
 *   tangent  | area   | cos    | sin       | tan
 *   arccos   | arcsin | arctan | abs       | log
 */

const NEWTON_BASE = "https://newton.vercel.app/api/v2";

export type NewtonOperation =
  | "simplify"
  | "factor"
  | "derive"
  | "integrate"
  | "zeroes"
  | "cos"
  | "sin"
  | "tan"
  | "abs"
  | "log";

export interface NewtonResult {
  operation: string;
  expression: string;
  result: string;
}

/**
 * Envoie une expression à Newton et retourne le résultat.
 * Retourne null si l'expression est invalide ou si Newton est indisponible.
 *
 * @example
 *   await newtonCompute("simplify", "x^2 + 2x + 1") // => { result: "(x + 1)^2" }
 *   await newtonCompute("derive",   "x^3")           // => { result: "3 x^2" }
 */
export async function newtonCompute(
  operation: NewtonOperation,
  expression: string,
): Promise<NewtonResult | null> {
  if (!expression || expression.trim().length === 0) return null;
  try {
    const encoded = encodeURIComponent(expression.trim());
    const res = await fetch(`${NEWTON_BASE}/${operation}/${encoded}`, {
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    // Newton renvoie { operation, expression, result }
    // Si result est "undefined" ou vide, l'expression n'est pas calculable.
    if (!data.result || data.result === "undefined") return null;
    return data as NewtonResult;
  } catch {
    // Timeout ou réseau — on dégrade silencieusement, pas bloquant.
    return null;
  }
}

/**
 * Extrait les expressions LaTeX basiques d'un énoncé de BAC pour les
 * soumettre à Newton. Cherche des patterns comme : x^2, sin(x), log(x)...
 *
 * Retourne la liste des expressions trouvées (max 3, les plus courtes).
 */
export function extractMathExpressions(ennonce: string): string[] {
  // Retire les délimiteurs LaTeX, garde le contenu
  const inlineLatex = [...ennonce.matchAll(/\$([^$]{2,60})\$/g)].map((m) => m[1]);
  const blockLatex = [...ennonce.matchAll(/\$\$([^$]{2,200})\$\$/g)].map((m) => m[1]);

  // Garde les expressions qui ressemblent à des formules algébriques simples
  const candidates = [...inlineLatex, ...blockLatex].filter((expr) =>
    /[x-zXYZ^()[\]{}]/.test(expr) &&       // contient une variable
    !/\\(begin|end|frac|vec|sum|int)/.test(expr) && // pas trop complexe pour Newton
    expr.length < 60,
  );

  // Déduplique et limite à 3
  return [...new Set(candidates)].slice(0, 3);
}

/**
 * Vérifie rapidement si au moins une expression de l'énoncé est calculable
 * par Newton. Utile comme pré-filtre avant un appel Groq.
 *
 * @returns { valid: boolean, expression?: string, result?: string }
 */
export async function newtonValidateExercise(ennonce: string): Promise<{
  valid: boolean;
  expression?: string;
  result?: string;
}> {
  const expressions = extractMathExpressions(ennonce);
  for (const expr of expressions) {
    const result = await newtonCompute("simplify", expr);
    if (result) {
      return { valid: true, expression: expr, result: result.result };
    }
  }
  return { valid: false };
}
