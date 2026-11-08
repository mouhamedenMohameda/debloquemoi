// Détection des questions d'un énoncé — partagée par le client (bouton
// « Corriger les N questions ») et le serveur (contrôle de couverture).

// Détecte les marqueurs de sous-questions (1°, 2° a), b), Question 3...).
// - Normalise la sortie OCR LaTeX (^\circ, \circ, \degree) en ° littéral.
// - Évite les faux positifs comme "(1)" en exigeant le symbole °.
export function detectSubQuestions(text: string): string[] {
  if (!text) return [];

  const norm = text
    .replace(/\^\s*\\?circ/g, "°")
    .replace(/\\degree/g, "°")
    .replace(/º/g, "°");

  type Hit = { type: "num" | "sub" | "q"; value: string; pos: number };
  const hits: Hit[] = [];

  // Préfixes Markdown acceptés en début de ligne avant le marqueur de question :
  // - `#` titres (## 1., ### 2., etc.)
  // - `*`/`_` gras (**1.** , __1__)
  // - `>` blockquote
  // - puces (`-`, `•`)
  // - espaces
  const MD = `[\\s#*_>\\-•]*`;

  // NB: toutes les regex utilisent le flag `u` (Unicode) pour reconnaître
  // les lettres accentuées (É, È, Œ, Ç, etc.) via la classe \p{L}.

  // Style "1°" (Bac C classique). Peut apparaître après marqueurs MD ou
  // mid-texte après un non-mot.
  for (const m of norm.matchAll(
    new RegExp(`(?:^|\\n|[^\\w])${MD}(\\d{1,2})\\s*°`, "gu"),
  )) {
    hits.push({ type: "num", value: `${m[1]}°`, pos: m.index ?? 0 });
  }
  // Style "1." en début de ligne (avec marqueurs MD optionnels), suivi d'espace
  // + n'importe quelle lettre Unicode (couvre É, È, Œ, Ç, Î, etc.) ou `(`.
  for (const m of norm.matchAll(
    new RegExp(`(?:^|\\n)${MD}(\\d{1,2})\\.\\s+(?=[\\p{L}(])`, "gu"),
  )) {
    hits.push({ type: "num", value: `${m[1]}.`, pos: m.index ?? 0 });
  }
  // Style "1)" en début de ligne (avec marqueurs MD), pas précédé de "(".
  for (const m of norm.matchAll(
    new RegExp(`(?:^|\\n)${MD}(?<!\\()(\\d{1,2})\\)\\s+(?=\\p{L})`, "gu"),
  )) {
    hits.push({ type: "num", value: `${m[1]})`, pos: m.index ?? 0 });
  }
  // Sous-lettre "a)" suivie d'une majuscule Unicode (ou guillemet français).
  for (const m of norm.matchAll(
    /(?:^|[^\w°])([a-z])\s*\)(?=\s*[\p{Lu}«])/gu,
  )) {
    hits.push({ type: "sub", value: `${m[1]})`, pos: m.index ?? 0 });
  }
  // "Question N" avec lettre optionnelle.
  for (const m of norm.matchAll(/(?:^|[^\w])Question\s+(\d+[a-z]?)/giu)) {
    hits.push({ type: "q", value: `Question ${m[1]}`, pos: m.index ?? 0 });
  }
  // Style "N-M" ou "N.M" (sous-numérotation par tiret ou point : 2-1, 3.1...).
  // Très utilisé dans les sujets de physique-chimie du Bac. On accepte aussi
  // les espaces autour du séparateur (3 - 1, 3 .1) et les démarrages mid-ligne
  // après une ponctuation de phrase.
  for (const m of norm.matchAll(
    new RegExp(
      `(?:^|\\n|(?<=[.;)])\\s+)${MD}(\\d{1,2}\\s*[-‑–.]\\s*(?:\\d{1,2}|[a-z]))\\s+(?=\\p{L})`,
      "gu",
    ),
  )) {
    // Normalise : enlève les espaces internes pour avoir "3-1" propre.
    const value = m[1].replace(/\s+/g, "");
    hits.push({ type: "q", value, pos: m.index ?? 0 });
  }
  // Style "N " (chiffre seul + espace + majuscule, sans ponctuation).
  // Pour les sujets où "1 Ecrire ...", "2 Tracer ..." apparaissent en début
  // de ligne. Plus risqué : on exige une majuscule juste après pour éviter
  // de prendre "il y a 5 espèces..." comme un marqueur.
  for (const m of norm.matchAll(
    new RegExp(`(?:^|\\n)${MD}(\\d{1,2})\\s+(?=\\p{Lu})`, "gu"),
  )) {
    // On crée des marqueurs "N°" qui s'agrègent comme les autres.
    hits.push({ type: "num", value: `${m[1]}`, pos: m.index ?? 0 });
  }

  hits.sort((a, b) => a.pos - b.pos);

  let currentSection: string | null = null;
  const results: string[] = [];
  const sectionsWithChildren = new Set<string>();

  for (const h of hits) {
    if (h.type === "num") {
      currentSection = h.value;
      results.push(currentSection);
    } else if (h.type === "sub") {
      const label = currentSection ? `${currentSection} ${h.value}` : h.value;
      if (currentSection) sectionsWithChildren.add(currentSection);
      results.push(label);
    } else {
      // type "q" — peut être "Question N", "N-M" ou "N.M".
      // Si c'est sous-numérotation, on marque le parent comme ayant des enfants.
      const parent = /^(\d{1,2})[-‑–.]/.exec(h.value);
      if (parent) {
        // Le parent peut exister sous différents formats : "3", "3.", "3°"
        sectionsWithChildren.add(parent[1]);
        sectionsWithChildren.add(`${parent[1]}.`);
        sectionsWithChildren.add(`${parent[1]}°`);
        sectionsWithChildren.add(`${parent[1]})`);
      }
      currentSection = null;
      results.push(h.value);
    }
  }

  const seen = new Set<string>();
  return results.filter((r) => {
    if (sectionsWithChildren.has(r)) return false;
    if (seen.has(r)) return false;
    seen.add(r);
    return true;
  });
}

/**
 * Numéros de questions de premier niveau ("1", "2", "3"…) d'un énoncé.
 * Sert au contrôle de couverture côté serveur : chaque numéro de l'énoncé
 * doit avoir une réponse.
 */
export function topLevelQuestionNumbers(exercise: string): string[] {
  const nums = new Set<string>();
  for (const q of detectSubQuestions(exercise)) {
    const m = /^(?:Question\s+)?(\d{1,2})/.exec(q);
    if (m) nums.add(String(Number(m[1])));
  }
  return [...nums].sort((a, b) => Number(a) - Number(b));
}

/** Le texte de la réponse contient-il un en-tête pour la question `n` ? */
function answerCovers(answer: string, n: string): boolean {
  const norm = answer.replace(/\^\s*\\?circ/g, "°").replace(/º/g, "°");
  const re = new RegExp(
    // "## Question 2° a)", "**2°**", "2.", "2)", "2-1", "2.1", "السؤال 2"
    `(?:^|\\n)[\\s#*_>\\-•]*(?:(?:Question|Q|السؤال)\\s*)?${n}(?!\\d)\\s*(?:°|\\.|\\)|[-‑–]|\\s*[a-h]\\)|\\*|$|\\s)`,
    "giu",
  );
  return re.test(norm);
}

/**
 * Questions de premier niveau de l'énoncé absentes de la réponse.
 * Renvoie [] si l'énoncé n'a pas (ou qu'une seule) question numérotée :
 * dans ce cas on ne peut rien vérifier.
 */
export function missingQuestions(exercise: string, answer: string): string[] {
  const nums = topLevelQuestionNumbers(exercise);
  if (nums.length < 2) return [];
  return nums.filter((n) => !answerCovers(answer, n));
}
