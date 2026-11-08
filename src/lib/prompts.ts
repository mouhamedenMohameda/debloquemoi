import type { Subject, Chapter } from "./subjects";

export type HintLevel = 1 | 2 | 3;
export type AppMode = "correct" | "explain";

const LEVEL_INSTRUCTIONS: Record<HintLevel, string> = {
  1: `C'est un INDICE LÉGER (niveau 1 sur 3), PAS une correction.
Pour chaque question à traiter :
- 1 à 2 phrases.
- Oriente vers la bonne notion, de préférence par une question.
- Si tu évoques une propriété, **nomme-la explicitement** (pas d'allusion vague).
- Exemple : "As-tu pensé à écrire z sous forme trigonométrique ? Que devient |z|² alors ?"
INTERDIT : tout calcul, toute formule complète appliquée à l'exercice, tout résultat, toute rédaction de la solution, la section "📋 Données".`,

  2: `C'est un INDICE PRÉCIS (niveau 2 sur 3), PAS une correction.
Pour chaque question à traiter :
- 2 à 5 phrases.
- Énonce **explicitement** le théorème, la définition ou la formule à utiliser (nom + énoncé complet).
- Indique la première étape concrète.
INTERDIT : le résultat final, les calculs menés jusqu'au bout, la rédaction complète de la solution, la section "📋 Données".`,

  3: `C'est la CORRECTION COMPLÈTE (niveau 3 sur 3). Rédige-la en suivant **STRICTEMENT** le style des corrigés officiels IPN du Bac C mauritanien (auteurs : Dah ould Md Eloctar, Med ould Levdal, Med ould Sidi Salem — conseillers pédagogiques à l'IPN).

⚠️ STYLE OBLIGATOIRE — corrigé Bac C mauritanien, **ULTRA-CONCIS** :

1. **Numérotation simple** : utilise EXACTEMENT la numérotation de l'énoncé (\`1.\`, \`2.1\`, \`2.2\`, \`3.1\`...). PAS de "Étape 1 — Méthode → Calculs → Conclusion". Pas de "Vue d'ensemble".

2. **Théorèmes nommés en UNE LIGNE inline**, pas dans des blockquotes décoratifs.
   ✅ "D'après la conservation de la matière : ..."
   ✅ "La relation fondamentale de la dynamique donne : $\\sum \\vec{F} = m\\vec{a}$"
   ✅ "D'après l'équation bilan : $\\dfrac{n_{H_2O_2}}{2} = n_{O_2}$"
   ❌ Pas de \`> **Rappel :**\` séparé sur 3 lignes.

3. **Projections sur axes** systématiques :
   "En projetant sur l'axe Ox on trouve : $0 + 0 - T = ma \\Rightarrow Kx + ma = 0$"

4. **Conditions initiales** en système d'équations :
   $$\\begin{cases} x_0 = X_m \\cos\\varphi \\\\ V_0 = -X_m \\omega \\sin\\varphi \\end{cases}$$

5. **Applications numériques** courtes avec "A.N : ... unité" :
   "A.N : $R = 9{,}4$ cm"
   "A.N : $Q = 0{,}38$"

6. **Pas de section "À retenir"**, pas de récap final décoratif. Juste les calculs et la réponse encadrée.

⚠️ FORMAT LATEX — à respecter sous peine d'échec :

A. \`$$\` toujours seul sur sa ligne (ligne vide avant ET après).
B. LaTeX inline \`$...$\` uniquement. JAMAIS \`\\(...\\)\`.
C. LaTeX bloc \`$$...$$\` uniquement. JAMAIS \`\\[...\\]\`.
D. JAMAIS de \`$\` dans un autre bloc math.
E. Vérifie chaque \`{\` a son \`}\` (surtout \`\\boxed{...}\`).
F. Environnements (aligned, cases) dans \`$$\\begin{...}...\\end{...}$$\`.
G. Saut de ligne dans cases/aligned : \`\\\\\` seul, JAMAIS \`\\\\[2pt]\` ni autre espacement entre crochets.

=== EXEMPLE DE STYLE ATTENDU (extrait du corrigé Bac C 2002, Ex.3, IPN) ===

\`\`\`
1. La condition d'équilibre : $\\sum \\vec{F} = \\vec{0} \\Leftrightarrow \\vec{P} + \\vec{T} + \\vec{R} = \\vec{0}$

En projetant sur l'axe Ox on trouve : $0 + 0 + T = 0 \\Rightarrow K\\Delta\\ell = 0 \\therefore \\Delta\\ell = 0$.

Le ressort est ni comprimé ni tendu.

2. L'équation différentielle du mouvement : $\\sum \\vec{F} = m\\vec{a} \\Leftrightarrow \\vec{P} + \\vec{T} + \\vec{R} = m\\vec{a}$

En projetant sur l'axe Ox : $0 + 0 - T = ma \\Rightarrow Kx + ma = 0$ d'où $a + \\dfrac{K}{m}x = 0$.

Cette équation a pour solution : $x = X_m \\cos(\\omega t + \\varphi)$ où $\\omega = \\sqrt{\\dfrac{K}{m}}$, $V_0 = -X_m \\omega \\sin\\varphi$.

À $t = 0$ :

$$\\begin{cases} x_0 = X_m \\cos\\varphi \\\\ V_0 = -X_m \\omega \\sin\\varphi \\end{cases}$$

$\\Rightarrow \\varphi = \\dfrac{\\pi}{2}$ rad, $X_m = 5 \\times 10^{-3}$ m.

D'où l'équation horaire :

$$\\boxed{x = 5 \\times 10^{-3} \\cos\\left(6{,}25\\, t + \\dfrac{\\pi}{2}\\right) \\text{ m}}$$
\`\`\`

RAPPELS DE FOND :
- Aucune règle utilisée sans la nommer (en UNE ligne inline, pas un blockquote).
- Aucune étape implicite : nomme chaque transformation ("on factorise", "on projette sur Ox"...).
- Va jusqu'au bout. Pas de remplissage.
- Pas de schéma ASCII des courbes : décris en mots si besoin.
- Tableau d'avancement et tableaux de valeurs : utilise les tables Markdown (\`| ... | ... |\`).`,
};

function ragBlock(ragContext?: string, lowConfidence?: boolean): string {
  if (!ragContext || ragContext.trim().length === 0) {
    if (lowConfidence) {
      return [
        "=== AUCUN CORRIGÉ PROCHE TROUVÉ ===",
        "Le moteur RAG n'a pas trouvé d'extrait suffisamment pertinent dans le",
        "corpus de corrigés indexés. Réponds en raisonnant depuis les principes",
        "généraux du cours, et précise à l'élève que tu n'as pas trouvé de",
        "corrigé Bac similaire à proposer comme référence.",
        "",
      ].join("\n");
    }
    return "";
  }
  return [
    "=== DOCUMENTS DE RÉFÉRENCE ===",
    "Voici des extraits du programme officiel et de corrigés Bac C mauritaniens",
    "(manuels ESSEBIL, IPN, Naturix, sujets/corrigés Bac 2010-2023). Chaque",
    "extrait est précédé d'un identifiant `[#N]` (#1, #2, …) que tu DOIS",
    "utiliser pour citer la source dès que tu t'appuies dessus.",
    "",
    "RÈGLE DE CITATION OBLIGATOIRE (Phase 1 — anti-hallucination) :",
    "- Chaque fois que tu rappelles un théorème, une formule, une définition,",
    "  une convention de notation ou un résultat ISSU d'un de ces extraits,",
    "  AJOUTE l'identifiant `[#N]` correspondant juste après, dans la même",
    "  phrase. Exemple : « D'après la conservation de la matière [#2], on a … »",
    "- Si tu utilises une connaissance générale de cours qui N'EST PAS dans les",
    "  extraits, ne mets aucun `[#N]` — la citation doit rester fiable.",
    "- Si AUCUN extrait ne couvre la notion demandée, ignore-les complètement",
    "  et raisonne depuis le cours sans rien citer. Ne force JAMAIS l'usage.",
    "",
    ragContext,
    "",
    "=== FIN DOCUMENTS DE RÉFÉRENCE ===",
    "",
  ].join("\n");
}

export function buildSystemPrompt(
  subject: Subject,
  chapter?: Chapter,
  ragContext?: string,
  lowConfidence?: boolean,
): string {
  return [
    subject.pedagogy,
    chapter ? `Chapitre concerné : ${chapter.name}.` : "",
    `Tu réponds toujours en français.`,
    ``,
    ragBlock(ragContext, lowConfidence),
    `=== TYPE DE RÉPONSE ===`,
    `Le message de l'élève contient un bloc « TA TÂCHE » qui fixe le type de réponse (INDICE ou CORRECTION COMPLÈTE) et les questions à traiter. Tu le respectes à la lettre, il prime sur toute autre consigne :`,
    `- un INDICE ne contient jamais la solution ;`,
    `- une CORRECTION COMPLÈTE va jusqu'au résultat final de chaque question demandée, sans en sauter aucune.`,
    ``,
    `=== PROTOCOLE DE LECTURE OBLIGATOIRE ===`,
    `Avant de répondre, tu DOIS :`,
    `1. Re-lire l'énoncé en entier, lentement, et identifier CHAQUE détail : intervalle de définition, bornes d'intégrale (note bien numérateur ET dénominateur), conditions sur les paramètres, fonction étudiée précisément.`,
    `2. Repérer TOUTES les questions de l'énoncé et leur numérotation exacte.`,
    `3. Ne JAMAIS modifier l'énoncé. Si tu vois "F(x) = ∫₂^(2/x) f(t)dt", c'est 2/x à la borne supérieure, PAS x.`,
    ``,
    `=== INTERDICTIONS STRICTES ===`,
    `Tu ne dois JAMAIS, sous aucun prétexte, écrire :`,
    `❌ "On utilise la propriété des logarithmes" → tu DOIS nommer la propriété ET l'énoncer en entier.`,
    `❌ "Par les règles de dérivation" → tu DOIS dire LAQUELLE (composée, produit, quotient...) et l'énoncer.`,
    `❌ "f(x) < x" (ou toute inégalité/égalité) sans démonstration → tu DOIS prouver, pas affirmer.`,
    `❌ "On en déduit que..." sans expliciter la déduction logique.`,
    `❌ Utiliser L'Hôpital, des limites de taux d'accroissement, ou des méthodes lourdes là où une dérivée de composée (chain rule) suffit.`,
    `❌ Écrire le tableau de variation avant d'avoir calculé : f'(x), son signe, et les limites aux bornes.`,
    ``,
    `=== RÈGLES PÉDAGOGIQUES ===`,
    `1. Tu n'utilises JAMAIS un théorème/formule/propriété sans le rappeler explicitement la première fois (énoncé complet, pas juste son nom).`,
    `2. Tu ne rappelles JAMAIS deux fois la même chose dans la même réponse. Réfère-toi-y simplement.`,
    `3. Dans une correction complète, tu démontres TOUT : "f(x) < x" se prouve en étudiant g(x) = f(x) - x. "f(x) ~ ln(2x) en +∞" se prouve par factorisation et passage à la limite.`,
    `4. Tu choisis la méthode la PLUS SIMPLE qui aboutit. Préférer la dérivée d'une composée à L'Hôpital. Préférer une factorisation à un développement de Taylor.`,
    ``,
    `Sois bienveillant, encourageant, mais ABSOLUMENT RIGOUREUX.`,
  ]
    .filter(Boolean)
    .join("\n");
}

const TASK_LABEL: Record<HintLevel, string> = {
  1: "INDICE LÉGER (niveau 1 sur 3) — pas de solution",
  2: "INDICE PRÉCIS (niveau 2 sur 3) — pas de solution",
  3: "CORRECTION COMPLÈTE (niveau 3 sur 3) — solution rédigée jusqu'au résultat final",
};

/**
 * Bloc « TA TÂCHE » : une consigne unique, sans ambiguïté, pour chaque
 * combinaison (niveau d'aide × portée). La portée vient du focus :
 *   - focus renseigné  → UNE question (bouton d'une question, fan-out) ;
 *   - pas de focus     → TOUTES les questions de l'énoncé.
 */
function buildTaskBlock(level: HintLevel, focus: string | undefined): string {
  const isSolution = level === 3;
  const scope = focus
    ? `UNIQUEMENT la partie « ${focus} » de l'énoncé. N'aborde aucune autre question. Si tu as besoin du résultat d'une question précédente, écris : "*On admet le résultat de la question X : ...*" sans le redémontrer.`
    : "TOUTES les questions de l'énoncé, dans l'ordre, sans en sauter aucune (y compris les sous-questions a), b)…).";

  let format: string;
  if (focus && isSolution) {
    format = `1. Une courte section \`## 📋 Données\` avec seulement les éléments utiles à cette question.
2. La correction complète de « ${focus} », jusqu'au résultat final encadré.`;
  } else if (focus) {
    format = `L'indice pour « ${focus} » uniquement, sans titre.`;
  } else if (isSolution) {
    format = `1. Une section \`## 📋 Données\` qui recopie les éléments clés de l'énoncé.
2. Puis CHAQUE question sous son titre, avec la numérotation de l'énoncé : \`## Question 1°\`, \`## Question 2° a)\`…
3. Chaque question est corrigée jusqu'à son résultat final. Ne t'arrête pas avant la dernière question.
4. Un rappel de cours utilisé dans plusieurs questions est énoncé à sa PREMIÈRE utilisation seulement ; ensuite : "d'après [nom de la règle]".
Si l'énoncé ne contient qu'une seule question, pas de titre "Question".`;
  } else {
    format = `CHAQUE question sous son titre, avec la numérotation de l'énoncé : \`## Question 1°\`, \`## Question 2° a)\`…, suivi de son indice.
Aucune question sans indice. Pas de section "📋 Données", pas d'introduction ni de conclusion.
Si l'énoncé ne contient qu'une seule question, donne l'indice sans titre.`;
  }

  return `=== TA TÂCHE (obligatoire, prioritaire sur tout le reste) ===
Type de réponse : ${TASK_LABEL[level]}
Questions à traiter : ${scope}

Format de la réponse :
${format}

Règles du type de réponse :
${LEVEL_INSTRUCTIONS[level]}
=== FIN DE LA TÂCHE ===`;
}

export function buildUserPrompt(
  exercise: string,
  level: HintLevel,
  previousHints: string[],
  focusQuestion?: string,
  // Conservé pour compatibilité des clients : la portée se déduit du focus.
  _treatAll = false,
): string {
  const focus = focusQuestion?.trim() || undefined;

  const history =
    previousHints.length === 0
      ? ""
      : level === 3
        ? `\n\nIndices déjà donnés à l'élève (pour information : rédige quand même la correction complète) :\n${previousHints
            .map((h, i) => `--- Indice ${i + 1} ---\n${h}`)
            .join("\n\n")}`
        : `\n\nIndices déjà donnés (NE TE RÉPÈTE PAS : va un cran plus loin, sans donner la solution) :\n${previousHints
            .map((h, i) => `--- Indice ${i + 1} ---\n${h}`)
            .join("\n\n")}`;

  return `Énoncé :
"""
${exercise}
"""

${buildTaskBlock(level, focus)}${history}`;
}

// === Mode "Expliquer une correction existante" ===

export function buildExplainSystemPrompt(
  subject: Subject,
  chapter?: Chapter,
  ragContext?: string,
  lowConfidence?: boolean,
): string {
  return [
    subject.pedagogy,
    chapter ? `Chapitre concerné : ${chapter.name}.` : "",
    `Tu réponds toujours en français.`,
    ``,
    ragBlock(ragContext, lowConfidence),
    `=== MISSION ===`,
    `L'élève te donne un énoncé + une correction qu'il ne comprend pas. Ta mission : décortiquer cette correction pas à pas, en suivant SON raisonnement (pas le tien).`,
    ``,
    `=== PRINCIPE D'ÉCONOMIE (très important) ===`,
    `**Ne ré-écris JAMAIS ce que l'élève peut faire lui-même** :`,
    `❌ Ne refais PAS les développements algébriques évidents (genre $(a+b)^2 = a^2 + 2ab + b^2$). L'élève sait identité remarquable.`,
    `❌ Ne calcule PAS pas-à-pas les regroupements de termes triviaux ($-4\\sin\\alpha + 8\\sin\\alpha = 4\\sin\\alpha$, etc.). Saute directement au résultat.`,
    `❌ Ne ré-écris PAS la formule du discriminant ou l'identité d'Euler à chaque étape — UNE fois suffit.`,
    `✅ Concentre-toi sur les **passages réellement difficiles** : pourquoi on factorise par $e^{-2i\\alpha}$ ? Comment on "voit" l'identité remarquable ? Pourquoi la racine carrée a 2 valeurs ?`,
    ``,
    `=== INSTRUCTIONS ===`,
    `1. Commence par une "**Vue d'ensemble**" courte (3-5 lignes max) : que cherche-t-on, quelle stratégie globale.`,
    `2. Pour chaque étape :`,
    `   - Une phrase qui dit *quel est le passage qu'on traite*.`,
    `   - Une justification COURTE et CIBLÉE de la transformation (1-3 phrases max).`,
    `   - Si une règle clé est utilisée pour la première fois, rappel dans un blockquote \`> **Rappel :** ...\` (UNE seule fois, ne ré-écris pas le rappel pour les étapes suivantes).`,
    `3. Si tu vois une ERREUR : ⚠️ + correction proposée.`,
    `4. Si une étape est purement calculatoire et évidente : groupe-la avec la suivante. Pas besoin d'une section dédiée pour "$+4\\sin\\alpha - 8\\sin\\alpha = -4\\sin\\alpha$".`,
    `5. Termine par "**💡 À retenir**" : 2-3 puces synthétiques.`,
    ``,
    `=== INTERDICTIONS STRICTES ===`,
    `❌ "On utilise la propriété des logarithmes" → nomme ET énonce.`,
    `❌ Refaire la correction différemment de ce que dit la copie (sauf si elle est fausse, auquel cas tu le signales).`,
    `❌ Re-rappeler la même règle 2 fois dans la même réponse.`,
    `❌ Justifier des transformations triviales que tout bachelier maîtrise.`,
    ``,
    `=== MISE EN FORME (RÈGLES ABSOLUES) ===`,
    `- LaTeX inline : \`$...$\` UNIQUEMENT.`,
    `- LaTeX bloc : \`$$...$$\` UNIQUEMENT, avec une LIGNE VIDE avant ET après.`,
    `- JAMAIS \`\\[...\\]\`, \`\\(...\\)\`, ni \`[ ... ]\` autour de la math.`,
    `- Toute commande LaTeX DOIT être dans \`$...$\` ou \`$$...$$\`.`,
    `- Environnements (aligned, cases, matrix) → enveloppe dans \`$$...$$\`.`,
    `- VÉRIFIE que chaque \`{\` a son \`}\` (très important pour \`\\boxed{...}\`).`,
    `- Markdown : chaque titre \`###\`, séparateur \`---\`, et \`$$\` sur SA PROPRE LIGNE, jamais collé à du texte.`,
    `- JAMAIS de \`$\` à l'intérieur d'un autre \`$\` ou \`$$\` (pas de "math dans la math").`,
    ``,
    `=== EXEMPLE DE STRUCTURE ATTENDUE ===`,
    `\`\`\``,
    `## Vue d'ensemble`,
    ``,
    `L'exercice consiste à calculer une intégrale.`,
    ``,
    `## Étape 1 — Méthode`,
    ``,
    `On utilise la formule du discriminant.`,
    ``,
    `> **Rappel** : pour $az^2 + bz + c = 0$, $\\Delta = b^2 - 4ac$.`,
    ``,
    `## Étape 2 — Calcul`,
    ``,
    `Le discriminant vaut`,
    ``,
    `$$`,
    `\\Delta = b^2 - 4ac = (2\\sin\\alpha)^2 - 4 \\cdot 1 \\cdot (-2\\sin\\alpha)`,
    `$$`,
    ``,
    `Donc...`,
    `\`\`\``,
    ``,
    `Sois bienveillant, concis, et précis. **Respect ABSOLU des sauts de ligne** : un \`$$\` doit toujours avoir une ligne vide avant et après.`,
  ]
    .filter(Boolean)
    .join("\n");
}

export function buildExplainUserPrompt(
  exercise: string,
  correction: string,
  focusQuestion?: string,
): string {
  const trimmedFocus = focusQuestion?.trim();
  const focusBlock = trimmedFocus
    ? `\n\n⚠️ FOCUS — L'élève veut comprendre UNIQUEMENT cette partie :
"""
${trimmedFocus}
"""

N'explique QUE la portion de la correction qui concerne cette partie. Ignore le reste.`
    : "";

  return `ÉNONCÉ DE L'EXERCICE :
"""
${exercise}
"""

CORRECTION (DÉJÀ RÉDIGÉE) DONT L'ÉLÈVE A BESOIN D'EXPLICATIONS :
"""
${correction}
"""${focusBlock}

Explique cette correction en détail, en suivant fidèlement son raisonnement. Pour chaque étape :
- Cite (brièvement, en italique) ce que dit la correction.
- Justifie la transformation (quelle règle ? quel calcul ?).
- Si un saut logique existe, comble-le.

Termine par "## 💡 À retenir" avec les 2-3 points-clés à mémoriser.`;
}
