// Deuxième couche de vérification du LaTeX, côté SERVEUR.
//
// Le client (MathText) sanitise puis rend avec KaTeX en mode permissif : une
// formule cassée s'y affiche en rouge. Ici on compile chaque formule AVANT
// d'envoyer la réponse à l'élève, avec les mêmes réglages que le client, pour
// réparer ce qui ne passe pas. Une réponse qui sort d'ici ne contient plus de
// formule que KaTeX refuse.
import katex from "katex";
import "katex/contrib/mhchem";

import { KATEX_MACROS, sanitizeLatex } from "./latex-sanitize";

// Même découpage que remark-math / balanceBraces : $$…$$ puis $…$ (sans \n).
const MATH_RE = /(?<!\\)\$\$([\s\S]+?)\$\$|(?<![\\$])\$([^$\n]+?)\$/g;

export type MathError = { tex: string; display: boolean; message: string };

function compile(tex: string, display: boolean): string | null {
  try {
    katex.renderToString(tex, {
      displayMode: display,
      throwOnError: true,
      strict: false,
      trust: true,
      macros: { ...KATEX_MACROS },
    });
    return null;
  } catch (e) {
    return e instanceof Error ? e.message : String(e);
  }
}

/** Formules (après sanitization) que KaTeX refuse, sans doublon. */
export function findMathErrors(sanitized: string): MathError[] {
  const errors: MathError[] = [];
  const seen = new Set<string>();
  for (const m of sanitized.matchAll(MATH_RE)) {
    const display = m[1] !== undefined;
    const tex = (m[1] ?? m[2]).trim();
    const key = `${display}|${tex}`;
    if (!tex || seen.has(key)) continue;
    seen.add(key);
    const message = compile(tex, display);
    if (message) errors.push({ tex, display, message });
  }
  // `$$` resté seul : tout ce qui suit serait avalé dans une formule.
  const doubles = (sanitized.match(/(?<!\\)\$\$/g) ?? []).length;
  if (doubles % 2 === 1) {
    errors.push({ tex: "$$", display: true, message: "délimiteur $$ non fermé" });
  }
  return errors;
}

/** Remplace la formule `bad` par `good` (mêmes délimiteurs) dans le texte. */
function replaceFormula(text: string, bad: MathError, good: string): string {
  return text.replace(MATH_RE, (full, d: string | undefined, i: string | undefined) => {
    const display = d !== undefined;
    if (display !== bad.display || (d ?? i ?? "").trim() !== bad.tex) return full;
    return display ? `$$${good}$$` : `$${good}$`;
  });
}

/**
 * Dernier filet : une formule irréparable est montrée comme du texte neutre
 * (code inline) au lieu du rouge KaTeX. L'information reste lisible.
 */
function neutralize(text: string, errors: MathError[]): string {
  let out = text;
  for (const e of errors) {
    if (e.tex === "$$") {
      // Retire le dernier $$ orphelin.
      const idx = out.lastIndexOf("$$");
      if (idx >= 0) out = out.slice(0, idx) + out.slice(idx + 2);
      continue;
    }
    const plain = e.tex.replace(/`/g, "'").replace(/\s+/g, " ");
    out = out.replace(MATH_RE, (full, d: string | undefined, i: string | undefined) => {
      const display = d !== undefined;
      if (display !== e.display || (d ?? i ?? "").trim() !== e.tex) return full;
      return display ? `\n\n\`${plain}\`\n\n` : `\`${plain}\``;
    });
  }
  return out;
}

export type RepairFn = (errors: MathError[]) => Promise<(string | null)[]>;

export type MathCheckReport = {
  /** Texte final, sanitisé, sans formule invalide. */
  text: string;
  /** Formules en erreur à l'arrivée. */
  initialErrors: number;
  /** Formules réparées par l'IA. */
  repaired: number;
  /** Formules affichées en texte brut faute de réparation. */
  neutralized: number;
};

/**
 * Sanitise, compile chaque formule, fait réparer celles qui échouent
 * (au plus `maxRounds` appels à `repair`), puis neutralise le reste.
 */
export async function ensureValidMath(
  raw: string,
  repair?: RepairFn,
  maxRounds = 1,
): Promise<MathCheckReport> {
  let text = sanitizeLatex(raw);
  let errors = findMathErrors(text);
  const initialErrors = errors.length;
  let repaired = 0;

  for (let round = 0; round < maxRounds && repair && errors.length; round++) {
    const fixable = errors.filter((e) => e.tex !== "$$");
    if (!fixable.length) break;
    let fixes: (string | null)[] = [];
    try {
      fixes = await repair(fixable);
    } catch (e) {
      console.error("[math-validate] réparation IA indisponible", e);
      break;
    }
    fixable.forEach((e, k) => {
      const good = fixes[k]?.trim().replace(/^\$+|\$+$/g, "").trim();
      if (good && !compile(good, e.display)) {
        text = replaceFormula(text, e, good);
        repaired++;
      }
    });
    errors = findMathErrors(text);
  }

  const neutralized = errors.length;
  if (errors.length) text = neutralize(text, errors);
  return { text, initialErrors, repaired, neutralized };
}

/** Prompt de réparation : uniquement les formules fautives, réponse JSON. */
export function buildRepairPrompt(errors: MathError[]): string {
  const items = errors
    .map((e, k) => `${k + 1}. (${e.display ? "bloc" : "inline"}) ${e.tex}\n   Erreur KaTeX : ${e.message}`)
    .join("\n");
  return `Ces formules LaTeX ne compilent pas avec KaTeX 0.16 (extension mhchem disponible).
Corrige UNIQUEMENT la syntaxe, sans changer le sens mathématique ni les valeurs.
Règles : pas de délimiteurs $ dans ta réponse ; pas de \\\\[2pt] (utilise \\\\) ;
chaque \\begin{...} a son \\end{...} ; accolades équilibrées.

${items}

Réponds UNIQUEMENT par un tableau JSON de ${errors.length} chaînes, dans le même ordre, par exemple ["\\\\frac{1}{2}"].`;
}

/** Lit le tableau JSON renvoyé par le modèle (tolère du texte autour). */
export function parseRepairResponse(content: string, n: number): (string | null)[] {
  const m = /\[[\s\S]*\]/.exec(content);
  if (!m) return Array(n).fill(null);
  try {
    const arr = JSON.parse(m[0]);
    if (!Array.isArray(arr)) return Array(n).fill(null);
    return Array.from({ length: n }, (_, k) => (typeof arr[k] === "string" ? arr[k] : null));
  } catch {
    return Array(n).fill(null);
  }
}
