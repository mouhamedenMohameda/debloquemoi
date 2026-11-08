// Tests de `latex-sanitize.ts`. Sans framework (harnais inline) pour rester
// tsc-clean et exécutable partout (bun / node).
//
//   bun run lib/latex-sanitize.test.ts     (ou: npm test)
//
// On teste surtout les parties spécifiques au mobile / à risque :
//   - couche 9 (compactage display pour KaTeX auto-render) ;
//   - réécritures « Hermes-safe » des regex à lookbehind ;
//   - gestion `;` nu vs `\;` (espace fine) ;
//   - normalisation des délimiteurs, mhchem, équilibrage d'accolades.

import { sanitizeLatex, KATEX_MACROS } from "./latex-sanitize";

// Un vrai backslash, sans se faire piéger par l'échappement des string literals.
const BS = String.fromCharCode(92);

// ─── Mini-harnais ──────────────────────────────────────────────────────────
let passed = 0;
const failures: string[] = [];

function test(name: string, fn: () => void): void {
  try {
    fn();
    passed++;
    console.log("  ✓ " + name);
  } catch (e) {
    failures.push(name + " — " + (e as Error).message);
    console.log("  ✗ " + name + "\n      " + (e as Error).message);
  }
}

function expect(actual: string) {
  return {
    toBe(expected: string) {
      if (actual !== expected)
        throw new Error(`attendu ${JSON.stringify(expected)}, reçu ${JSON.stringify(actual)}`);
    },
    toContain(sub: string) {
      if (!actual.includes(sub))
        throw new Error(`${JSON.stringify(actual)} ne contient pas ${JSON.stringify(sub)}`);
    },
    notToContain(sub: string) {
      if (actual.includes(sub))
        throw new Error(`${JSON.stringify(actual)} contient ${JSON.stringify(sub)} (interdit)`);
    },
    toMatch(re: RegExp) {
      if (!re.test(actual))
        throw new Error(`${JSON.stringify(actual)} ne matche pas ${re}`);
    },
  };
}

/** Vrai si AUCUN bloc $$...$$ ne contient de saut de ligne (requis par auto-render). */
function displayMathIsSingleLine(s: string): boolean {
  const blocks = s.match(/\$\$([\s\S]*?)\$\$/g) ?? [];
  return blocks.every((b) => !b.includes("\n"));
}

// ─── Cas ───────────────────────────────────────────────────────────────────
console.log("sanitizeLatex");

test("ne touche pas un inline $...$ déjà correct", () => {
  expect(sanitizeLatex("Soit $f(x)=" + BS + "frac{1}{x}$ defini.")).toBe(
    "Soit $f(x)=" + BS + "frac{1}{x}$ defini.",
  );
});

test("texte sans math est inchangé", () => {
  expect(sanitizeLatex("Bonjour, calcule la limite.")).toBe("Bonjour, calcule la limite.");
});

test("chaîne vide reste vide", () => {
  expect(sanitizeLatex("")).toBe("");
});

test("\\[..\\] -> display $$..$$", () => {
  const out = sanitizeLatex("On a " + BS + "[ x^2 = 4 " + BS + "] donc.");
  expect(out).toContain("$$");
  expect(out).toContain("x^2 = 4");
});

test("\\(..\\) -> inline $..$", () => {
  const out = sanitizeLatex("La limite " + BS + "( x " + BS + "to 0 " + BS + ") existe.");
  expect(out).toContain("$");
  expect(out).notToContain(BS + "(");
});

test("[couche 9] display multiligne compacté sur 1 ligne (auto-render)", () => {
  const input = "Res:\n$$\n" + BS + "lim_{x" + BS + "to+" + BS + "infty} f = 0\n$$\nFin.";
  const out = sanitizeLatex(input);
  if (!displayMathIsSingleLine(out))
    throw new Error("un bloc $$ contient encore un saut de ligne : " + JSON.stringify(out));
});

test("[couche 9] aligned : \\\\ préservé, bloc sur 1 ligne", () => {
  const input = "[ " + BS + "begin{aligned} a &= b " + BS + BS + " c &= d " + BS + "end{aligned} ]";
  const out = sanitizeLatex(input);
  expect(out).toContain(BS + "begin{aligned}");
  expect(out).toContain(BS + BS); // les sauts de ligne LaTeX \\ restent
  if (!displayMathIsSingleLine(out))
    throw new Error("aligned pas sur une seule ligne : " + JSON.stringify(out));
});

test("mhchem : \\ceNaCl -> \\ce{NaCl}", () => {
  const out = sanitizeLatex("On forme $" + BS + "ceNaCl$ ici.");
  expect(out).toContain(BS + "ce{NaCl}");
});

test("LaTeX brut hors délimiteurs est enveloppé", () => {
  const out = sanitizeLatex("La derivee " + BS + "frac{df}{dx} vaut.");
  expect(out).toMatch(/\$.*\\frac\{df\}\{dx\}.*\$/);
});

test("accolade non fermée est équilibrée", () => {
  const out = sanitizeLatex("Res $" + BS + "boxed{x^2$ fin.");
  expect(out).toContain(BS + "boxed{x^2}");
});

test("; nu dans math -> espace, mais \\; (espace fine) préservé", () => {
  // runtime: $a \; b ; c$
  const out = sanitizeLatex("$a " + BS + "; b ; c$");
  expect(out).toContain(BS + ";"); // \; conservé
  // le ; nu (entre b et c) doit avoir disparu : plus aucun ';' non précédé de '\'
  expect(out.split(BS + ";").join("")).notToContain(";");
});

test("; hors math n'est PAS touché", () => {
  expect(sanitizeLatex("Liste : a ; b ; c.")).toBe("Liste : a ; b ; c.");
});

test("typo \\matbb -> \\mathbb", () => {
  expect(sanitizeLatex("$x " + BS + "in " + BS + "matbb{R}$")).toContain(BS + "mathbb");
});

test("aucune exception sur entrées biscornues", () => {
  const tricky = [
    "$",
    "$$",
    "$$$",
    BS + "frac",
    "### Titre $x$ --- suite",
    "$" + BS + "boxed{" + BS + "frac{" + BS + "sqrt{x}}{2}$",
    "a".repeat(2000) + " $x^2$",
  ];
  for (const t of tricky) sanitizeLatex(t); // ne doit rien jeter
});

// ─── Macros ────────────────────────────────────────────────────────────────
console.log("KATEX_MACROS");

test("exporte les macros clés avec un seul backslash", () => {
  const m = KATEX_MACROS as Record<string, string>;
  expect(m["" + BS + "R"]).toBe(BS + "mathbb{R}");
  expect(m["" + BS + "conc"]).toBe(BS + "left[" + BS + "ce{#1}" + BS + "right]");
});

test("nombre de macros raisonnable (>= 40)", () => {
  const n = Object.keys(KATEX_MACROS).length;
  if (n < 40) throw new Error("seulement " + n + " macros");
});

// ─── Bilan ─────────────────────────────────────────────────────────────────
console.log(`\n${passed} passés, ${failures.length} échoués`);
if (failures.length > 0) {
  throw new Error(`${failures.length} test(s) en échec`);
}
