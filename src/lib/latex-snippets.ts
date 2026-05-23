/**
 * Bibliothèque de snippets LaTeX pour le Bac mauritanien.
 *
 * Convention : le marqueur `$|` indique où va le curseur. Si du texte est
 * sélectionné dans l'éditeur au moment de l'insertion, il REMPLACE `$|`
 * (sélection conservée pour permettre une nouvelle action).
 *
 * Pour les snippets à plusieurs trous, on place `$|` au premier endroit
 * intéressant ; l'utilisateur navigue ensuite à la souris/clavier.
 */

export type Snippet = {
  /** Étiquette courte affichée sur le bouton (Unicode + 1-3 chars). */
  label: string;
  /** Template LaTeX à insérer. `$|` = position du curseur / sélection. */
  template: string;
  /** Tooltip (HTML title) : description complète. */
  description: string;
};

export type Category = {
  id: string;
  label: string;
  /** Emoji court pour l'onglet (1 char). */
  icon: string;
  snippets: Snippet[];
};

// ─── 1. Bases ────────────────────────────────────────────────────────────────
const bases: Snippet[] = [
  { label: "a/b", template: "\\dfrac{$|}{}", description: "Fraction display (\\dfrac)" },
  { label: "a/b inline", template: "\\frac{$|}{}", description: "Fraction inline (\\frac)" },
  { label: "x²", template: "$|^{2}", description: "Carré : x²" },
  { label: "x³", template: "$|^{3}", description: "Cube : x³" },
  { label: "xⁿ", template: "$|^{n}", description: "Puissance n : xⁿ" },
  { label: "x^…", template: "$|^{}", description: "Puissance personnalisée" },
  { label: "x₀", template: "$|_{0}", description: "Indice 0 : x₀" },
  { label: "xₙ", template: "$|_{n}", description: "Indice n : xₙ" },
  { label: "x_…", template: "$|_{}", description: "Indice personnalisé" },
  { label: "√x", template: "\\sqrt{$|}", description: "Racine carrée : √x" },
  { label: "ⁿ√x", template: "\\sqrt[n]{$|}", description: "Racine n-ième" },
  { label: "(...)", template: "\\left( $| \\right)", description: "Parenthèses auto-adaptées" },
  { label: "[...]", template: "\\left[ $| \\right]", description: "Crochets auto-adaptés" },
  { label: "{...}", template: "\\left\\{ $| \\right\\}", description: "Accolades auto-adaptées" },
  { label: "|x|", template: "\\left| $| \\right|", description: "Valeur absolue" },
  { label: "‖x‖", template: "\\left\\| $| \\right\\|", description: "Norme" },
  { label: "…", template: "\\cdots", description: "Points horizontaux centrés" },
  { label: "·", template: "\\cdot ", description: "Multiplication (point centré)" },
  { label: "×", template: "\\times ", description: "Multiplication croix" },
  { label: "±", template: "\\pm ", description: "Plus ou moins" },
];

// ─── 2. Vecteurs / Géométrie ────────────────────────────────────────────────
const vecteurs: Snippet[] = [
  { label: "→u", template: "\\vec{$|}", description: "Vecteur (flèche simple)" },
  { label: "→AB", template: "\\overrightarrow{$|}", description: "Vecteur (flèche longue, ex: AB)" },
  { label: "→i →j", template: "\\vec{i}, \\vec{j}", description: "Base orthonormée du plan" },
  { label: "→i →j →k", template: "\\vec{i}, \\vec{j}, \\vec{k}", description: "Base orthonormée de l'espace" },
  { label: "(O;→i,→j)", template: "(O\\,;\\,\\vec{i},\\,\\vec{j})", description: "Repère orthonormé du plan" },
  { label: "(O;→i,→j,→k)", template: "(O\\,;\\,\\vec{i},\\,\\vec{j},\\,\\vec{k})", description: "Repère orthonormé de l'espace" },
  { label: "→u·→v", template: "\\vec{$|} \\cdot \\vec{v}", description: "Produit scalaire" },
  { label: "→u∧→v", template: "\\vec{$|} \\wedge \\vec{v}", description: "Produit vectoriel" },
  { label: "‖→u‖", template: "\\left\\| \\vec{$|} \\right\\|", description: "Norme d'un vecteur" },
  { label: "AB", template: "AB = \\left\\| \\overrightarrow{AB} \\right\\|", description: "Distance entre 2 points" },
  { label: "d(A,B)", template: "d($|, B)", description: "Distance" },
  { label: "aff(A)", template: "\\operatorname{aff}($|)", description: "Affixe d'un point" },
  { label: "(d)", template: "(d)", description: "Notation d'une droite" },
  { label: "(C)", template: "(\\mathcal{C})", description: "Courbe représentative" },
  { label: "Δ", template: "\\Delta", description: "Discriminant / droite Δ" },
];

// ─── 3. Ensembles & logique ─────────────────────────────────────────────────
const ensembles: Snippet[] = [
  { label: "ℝ", template: "\\R", description: "Réels" },
  { label: "ℕ", template: "\\N", description: "Entiers naturels" },
  { label: "ℤ", template: "\\Z", description: "Entiers relatifs" },
  { label: "ℚ", template: "\\Q", description: "Rationnels" },
  { label: "ℂ", template: "\\C", description: "Complexes" },
  { label: "ℝ*", template: "\\Rstar", description: "Réels non nuls" },
  { label: "ℕ*", template: "\\Nstar", description: "Entiers naturels non nuls" },
  { label: "ℝ⁺", template: "\\Rplus", description: "Réels positifs" },
  { label: "ℝ⁻", template: "\\Rminus", description: "Réels négatifs" },
  { label: "ℝ⁺*", template: "\\Rpstar", description: "Réels strictement positifs" },
  { label: "∈", template: "\\in ", description: "Appartient" },
  { label: "∉", template: "\\notin ", description: "N'appartient pas" },
  { label: "⊂", template: "\\subset ", description: "Inclus dans" },
  { label: "∪", template: "\\cup ", description: "Union" },
  { label: "∩", template: "\\cap ", description: "Intersection" },
  { label: "∅", template: "\\emptyset", description: "Ensemble vide" },
  { label: "∀", template: "\\forall ", description: "Pour tout" },
  { label: "∃", template: "\\exists ", description: "Il existe" },
  { label: "⇒", template: "\\implies ", description: "Implique" },
  { label: "⇔", template: "\\iff ", description: "Équivaut à" },
  {
    label: "cases",
    template: "\\begin{cases} $| \\text{ si } \\dots \\\\ \\dots \\text{ si } \\dots \\end{cases}",
    description: "Fonction définie par cas",
  },
];

// ─── 4. Limites, dérivées, continuité ───────────────────────────────────────
const limites: Snippet[] = [
  { label: "lim", template: "\\lim_{x \\to $|} f(x)", description: "Limite générale" },
  { label: "lim+∞", template: "\\lim_{x \\to +\\infty} $|", description: "Limite en +∞" },
  { label: "lim−∞", template: "\\lim_{x \\to -\\infty} $|", description: "Limite en −∞" },
  { label: "lim 0", template: "\\lim_{x \\to 0} $|", description: "Limite en 0" },
  { label: "lim 0⁺", template: "\\lim_{x \\to 0^{+}} $|", description: "Limite à droite en 0" },
  { label: "lim 0⁻", template: "\\lim_{x \\to 0^{-}} $|", description: "Limite à gauche en 0" },
  { label: "+∞", template: "+\\infty", description: "Plus l'infini" },
  { label: "−∞", template: "-\\infty", description: "Moins l'infini" },
  { label: "f'(x)", template: "f'($|)", description: "Dérivée première" },
  { label: "f''(x)", template: "f''($|)", description: "Dérivée seconde" },
  { label: "f⁽ⁿ⁾", template: "f^{(n)}($|)", description: "Dérivée n-ième" },
  { label: "df/dx", template: "\\dfrac{\\mathrm{d}f}{\\mathrm{d}x}", description: "Notation Leibniz" },
  { label: "∂/∂x", template: "\\dfrac{\\partial}{\\partial x}$|", description: "Dérivée partielle" },
  { label: "ε", template: "\\varepsilon", description: "Epsilon" },
  { label: "f:ℝ→ℝ", template: "f \\colon \\R \\to \\R", description: "Définition fonction" },
  { label: "x↦f(x)", template: "x \\mapsto $|", description: "Définition par image" },
  { label: "g∘f", template: "g \\circ f", description: "Composée de fonctions" },
];

// ─── 5. Intégrales, sommes, produits ────────────────────────────────────────
const integrales: Snippet[] = [
  { label: "∫f dx", template: "\\int $| \\,\\mathrm{d}x", description: "Intégrale indéfinie" },
  { label: "∫ₐᵇ", template: "\\int_{a}^{b} $| \\,\\mathrm{d}x", description: "Intégrale définie" },
  { label: "∫₀^∞", template: "\\int_{0}^{+\\infty} $| \\,\\mathrm{d}x", description: "Intégrale impropre" },
  { label: "∬", template: "\\iint $| \\,\\mathrm{d}x\\,\\mathrm{d}y", description: "Intégrale double" },
  { label: "Σₖ", template: "\\sum_{k=$|}^{n}", description: "Somme finie" },
  { label: "Σ₀^∞", template: "\\sum_{k=0}^{+\\infty} $|", description: "Série" },
  { label: "Π", template: "\\prod_{k=$|}^{n}", description: "Produit" },
  { label: "dx", template: "\\,\\mathrm{d}x", description: "Élément différentiel dx" },
  { label: "dt", template: "\\,\\mathrm{d}t", description: "Élément différentiel dt" },
  { label: "F(x)", template: "F($|) = \\int f(x) \\,\\mathrm{d}x", description: "Primitive" },
  { label: "Aire", template: "\\mathcal{A} = \\int_{a}^{b} f(x) \\,\\mathrm{d}x", description: "Aire sous courbe" },
];

// ─── 6. Nombres complexes ───────────────────────────────────────────────────
const complexes: Snippet[] = [
  { label: "z = a+ib", template: "z = $| + i\\,b", description: "Forme algébrique" },
  { label: "z̄", template: "\\overline{$|}", description: "Conjugué" },
  { label: "|z|", template: "\\left| $| \\right|", description: "Module" },
  { label: "arg(z)", template: "\\arg($|)", description: "Argument" },
  { label: "Re(z)", template: "\\operatorname{Re}($|)", description: "Partie réelle" },
  { label: "Im(z)", template: "\\operatorname{Im}($|)", description: "Partie imaginaire" },
  { label: "e^iθ", template: "e^{i\\theta}", description: "Exponentielle complexe" },
  { label: "r·e^iθ", template: "r\\,e^{i\\theta}", description: "Forme exponentielle" },
  { label: "[r;θ]", template: "[r\\,;\\,\\theta]", description: "Forme polaire" },
  { label: "i² = −1", template: "i^{2} = -1", description: "Identité de i" },
  { label: "P(z)=0", template: "P(z) = $| = 0", description: "Équation polynomiale" },
];

// ─── 7. Tableaux / Matrices / Systèmes ──────────────────────────────────────
const tableaux: Snippet[] = [
  {
    label: "Système",
    template: "\\begin{cases} $| = \\dots \\\\ \\dots = \\dots \\end{cases}",
    description: "Système d'équations",
  },
  {
    label: "Matrice",
    template: "\\begin{pmatrix} $| & 0 \\\\ 0 & 1 \\end{pmatrix}",
    description: "Matrice (parenthèses)",
  },
  {
    label: "Déterminant",
    template: "\\begin{vmatrix} $| & b \\\\ c & d \\end{vmatrix}",
    description: "Déterminant (barres)",
  },
  {
    label: "Aligné",
    template: "\\begin{aligned} $| &= \\dots \\\\ &= \\dots \\end{aligned}",
    description: "Calcul aligné sur =",
  },
  {
    label: "Tab. var.",
    template:
      "\\begin{array}{|c|ccccc|}\n\\hline\nx & -\\infty & & 0 & & +\\infty \\\\\n\\hline\nf'(x) & & + & 0 & - & \\\\\n\\hline\nf(x) & & \\nearrow & $| & \\searrow & \\\\\n\\hline\n\\end{array}",
    description: "Tableau de variation",
  },
  {
    label: "Tab. signe",
    template:
      "\\begin{array}{|c|ccccc|}\n\\hline\nx & -\\infty & & $| & & +\\infty \\\\\n\\hline\nf(x) & & - & 0 & + & \\\\\n\\hline\n\\end{array}",
    description: "Tableau de signes",
  },
];

// ─── 8. Chimie (mhchem actif) ───────────────────────────────────────────────
const chimie: Snippet[] = [
  { label: "H₂O", template: "\\ce{$|}", description: "Formule chimique : \\ce{H2O}" },
  { label: "→", template: "\\ce{$| -> }", description: "Réaction sens unique" },
  { label: "⇌", template: "\\ce{$| <=> }", description: "Équilibre chimique" },
  { label: "+ →", template: "\\ce{$| + B -> C + D}", description: "Réaction A + B → C + D" },
  { label: "Na⁺", template: "\\ce{$|+}", description: "Cation" },
  { label: "Cl⁻", template: "\\ce{$|-}", description: "Anion" },
  { label: "SO₄²⁻", template: "\\ce{$|^{2-}}", description: "Ion polyvalent" },
  { label: "(aq)", template: "_{(aq)}", description: "État aqueux" },
  { label: "(s)", template: "_{(s)}", description: "État solide" },
  { label: "(l)", template: "_{(l)}", description: "État liquide" },
  { label: "(g)", template: "_{(g)}", description: "État gazeux" },
  { label: "ΔH", template: "\\Delta H", description: "Variation enthalpie" },
  { label: "pH", template: "\\mathrm{pH} = -\\log\\left[\\ce{H3O+}\\right]", description: "Définition pH" },
  { label: "[H₃O⁺]", template: "\\left[\\ce{H3O+}\\right]", description: "Concentration H3O+" },
  { label: "Kₐ", template: "K_{\\mathrm{a}} = \\dfrac{\\left[\\ce{A-}\\right]\\left[\\ce{H3O+}\\right]}{\\left[\\ce{HA}\\right]}", description: "Constante d'acidité" },
  { label: "pKₐ", template: "\\mathrm{p}K_{\\mathrm{a}} = -\\log K_{\\mathrm{a}}", description: "pKa" },
  { label: "Kₑ", template: "K_{\\mathrm{e}} = \\left[\\ce{H3O+}\\right]\\left[\\ce{OH-}\\right]", description: "Produit ionique de l'eau" },
  { label: "C₁V₁=C₂V₂", template: "C_{1} V_{1} = C_{2} V_{2}", description: "Dilution / équivalence dosage" },
  { label: "n = m/M", template: "n = \\dfrac{m}{M}", description: "Quantité de matière" },
  { label: "n = CV", template: "n = C \\times V", description: "Quantité en solution" },
  { label: "²³⁵U", template: "{}^{$|}\\mathrm{U}", description: "Notation isotopique" },
];

// ─── 9. Physique ────────────────────────────────────────────────────────────
const physique: Snippet[] = [
  { label: "→F", template: "\\vec{F}", description: "Vecteur force" },
  { label: "→E", template: "\\vec{E}", description: "Champ électrique" },
  { label: "→B", template: "\\vec{B}", description: "Champ magnétique" },
  { label: "→a", template: "\\vec{a}", description: "Accélération" },
  { label: "→v", template: "\\vec{v}", description: "Vitesse" },
  { label: "→P", template: "\\vec{P}", description: "Poids" },
  { label: "ΣF=ma", template: "\\sum \\vec{F} = m\\,\\vec{a}", description: "2e loi de Newton" },
  { label: "F = qE", template: "\\vec{F} = q\\,\\vec{E}", description: "Force électrique" },
  { label: "F = qv∧B", template: "\\vec{F} = q\\,\\vec{v} \\wedge \\vec{B}", description: "Force de Lorentz" },
  { label: "E_c", template: "E_{c} = \\tfrac{1}{2} m v^{2}", description: "Énergie cinétique" },
  { label: "E_p", template: "E_{p} = m g z", description: "Énergie potentielle" },
  { label: "E_m", template: "E_{m} = E_{c} + E_{p}", description: "Énergie mécanique" },
  { label: "ω", template: "\\omega = 2\\pi f", description: "Pulsation" },
  { label: "T = 1/f", template: "T = \\dfrac{1}{f}", description: "Période" },
  { label: "λ = v·T", template: "\\lambda = v \\cdot T", description: "Longueur d'onde" },
  { label: "U = R·I", template: "U = R \\times I", description: "Loi d'Ohm" },
  { label: "U_c", template: "u_{C}(t) = \\dfrac{q(t)}{C}", description: "Tension condensateur" },
  { label: "U_L", template: "u_{L}(t) = L\\,\\dfrac{\\mathrm{d}i}{\\mathrm{d}t}", description: "Tension bobine" },
  { label: "x'' + ω²x", template: "\\ddot{x}(t) + \\omega_{0}^{2}\\,x(t) = 0", description: "Oscillateur harmonique" },
  { label: "E = hν", template: "E = h\\,\\nu", description: "Énergie du photon" },
  { label: "m·s⁻¹", template: "\\,\\mathrm{m \\cdot s^{-1}}", description: "Unité vitesse" },
  { label: "m·s⁻²", template: "\\,\\mathrm{m \\cdot s^{-2}}", description: "Unité accélération" },
  { label: "N", template: "\\,\\mathrm{N}", description: "Newton" },
  { label: "J", template: "\\,\\mathrm{J}", description: "Joule" },
  { label: "Hz", template: "\\,\\mathrm{Hz}", description: "Hertz" },
  { label: "V", template: "\\,\\mathrm{V}", description: "Volt" },
  { label: "A", template: "\\,\\mathrm{A}", description: "Ampère" },
  { label: "Ω", template: "\\,\\Omega", description: "Ohm" },
  { label: "°C", template: "\\,{}^{\\circ}\\mathrm{C}", description: "Degré Celsius" },
];

// ─── 10. SVT (génétique, biologie moléculaire) ──────────────────────────────
const svt: Snippet[] = [
  { label: "(A,a)", template: "(A, a)", description: "Couple d'allèles" },
  { label: "[A//a]", template: "\\left[\\dfrac{A}{a}\\right]", description: "Génotype hétérozygote" },
  { label: "[A//A]", template: "\\left[\\dfrac{A}{A}\\right]", description: "Génotype homozygote dominant" },
  { label: "[a//a]", template: "\\left[\\dfrac{a}{a}\\right]", description: "Génotype homozygote récessif" },
  { label: "P × P", template: "P_{1} \\times P_{2}", description: "Croisement parental" },
  { label: "→ F1", template: "\\longrightarrow F_{1}", description: "Génération F1" },
  { label: "→ F2", template: "\\longrightarrow F_{2}", description: "Génération F2" },
  { label: "X^A Y", template: "X^{A} Y", description: "Génotype mâle (lié à X)" },
  { label: "X^A X^a", template: "X^{A} X^{a}", description: "Génotype femelle hétérozygote" },
  { label: "♀", template: "\\female", description: "Symbole femelle" },
  { label: "♂", template: "\\male", description: "Symbole mâle" },
  {
    label: "Punnett 2×2",
    template:
      "\\begin{array}{c|cc}\n & A & a \\\\\n\\hline\nA & AA & Aa \\\\\na & Aa & aa\n\\end{array}",
    description: "Échiquier de Punnett 2×2",
  },
  {
    label: "Punnett 4×4",
    template:
      "\\begin{array}{c|cccc}\n & AB & Ab & aB & ab \\\\\n\\hline\nAB & $| & & & \\\\\nAb & & & & \\\\\naB & & & & \\\\\nab & & & &\n\\end{array}",
    description: "Échiquier 4×4 (dihybridisme)",
  },
  { label: "5'-AUG-3'", template: "5'\\text{-}$|\\text{-}3'", description: "Brin avec orientation 5'→3'" },
  { label: "ADN-ARN", template: "\\begin{aligned}\n\\text{ADN brin sens : } & 5'\\text{-}$|\\text{-}3' \\\\\n\\text{ARNm copié :   } & 5'\\text{-}\\dots\\text{-}3'\n\\end{aligned}", description: "Transcription ADN → ARNm" },
  { label: "Codon AUG", template: "\\text{AUG}", description: "Codon (texte droit)" },
  { label: "Acide aminé", template: "\\text{Met (Méthionine)}", description: "Acide aminé en toutes lettres" },
  { label: "1/2", template: "\\dfrac{1}{2}", description: "Proportion mendélienne" },
  { label: "3:1", template: "3{:}1", description: "Rapport phénotypique F2 mono" },
  { label: "9:3:3:1", template: "9{:}3{:}3{:}1", description: "Rapport dihybride" },
];

export const SNIPPET_CATEGORIES: Category[] = [
  { id: "bases",     label: "Bases",        icon: "🔢", snippets: bases },
  { id: "vecteurs",  label: "Vecteurs",     icon: "→",  snippets: vecteurs },
  { id: "ensembles", label: "Ensembles",    icon: "ℝ",  snippets: ensembles },
  { id: "limites",   label: "Limites/Dérivées", icon: "f", snippets: limites },
  { id: "integrales",label: "Intégrales/Σ", icon: "∫",  snippets: integrales },
  { id: "complexes", label: "Complexes",    icon: "ℂ",  snippets: complexes },
  { id: "tableaux",  label: "Tableaux",     icon: "▦",  snippets: tableaux },
  { id: "chimie",    label: "Chimie",       icon: "⚗",  snippets: chimie },
  { id: "physique",  label: "Physique",     icon: "⚡", snippets: physique },
  { id: "svt",       label: "SVT",          icon: "🧬", snippets: svt },
];

/**
 * Applique un template à la sélection courante d'un textarea.
 * Retourne le nouveau contenu et la nouvelle position du curseur/sélection.
 */
export function applySnippet(
  template: string,
  fullText: string,
  selStart: number,
  selEnd: number,
): { text: string; cursorStart: number; cursorEnd: number } {
  const selected = fullText.slice(selStart, selEnd);
  const markerIdx = template.indexOf("$|");

  let inserted: string;
  let cursorStart: number;
  let cursorEnd: number;

  if (markerIdx === -1) {
    // Pas de marqueur : juste insérer après la sélection
    inserted = template;
    cursorStart = selStart + inserted.length;
    cursorEnd = cursorStart;
  } else {
    const before = template.slice(0, markerIdx);
    const after = template.slice(markerIdx + 2);
    inserted = before + selected + after;
    cursorStart = selStart + before.length;
    cursorEnd = cursorStart + selected.length;
  }

  return {
    text: fullText.slice(0, selStart) + inserted + fullText.slice(selEnd),
    cursorStart,
    cursorEnd,
  };
}
