import type { Subject, Chapter } from "./subjects";

export type HintLevel = 1 | 2 | 3;
export type AppMode = "correct" | "explain";

const LEVEL_INSTRUCTIONS: Record<HintLevel, string> = {
  1: `Donne UN SEUL indice TRÈS LÉGER. Pas de calcul, pas de formule complète, pas de réponse.
- 1 à 2 phrases.
- Pose plutôt une question qui oriente vers la bonne notion.
- Si tu évoques une propriété, **nomme-la explicitement** (pas d'allusion vague).
- Exemple : "As-tu pensé à écrire z sous forme trigonométrique ? Que devient |z|² alors ?"`,

  2: `Donne UN INDICE PLUS PRÉCIS. L'élève est toujours bloqué.
- 2 à 5 phrases.
- Énonce **explicitement** le théorème, la définition ou la formule à utiliser (nom + énoncé complet).
- Indique la première étape concrète.
- Ne donne PAS le résultat final ni les calculs.`,

  3: `Donne la SOLUTION COMPLÈTE, étape par étape, style correction Erraja/Amimath.

⚠️ RÈGLES ABSOLUES DE FORMAT — à respecter SOUS PEINE D'ÉCHEC :

A. **Sauts de ligne obligatoires** : un \`$$\` doit toujours être seul sur sa ligne, avec une ligne vide avant ET après. Pareil pour les titres \`##\`/\`###\` et les séparateurs \`---\`.

B. **LaTeX inline** : \`$...$\` uniquement. JAMAIS \`\\(...\\)\`.

C. **LaTeX bloc** : \`$$...$$\` uniquement, jamais \`\\[...\\]\`.

D. **JAMAIS de \`$\` à l'intérieur d'un autre bloc math.**

E. **Vérifie les accolades** : chaque \`{\` a son \`}\`. Surtout \`\\boxed{...}\`.

F. **Environnements LaTeX** (aligned, cases, matrix) → DOIVENT être dans \`$$\\begin{...}...\\end{...}$$\`.

==========================================
RÈGLES DE STRUCTURE (à respecter strictement)
==========================================

1. **Identifier d'abord ce qui est demandé** (1 phrase, en italique) — quoi prouver/calculer/construire.

2. **Méthode** (1-2 phrases) — l'idée stratégique.

3. **Résolution** : utilise des sous-titres \`### Étape 1 — ...\`, \`### Étape 2 — ...\` etc. Une étape = une transformation logique.

4. **Rappels de cours** : à PLACER dans un blockquote \`> **Rappel :** énoncé complet de la règle\`.
   ⚠️ CHAQUE règle est rappelée **UNE SEULE FOIS** dans toute la réponse. Si tu la réutilises plus loin, dis simplement "par le rappel précédent" ou nomme-la, **ne la réécris JAMAIS**.

5. **Conclusion** : section \`### Conclusion\` avec le résultat **en gras**.

6. **💡 À retenir** : section finale, 1-2 puces clés.

==========================================
RÈGLES DE FOND
==========================================

- **Aucune règle utilisée sans rappel préalable.** Mais : *un seul rappel par règle*, point.
- **Aucune étape implicite** : nomme chaque transformation ("on factorise", "on identifie parties réelles", etc.).
- **Aucun raccourci de calcul** : un bachelier doit pouvoir suivre.
- **LaTeX — RÈGLE ABSOLUE** : **chaque** commande LaTeX (\`\\frac\`, \`\\sqrt\`, \`\\ge\`, \`\\le\`, \`\\quad\`, \`\\int\`, \`\\lim\`, \`\\overrightarrow\`, \`\\mathbb\`, \`\\boxed\`, \`x^2\`, \`x_n\`, etc.) **DOIT** être entourée de \`$...$\` (inline) ou \`$$...$$\` (bloc).
  - ✅ "Pour tout $x > 2$, on a $\\sqrt{x^2-4} \\ge 0$, donc $f$ est définie."
  - ❌ "Pour tout x > 2, on a \\sqrt{x^2-4} \\ge 0, donc f est définie." (le LaTeX s'affichera en brut)
  - ❌ "$$ x^2-4 \\ge 0 \\quad \\Longrightarrow \\quad \\sqrt{x^2-4} \\ge 0 $$" écrit sans les \`$$\` autour
  - **Tu n'utilises JAMAIS** \`\\[ ... \\]\` ni \`\\( ... \\)\` — uniquement \`$...$\` et \`$$...$$\`.
  - **Tu n'utilises JAMAIS** \`;\` comme séparateur dans une formule LaTeX. Utilise un espace normal ou \`\\,\`.
- **Markdown** : les titres (\`#\`, \`##\`, \`###\`) **DOIVENT** commencer en début de ligne, avec une ligne vide avant et après. Ne mets JAMAIS un \`###\` au milieu d'un paragraphe.
- **Pas de schéma ASCII** des courbes. Décris la courbe en mots (point d'entrée, monotonie, asymptotes, point de sortie) si nécessaire, mais ne dessine pas avec des \`|\` et des \`/\`.
- **Sauts de ligne** : laisse une ligne vide entre chaque section. Pas de murs de texte.
- **Va jusqu'au bout** — pas de limite de longueur, mais pas de remplissage non plus.

EXEMPLE de structure attendue :

> *On veut montrer que K est le milieu de [AB].*
>
> **Méthode** : on exprime $\\overrightarrow{AK}$ en fonction de $\\overrightarrow{AB}$.
>
> ### Étape 1 — Utiliser la définition du barycentre
>
> > **Rappel :** Le barycentre $G$ d'un système $(A_i, m_i)_{1\\le i\\le n}$ vérifie $\\sum m_i \\overrightarrow{GA_i} = \\vec 0$.
>
> Ici, $K$ est le barycentre de $(A, 1), (B, 1)$, donc... [calculs]
>
> ### Étape 2 — ...
>
> ### Conclusion
>
> **K est le milieu de [AB].** $\\blacksquare$
>
> **💡 À retenir** : ...`,
};

export function buildSystemPrompt(subject: Subject, chapter?: Chapter): string {
  return [
    subject.pedagogy,
    chapter ? `Chapitre concerné : ${chapter.name}.` : "",
    `Tu réponds toujours en français.`,
    ``,
    `=== PROTOCOLE DE LECTURE OBLIGATOIRE ===`,
    `Avant TOUT calcul, tu DOIS :`,
    `1. Re-lire l'énoncé en entier, lentement, et identifier CHAQUE détail : intervalle de définition, bornes d'intégrale (note bien numérateur ET dénominateur), conditions sur les paramètres, fonction étudiée précisément.`,
    `2. Recopier les éléments clés dans une section "📋 Données :" en début de réponse.`,
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
    `3. Tu démontres TOUT : "f(x) < x" se prouve en étudiant g(x) = f(x) - x. "f(x) ~ ln(2x) en +∞" se prouve par factorisation et passage à la limite.`,
    `4. Tu choisis la méthode la PLUS SIMPLE qui aboutit. Préférer la dérivée d'une composée à L'Hôpital. Préférer une factorisation à un développement de Taylor.`,
    `5. Tu ne JAMAIS donner la réponse complète tant qu'on ne te demande pas explicitement le niveau 3.`,
    ``,
    `=== GESTION MULTI-QUESTIONS ===`,
    `Si l'énoncé contient PLUSIEURS questions, tu les traites TOUTES par défaut (chacune sous un titre \`## Question 1°\`, \`## Question 2° a)\`, etc.) — sauf si un FOCUS explicite est précisé dans le message utilisateur, auquel cas tu te limites strictement à cette partie.`,
    ``,
    `Sois bienveillant, encourageant, mais ABSOLUMENT RIGOUREUX.`,
  ]
    .filter(Boolean)
    .join("\n");
}

export function buildUserPrompt(
  exercise: string,
  level: HintLevel,
  previousHints: string[],
  focusQuestion?: string,
  treatAll = false,
): string {
  const trimmedFocus = focusQuestion?.trim();
  let focusBlock = "";
  if (trimmedFocus) {
    focusBlock = `\n\n⚠️ FOCUS — L'élève est bloqué UNIQUEMENT sur :
"""
${trimmedFocus}
"""

Traite SEULEMENT cette partie. N'aborde pas les autres questions. Si tu as besoin du résultat d'une question précédente, mentionne-le sans le redémontrer : "*On admet le résultat de la question X : ...*".`;
  } else if (treatAll) {
    focusBlock = `\n\n✦ TOUT L'EXERCICE — L'élève veut la correction de l'intégralité de l'énoncé.

Traite TOUTES les questions, dans l'ordre. Pour chaque question, ajoute un titre \`## Question 1°\`, \`## Question 2° a)\` etc. avant de la traiter.

Les rappels de cours restent uniques : si une règle est utilisée dans plusieurs questions, tu la rappelles à sa PREMIÈRE utilisation seulement, puis tu fais référence à elle plus loin par "par le rappel précédent" ou "d'après [nom de la règle]".`;
  }

  const history =
    previousHints.length > 0
      ? `\n\nIndices déjà donnés (NE TE RÉPÈTE PAS, complète) :\n${previousHints
          .map((h, i) => `--- Indice ${i + 1} ---\n${h}`)
          .join("\n\n")}`
      : "";

  return `Énoncé :
"""
${exercise}
"""${focusBlock}

Niveau d'aide : ${level} sur 3.

${LEVEL_INSTRUCTIONS[level]}${history}`;
}

// === Mode "Expliquer une correction existante" ===

export function buildExplainSystemPrompt(
  subject: Subject,
  chapter?: Chapter,
): string {
  return [
    subject.pedagogy,
    chapter ? `Chapitre concerné : ${chapter.name}.` : "",
    `Tu réponds toujours en français.`,
    ``,
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
