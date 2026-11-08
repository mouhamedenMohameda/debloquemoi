// Sanitization du LaTeX produit par les LLMs / l'OCR. Port mobile (Hermes-safe)
// de `app/src/lib/latex-sanitize.ts` du web. Même stratégie en couches pour
// maximiser les chances qu'une expression soit rendue.
//
// ⚠️ Différence avec le web : Hermes (et JSC) ne supportent PAS de façon fiable
// les *lookbehind* `(?<=...)` / `(?<!...)`. Les quelques regex qui en utilisaient
// ont été réécrites en versions équivalentes sans lookbehind (voir commentaires
// « Hermes-safe » plus bas). Le comportement reste identique au web.

// === Macros et corrections de typos courants ===
// Quand le modèle écrit `\Longrigthtarrow` ou `\overrigthtarrow` etc.
const TYPO_FIXES: Array<[RegExp, string]> = [
  [/\\Longrigthtarrow/g, "\\Longrightarrow"],
  [/\\Rigthtarrow/g, "\\Rightarrow"],
  [/\\overrigthtarrow/g, "\\overrightarrow"],
  [/\\matbb/g, "\\mathbb"],
  [/\\frcc/g, "\\frac"],
  [/\\sqrtt/g, "\\sqrt"],
  // Espaces LaTeX non-standard
  [/\\;\\;/g, "\\;"],
];

// === Macros KaTeX (passées à renderMathInElement dans la WebView) ===
// Bibliothèque pour le Bac mauritanien (math, physique, chimie, SVT).
// Les conventions suivent les programmes officiels IPN 2026.
export const KATEX_MACROS = {
  // ── Ensembles de nombres ────────────────────────────────────────────────
  "\\R": "\\mathbb{R}",
  "\\N": "\\mathbb{N}",
  "\\Z": "\\mathbb{Z}",
  "\\Q": "\\mathbb{Q}",
  "\\C": "\\mathbb{C}",
  "\\Rstar": "\\mathbb{R}^{*}",
  "\\Nstar": "\\mathbb{N}^{*}",
  "\\Zstar": "\\mathbb{Z}^{*}",
  "\\Rplus": "\\mathbb{R}^{+}",
  "\\Rminus": "\\mathbb{R}^{-}",
  "\\Rpstar": "\\mathbb{R}_{+}^{*}",

  // ── Raccourcis logique / quantificateurs ────────────────────────────────
  "\\eps": "\\varepsilon",
  "\\implies": "\\Longrightarrow",
  "\\iff": "\\Longleftrightarrow",
  "\\then": "\\Longrightarrow",

  // ── Vecteurs (notation française : flèche par-dessus) ───────────────────
  "\\vv": "\\overrightarrow",
  "\\vu": "\\vec{u}",
  "\\vi": "\\vec{i}",
  "\\vj": "\\vec{j}",
  "\\vk": "\\vec{k}",
  "\\vO": "\\vec{O}",
  // Norme d'un vecteur : \norme{u} → ||u||
  "\\norme": "\\left\\|#1\\right\\|",
  // Valeur absolue : \abs{x} → |x|
  "\\abs": "\\left|#1\\right|",

  // ── Analyse ─────────────────────────────────────────────────────────────
  "\\dx": "\\,\\mathrm{d}x",
  "\\dt": "\\,\\mathrm{d}t",
  "\\dy": "\\,\\mathrm{d}y",
  "\\du": "\\,\\mathrm{d}u",
  "\\dv": "\\,\\mathrm{d}v",
  // Dérivées partielles
  "\\df": "\\dfrac",

  // ── Physique : unités SI courantes (texte droit, espace fine) ──────────
  // Usage : 9{,}81\,\unite{m.s^{-2}}
  "\\unite": "\\,\\mathrm{#1}",
  "\\degC": "{}^{\\circ}\\mathrm{C}",
  "\\degree": "{}^{\\circ}",
  "\\Ohm": "\\Omega",
  "\\micro": "\\mu",

  // ── Chimie (en complément de mhchem qui fournit \ce et \pu) ────────────
  // pH, pKa lisibles
  "\\pH": "\\mathrm{pH}",
  "\\pKa": "\\mathrm{p}K_{\\mathrm{a}}",
  "\\pOH": "\\mathrm{pOH}",
  "\\Ka": "K_{\\mathrm{a}}",
  "\\Kb": "K_{\\mathrm{b}}",
  "\\Ke": "K_{\\mathrm{e}}",
  // Concentration : \conc{H3O+} → [H3O+]
  "\\conc": "\\left[\\ce{#1}\\right]",

  // ── SVT (notation génétique simplifiée) ─────────────────────────────────
  // Allèles : \allele{A}{a} → (A, a)
  "\\allele": "(#1, #2)",
  // Génotype : \geno{A}{a} → [A/a]
  "\\geno": "\\left[#1/#2\\right]",
  // Croisement : \croise{P1}{P2} → P1 × P2
  "\\croise": "#1 \\times #2",
} as const;

/**
 * Sanitise une chaîne markdown contenant du LaTeX.
 * Plusieurs passes, ordonnées du plus sûr au plus aggressif.
 */
export function sanitizeLatex(input: string): string {
  if (!input) return input;
  let out = input;

  // --- Couche 1 : délimiteurs LaTeX classiques → délimiteurs $ ---
  out = out.replace(/\\\[([\s\S]*?)\\\]/g, (_, body) => {
    const clean = stripInnerDollars(body);
    return `\n\n$$${clean}$$\n\n`;
  });
  out = out.replace(/\\\(([\s\S]*?)\\\)/g, (_, body) => `$${body}$`);

  // --- Couche 2 : environnements LaTeX (\begin{aligned}...\end{aligned}) ---
  out = wrapBeginEndEnvironments(out);

  // --- Couche 3 : sauts de ligne autour des marqueurs Markdown structurels ---
  out = restoreStructuralLineBreaks(out);

  // --- Couche 4 : typos courants ---
  for (const [re, sub] of TYPO_FIXES) {
    out = out.replace(re, sub);
  }

  // --- Couche 5 : wrap des commandes LaTeX brutes ---
  out = wrapBareLatex(out);

  // --- Couche 6 : nettoyage à l'intérieur des blocs math ---
  out = cleanInsideMath(out);

  // --- Couche 7 : équilibrage des accolades dans chaque bloc math ---
  out = balanceBraces(out);

  // --- Couche 8 : fix mhchem (\ce et \pu sans accolades) ---
  out = fixMhchemBraces(out);

  // --- Couche 9 (SPÉCIFIQUE MOBILE) : rendre les blocs display compatibles
  // avec KaTeX auto-render (cf. MathMarkdown). ---
  out = collapseDisplayMathForAutoRender(out);

  return out;
}

/**
 * (Spécifique mobile) KaTeX auto-render apparie les délimiteurs `$$...$$` à
 * l'intérieur d'UN SEUL nœud texte. Or `marked` découpe un bloc en plusieurs
 * paragraphes dès qu'une ligne vide apparaît — et les couches précédentes (
 * héritées du web/remark-math) insèrent justement des `\n\n` autour et dans les
 * `$$`. On compacte donc l'intérieur de chaque bloc `$$...$$` sur une seule
 * ligne pour qu'il reste appariable. Les `\n\n` qui ENTOURENT le bloc sont
 * conservés (ils en font un paragraphe à part, ce qui est souhaitable).
 *
 * Sûr pour le LaTeX : un bloc math ignore la quantité d'espaces ; les sauts de
 * ligne sémantiques utilisent `\\`, jamais des lignes vides.
 */
function collapseDisplayMathForAutoRender(input: string): string {
  return input.replace(/\$\$([\s\S]*?)\$\$/g, (_, body) => {
    const oneLine = body.replace(/\s+/g, " ").trim();
    return `$$${oneLine}$$`;
  });
}

/**
 * Ajoute les accolades manquantes après `\ce` et `\pu` (notation mhchem pour
 * chimie). Format attendu : `\ce{H2O}` ou `\pu{50 kg}`.
 */
function fixMhchemBraces(input: string): string {
  return input
    .replace(
      /\\ce(?!\{)[ \t]*([A-Za-z0-9^_{}+\-/]+)/g,
      (_, body) => `\\ce{${body}}`,
    )
    .replace(
      /\\pu(?!\{)[ \t]*([A-Za-z0-9^_{}+\-/,.]+)/g,
      (_, body) => `\\pu{${body}}`,
    );
}

/**
 * Équilibre automatiquement les accolades à l'intérieur des blocs math.
 * Si un bloc a plus de `{` que de `}`, on ajoute des `}` à la fin.
 */
function balanceBraces(input: string): string {
  return input.replace(/(\$\$[\s\S]*?\$\$|\$[^\$\n]+?\$)/g, (block) => {
    const isDouble = block.startsWith("$$");
    const delim = isDouble ? "$$" : "$";
    const body = block.slice(delim.length, -delim.length);

    let depth = 0;
    let i = 0;
    while (i < body.length) {
      const c = body[i];
      if (c === "\\") {
        i += 2;
        continue;
      }
      if (c === "{") depth++;
      else if (c === "}") depth--;
      i++;
    }

    if (depth > 0) {
      return `${delim}${body}${"}".repeat(depth)}${delim}`;
    }
    if (depth < 0) {
      return `${delim}${"{".repeat(-depth)}${body}${delim}`;
    }
    return block;
  });
}

/** Retire les `$...$` (et `$$...$$`) à l'intérieur d'un bloc math (interdits). */
function stripInnerDollars(body: string): string {
  return body
    .replace(/\$\$([\s\S]*?)\$\$/g, "$1")
    .replace(/\$([^\$\n]+)\$/g, "$1");
}

/**
 * Restaure les sauts de ligne autour des marqueurs structurels (`$$`, `---`,
 * `###`) quand le modèle a tout collé sur une ligne.
 *
 * Hermes-safe : les `(?<=\S)` du web sont remplacés par une capture `(\S)`
 * du caractère précédent, ré-émise dans le remplacement. Équivalent.
 */
function restoreStructuralLineBreaks(input: string): string {
  let out = input;
  // `$$` mid-ligne : on l'isole avec des sauts de ligne.
  out = out.replace(/(\S)\s*\$\$/g, (_, p) => `${p}\n\n$$`);
  out = out.replace(/\$\$\s*(?=\S)/g, () => "$$\n\n");
  // `---` (séparateur Markdown) : forcer début de ligne
  out = out.replace(/(\S)\s+---\s+(?=\S)/g, (_, p) => `${p}\n\n---\n\n`);
  // Titres `### ` mid-ligne : début de ligne
  out = out.replace(/(\S)\s+(#{1,6}\s)/g, (_, p, h) => `${p}\n\n${h}`);
  // Détecte un `$$` orphelin (impair) : si le nombre total de `$$` est impair,
  // on supprime celui qui est suivi d'un séparateur Markdown (--- ou ###).
  const count = (out.match(/\$\$/g) ?? []).length;
  if (count % 2 === 1) {
    out = out.replace(/\$\$(?=\s*(?:---|#{1,6}\s|\Z))/, "");
  }
  return out;
}

/**
 * Détecte les blocs `\begin{ENV}...\end{ENV}` (aligned, cases, matrix, etc.)
 * et les enveloppe dans `$$...$$`.
 */
function wrapBeginEndEnvironments(input: string): string {
  const re =
    /(\$\$[\s\S]*?\$\$)|(?:\[\s*)?\\begin\{([a-zA-Z*]+)\}([\s\S]*?)\\end\{\2\}(?:\s*\])?/g;

  return input.replace(re, (full, mathBlock, env, body) => {
    if (mathBlock) return mathBlock;
    if (!env) return full;
    const cleanBody = stripInnerDollars(body);
    return `\n\n$$\\begin{${env}}${cleanBody}\\end{${env}}$$\n\n`;
  });
}

/** Découpe le texte en segments math/text, puis wrappe les bruts. */
function wrapBareLatex(input: string): string {
  const parts: { type: "math" | "text"; value: string }[] = [];
  const re = /(\$\$[\s\S]+?\$\$|\$[^\$\n]+?\$)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(input)) !== null) {
    if (m.index > last)
      parts.push({ type: "text", value: input.slice(last, m.index) });
    parts.push({ type: "math", value: m[0] });
    last = m.index + m[0].length;
  }
  if (last < input.length)
    parts.push({ type: "text", value: input.slice(last) });

  return parts
    .map((p) => (p.type === "math" ? p.value : wrapBareInText(p.value)))
    .join("");
}

function wrapBareInText(seg: string): string {
  if (!seg.includes("\\")) return seg;
  return seg.split("\n").map(wrapLine).join("\n");
}

function wrapLine(line: string): string {
  if (line.includes("$")) return line;
  if (!line.includes("\\")) return line;

  const core = line
    .replace(/^([\s>«»*\-•]+)/, "")
    .replace(/([\s«»\.]+)$/, "");

  if (core && isWholeLineMath(core)) {
    const idx = line.indexOf(core);
    return line.slice(0, idx) + `$$${core}$$` + line.slice(idx + core.length);
  }

  return wrapInlineRuns(line);
}

function isWholeLineMath(s: string): boolean {
  if (!s) return false;
  const latexCmdCount = (s.match(/\\[A-Za-z]+/g) ?? []).length;
  if (latexCmdCount < 2) return false;
  const mathKeywords = new Set([
    "sin",
    "cos",
    "tan",
    "cot",
    "lim",
    "log",
    "ln",
    "exp",
    "max",
    "min",
    "sup",
    "inf",
    "det",
    "dim",
    "ker",
    "mod",
    "arg",
  ]);
  // Hermes-safe : le web utilisait `(?<!\\)\b[...]{3,}\b` pour ne pas compter
  // les noms de commandes. On retire d'abord les `\command`, puis on compte
  // les mots restants — même intention, sans lookbehind.
  const proseWords = (
    s.replace(/\\[A-Za-zÀ-ÿ]+/g, " ").match(/\b[A-Za-zÀ-ÿ]{3,}\b/g) ?? []
  ).filter((w) => !mathKeywords.has(w.toLowerCase()));
  return proseWords.length === 0;
}

/**
 * Détecte les "runs" LaTeX dans une ligne et les enveloppe dans $...$.
 * Comptage explicite des accolades → supporte la profondeur arbitraire.
 */
function wrapInlineRuns(line: string): string {
  const out: string[] = [];
  let i = 0;
  while (i < line.length) {
    if (line[i] === "\\" && /[A-Za-z]/.test(line[i + 1] ?? "")) {
      const start = i;
      i++;
      while (i < line.length && /[A-Za-z]/.test(line[i])) i++;
      let depth = 0;
      while (i < line.length) {
        const c = line[i];
        if (c === "{") {
          depth++;
        } else if (c === "}") {
          if (depth === 0) break;
          depth--;
        } else if (depth === 0) {
          if (!/[A-Za-z0-9_^+\-*/=<>().,!\[\]\\]/.test(c)) break;
        } else {
          if (c === "\n") break;
        }
        i++;
      }
      const expr = line.slice(start, i).replace(/[.,;:]+$/, (p) => {
        i -= p.length;
        return "";
      });
      if (/\\[A-Za-z]/.test(expr)) {
        out.push(`$${expr.trim()}$`);
      } else {
        out.push(expr);
      }
    } else {
      out.push(line[i]);
      i++;
    }
  }
  return out.join("");
}

/**
 * Nettoie à l'intérieur des blocs math : remplace `;` nu par une espace, en
 * PRÉSERVANT `\\;` (espace fine LaTeX).
 *
 * Hermes-safe : le web utilisait la lookbehind `(?<!\\\\);`. Ici une simple
 * capture `(\\\\?)` du backslash optionnel suffit : si le `;` était précédé
 * d'un `\\`, on garde `\\;` tel quel ; sinon on le remplace par une espace.
 */
function cleanInsideMath(input: string): string {
  return input.replace(/(\$\$[\s\S]+?\$\$|\$[^\$\n]+?\$)/g, (block) =>
    block.replace(/(\\?);/g, (m, bs) => (bs ? m : " ")),
  );
}
