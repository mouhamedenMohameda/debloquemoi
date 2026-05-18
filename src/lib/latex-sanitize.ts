// Sanitization du LaTeX produit par les LLMs. Stratégie en couches successives
// pour maximiser les chances qu'une expression mathématique soit rendue, même
// quand le modèle ne respecte pas parfaitement la syntaxe.

// === Commandes LaTeX courantes (utilisées pour le wrapping) ===
const LATEX_CMDS = [
  "frac",
  "dfrac",
  "tfrac",
  "sqrt",
  "cbrt",
  "ge",
  "le",
  "geq",
  "leq",
  "neq",
  "ne",
  "equiv",
  "approx",
  "sim",
  "to",
  "rightarrow",
  "leftarrow",
  "Rightarrow",
  "Leftarrow",
  "Leftrightarrow",
  "Longrightarrow",
  "Longleftarrow",
  "Longleftrightarrow",
  "longmapsto",
  "mapsto",
  "in",
  "notin",
  "subset",
  "supset",
  "cup",
  "cap",
  "emptyset",
  "infty",
  "forall",
  "exists",
  "nexists",
  "sum",
  "prod",
  "int",
  "iint",
  "iiint",
  "oint",
  "lim",
  "liminf",
  "limsup",
  "log",
  "ln",
  "exp",
  "sin",
  "cos",
  "tan",
  "cot",
  "arcsin",
  "arccos",
  "arctan",
  "sinh",
  "cosh",
  "tanh",
  "min",
  "max",
  "sup",
  "inf",
  "alpha",
  "beta",
  "gamma",
  "delta",
  "epsilon",
  "varepsilon",
  "zeta",
  "eta",
  "theta",
  "vartheta",
  "iota",
  "kappa",
  "lambda",
  "mu",
  "nu",
  "xi",
  "pi",
  "varpi",
  "rho",
  "varrho",
  "sigma",
  "varsigma",
  "tau",
  "upsilon",
  "phi",
  "varphi",
  "chi",
  "psi",
  "omega",
  "Gamma",
  "Delta",
  "Theta",
  "Lambda",
  "Xi",
  "Pi",
  "Sigma",
  "Upsilon",
  "Phi",
  "Psi",
  "Omega",
  "cdot",
  "cdots",
  "ldots",
  "vdots",
  "ddots",
  "times",
  "div",
  "pm",
  "mp",
  "circ",
  "partial",
  "nabla",
  "mathrm",
  "mathbb",
  "mathbf",
  "mathcal",
  "mathfrak",
  "mathsf",
  "mathit",
  "overline",
  "underline",
  "overrightarrow",
  "vec",
  "hat",
  "tilde",
  "bar",
  "dot",
  "ddot",
  "boxed",
  "begin",
  "end",
  "bigl",
  "bigr",
  "Bigl",
  "Bigr",
  "biggl",
  "biggr",
  "left",
  "right",
  "qquad",
  "quad",
  "displaystyle",
  "text",
  "operatorname",
  "implies",
  "iff",
  "land",
  "lor",
  "neg",
  "wedge",
  "vee",
];
// Liste explicite des commandes LaTeX que l'app reconnaît — utile pour
// d'éventuelles vérifications futures (validation, autocomplétion, etc.).
// Pour le wrapping, on accepte n'importe quel `\\[A-Za-z]+`.
export const KNOWN_LATEX_COMMANDS = LATEX_CMDS;

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
  // ; utilisé comme séparateur dans une formule → remplacer par espace normal
  // (uniquement dans un bloc math)
];

// === Macros KaTeX (passées à rehype-katex) ===
// Couvre les raccourcis pédagogiques courants.
export const KATEX_MACROS = {
  "\\R": "\\mathbb{R}",
  "\\N": "\\mathbb{N}",
  "\\Z": "\\mathbb{Z}",
  "\\Q": "\\mathbb{Q}",
  "\\C": "\\mathbb{C}",
  "\\eps": "\\varepsilon",
  "\\implies": "\\Longrightarrow",
  "\\iff": "\\Longleftrightarrow",
  // Vecteurs
  "\\vv": "\\overrightarrow",
} as const;

/**
 * Sanitise une chaîne markdown contenant du LaTeX.
 * Plusieurs passes, ordonnées du plus sûr au plus aggressif.
 */
export function sanitizeLatex(input: string): string {
  if (!input) return input;
  let out = input;

  // --- Couche 1 : délimiteurs LaTeX classiques → délimiteurs $ ---
  // Nettoie aussi les $...$ malformés à l'intérieur (qu'on a parfois en sortie LLM).
  out = out.replace(/\\\[([\s\S]*?)\\\]/g, (_, body) => {
    const clean = stripInnerDollars(body);
    return `\n\n$$${clean}$$\n\n`;
  });
  out = out.replace(/\\\(([\s\S]*?)\\\)/g, (_, body) => `$${body}$`);

  // --- Couche 2 : environnements LaTeX (\begin{aligned}...\end{aligned}) ---
  // Détecte aussi le cas "[ \begin{...}...\end{...} ]" (backslashes mangés par markdown).
  out = wrapBeginEndEnvironments(out);

  // --- Couche 3 : sauts de ligne autour des marqueurs Markdown structurels ---
  // Le LLM colle parfois tout sur une ligne : "blabla $$X$$ --- ### Titre".
  // On force des sauts de ligne autour de ces marqueurs.
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
  // Le modèle oublie souvent un `}` à la fin (\boxed{... sans } final).
  out = balanceBraces(out);

  // --- Couche 8 : fix mhchem (\ce et \pu sans accolades) ---
  // Le modèle écrit `\ceC3H8O` au lieu de `\ce{C3H8O}`. On ajoute les
  // accolades pour que KaTeX+mhchem rende correctement.
  out = fixMhchemBraces(out);

  return out;
}

/**
 * Ajoute les accolades manquantes après `\ce` et `\pu` (notation mhchem pour
 * chimie). Format attendu : `\ce{H2O}` ou `\pu{50 kg}`. Le modèle écrit
 * souvent :
 *   - `\ceH2O` (sans accolades, sans espace)   ← cas 1
 *   - `\ce H2O` (avec espace mais sans accolades) ← cas 2
 *   - `\ce\nH2O` (avec saut de ligne) ← cas 3
 * Tous ces cas ne marchent pas avec mhchem. On les corrige.
 */
function fixMhchemBraces(input: string): string {
  return (
    input
      // `\ce` : formules chimiques (pas de virgule/point ici)
      .replace(
        /\\ce(?!\{)[ \t]*([A-Za-z0-9^_{}+\-/]+)/g,
        (_, body) => `\\ce{${body}}`,
      )
      // `\pu` : unités physiques (peut contenir 1,77 ou 1.77, espaces possibles
      // mais on les ignore pour rester safe).
      .replace(
        /\\pu(?!\{)[ \t]*([A-Za-z0-9^_{}+\-/,.]+)/g,
        (_, body) => `\\pu{${body}}`,
      )
  );
}

/**
 * Équilibre automatiquement les accolades à l'intérieur des blocs math.
 * Si un bloc a plus de `{` que de `}`, on ajoute des `}` à la fin.
 * Si l'inverse (rare), on préfixe des `{` au début.
 *
 * Cela règle le cas très fréquent où le modèle écrit `\boxed{...}^{2}` mais
 * oublie le `}` final qui ferme `\boxed{`.
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
        // Skip le caractère suivant (commande échappée)
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
 * `###`) quand le modèle a tout collé sur une ligne. Indispensable pour que
 * Markdown puisse interpréter correctement la structure.
 */
function restoreStructuralLineBreaks(input: string): string {
  let out = input;
  // `$$` mid-ligne : on l'isole avec des sauts de ligne.
  // (callback pour éviter le piège $$ → $ dans le replacement de String.replace)
  out = out.replace(/(?<=\S)\s*\$\$/g, () => "\n\n$$");
  out = out.replace(/\$\$\s*(?=\S)/g, () => "$$\n\n");
  // `---` (séparateur Markdown) : forcer début de ligne
  out = out.replace(/(?<=\S)\s+---\s+(?=\S)/g, "\n\n---\n\n");
  // Titres `### ` mid-ligne : début de ligne
  out = out.replace(/(?<=\S)\s+(#{1,6}\s)/g, (_, h) => `\n\n${h}`);
  // Détecte un `$$` orphelin (impair) : si le nombre total de `$$` est impair,
  // on supprime celui qui est suivi d'un séparateur Markdown (--- ou ###).
  // On ne consomme PAS la whitespace autour pour préserver la structure.
  const count = (out.match(/\$\$/g) ?? []).length;
  if (count % 2 === 1) {
    out = out.replace(/\$\$(?=\s*(?:---|#{1,6}\s|\Z))/, "");
  }
  return out;
}

/**
 * Détecte les blocs `\begin{ENV}...\end{ENV}` (aligned, cases, matrix, etc.)
 * et les enveloppe dans `$$...$$`. Règle UNIVERSELLE : un bloc \begin..\end
 * EST de la math, peu importe ce qui l'entoure (brackets [..], dollars, ou
 * rien). On supprime aussi les `$..$` qui pourraient être à l'intérieur
 * (invalides dans un environnement LaTeX).
 *
 * On ne split PAS par math au préalable — sinon, si un `$..$` se trouve au
 * milieu d'un `\begin..\end`, on couperait le bloc en morceaux.
 *
 * En revanche, on protège les blocs `$$..$$` déjà bien formés via une
 * alternation prioritaire dans la regex.
 */
function wrapBeginEndEnvironments(input: string): string {
  // Alternation : soit on capture un bloc $$..$$ déjà existant (qu'on garde
  // tel quel), soit on capture un \begin..\end (qu'on enveloppe).
  // Groupes capturés :
  //   1. bloc $$..$$ existant
  //   2. nom de l'environnement (\begin{ENV})
  //   3. corps de l'environnement
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
  // $$...$$ multiline OU $...$ inline (sans \n) — non gourmand
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

/**
 * Stratégie en 2 niveaux sur chaque ligne :
 *
 *   Niveau A (ligne math-only) : la ligne est essentiellement du LaTeX brut
 *   (ex: `« \boxed{...} »` ou `\frac{1}{2} = \int_0^1 ...`).
 *   → On enveloppe tout le contenu dans $$...$$ pour un rendu display.
 *
 *   Niveau B (ligne mixte) : un peu de prose avec un peu de LaTeX nu au
 *   milieu. On essaye d'envelopper les "runs" de LaTeX en respectant les
 *   accolades imbriquées (pas de regex naïve).
 */
function wrapBareInText(seg: string): string {
  if (!seg.includes("\\")) return seg;
  return seg.split("\n").map(wrapLine).join("\n");
}

function wrapLine(line: string): string {
  // Si la ligne contient déjà du $...$, on ne touche pas (le modèle a fait
  // son travail correctement).
  if (line.includes("$")) return line;
  if (!line.includes("\\")) return line;

  // Strip des décorations de bord : citations « », puces, blockquote >,
  // espaces, gras `*`. On veut savoir si le CŒUR de la ligne est math.
  const core = line
    .replace(/^([\s>«»*\-•]+)/, "")
    .replace(/([\s«»\.]+)$/, "");

  if (core && isWholeLineMath(core)) {
    // Wrap le coeur en display math, préserve les décorations
    const idx = line.indexOf(core);
    return (
      line.slice(0, idx) + `$$${core}$$` + line.slice(idx + core.length)
    );
  }

  // Sinon : wrap "inline" les runs LaTeX (avec comptage de braces)
  return wrapInlineRuns(line);
}

function isWholeLineMath(s: string): boolean {
  if (!s) return false;
  // Au moins 2 commandes LaTeX (sinon un simple "\quad" en plein texte
  // déclencherait un wrap qui rendrait la prose en italique math).
  const latexCmdCount = (s.match(/\\[A-Za-z]+/g) ?? []).length;
  if (latexCmdCount < 2) return false;
  // Mots de prose : ≥ 3 lettres NON précédés de `\`. Les mots-clés math
  // (sin, cos, lim, ...) ne comptent pas.
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
    "tan",
  ]);
  const proseWords = (s.match(/(?<!\\)\b[A-Za-zÀ-ÿ]{3,}\b/g) ?? []).filter(
    (w) => !mathKeywords.has(w.toLowerCase()),
  );
  // Une ligne est "math entière" s'il n'y a aucun mot de prose
  // (tout est `\command` ou symboles).
  return proseWords.length === 0;
}

/**
 * Détecte les "runs" LaTeX dans une ligne et les enveloppe dans $...$.
 * Utilise un comptage explicite des accolades, donc supporte la profondeur
 * arbitraire (\boxed{\frac{\sqrt{x^{2}-4}}{...}} etc.).
 */
function wrapInlineRuns(line: string): string {
  const out: string[] = [];
  let i = 0;
  while (i < line.length) {
    if (line[i] === "\\" && /[A-Za-z]/.test(line[i + 1] ?? "")) {
      const start = i;
      i++;
      while (i < line.length && /[A-Za-z]/.test(line[i])) i++;
      // Étend : avale les arguments (à profondeur d'accolade > 0 on continue,
      // à profondeur 0 on continue tant que c'est math-likely).
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
        i -= p.length; // ne pas avaler la ponctuation finale de phrase
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

/** Nettoie à l'intérieur des blocs math : remplace ; par espace, etc. */
function cleanInsideMath(input: string): string {
  return input.replace(
    /(\$\$[\s\S]+?\$\$|\$[^\$\n]+?\$)/g,
    (block) => {
      // Remplace les ; à l'intérieur par des espaces (sauf si c'est un \;)
      return block.replace(/(?<!\\);/g, " ");
    },
  );
}
