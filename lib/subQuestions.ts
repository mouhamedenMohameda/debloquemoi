/**
 * Détection automatique des sous-questions dans un énoncé.
 *
 * COPIE VERBATIM de `Bac/app/src/app/HomeClient.tsx` (function detectSubQuestions).
 * Toute modification doit être faite dans les deux endroits pour rester
 * cohérente entre le web et le mobile.
 */

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
  // Très utilisé dans les sujets de physique-chimie du Bac.
  for (const m of norm.matchAll(
    new RegExp(
      `(?:^|\\n|(?<=[.;)])\\s+)${MD}(\\d{1,2}\\s*[-‑–.]\\s*(?:\\d{1,2}|[a-z]))\\s+(?=\\p{L})`,
      "gu",
    ),
  )) {
    const value = m[1].replace(/\s+/g, "");
    hits.push({ type: "q", value, pos: m.index ?? 0 });
  }
  // Style "N " (chiffre seul + espace + majuscule, sans ponctuation).
  for (const m of norm.matchAll(
    new RegExp(`(?:^|\\n)${MD}(\\d{1,2})\\s+(?=\\p{Lu})`, "gu"),
  )) {
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
      const parent = /^(\d{1,2})[-‑–.]/.exec(h.value);
      if (parent) {
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
