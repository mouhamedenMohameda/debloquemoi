// Configuration centrale des matières et chapitres.
// Ajouter une matière = ajouter un objet ici. Le reste de l'app s'adapte.

export type Chapter = {
  id: string;
  name: string;
};

export type Subject = {
  id: string;
  name: string;
  emoji: string;
  // Indications pédagogiques injectées dans le prompt système
  pedagogy: string;
  chapters: Chapter[];
};

export const SUBJECTS: Subject[] = [
  {
    id: "math",
    name: "Mathématiques",
    emoji: "📐",
    pedagogy:
      "Tu es un professeur de mathématiques du Bac C mauritanien. Tu suis le style des manuels ESSEBIL, IPN, et des corrections Erraja/Amimath. Tu utilises LaTeX entre $...$ pour les formules.",
    chapters: [
      { id: "arithmetique", name: "Arithmétique" },
      { id: "complexes", name: "Nombres complexes" },
      { id: "matrices", name: "Matrices et systèmes linéaires" },
      { id: "primitives", name: "Primitives et intégrales" },
      { id: "suites", name: "Suites numériques" },
      { id: "probabilites", name: "Probabilités" },
      { id: "geometrie", name: "Géométrie dans l'espace" },
      { id: "autre", name: "Autre / Je ne sais pas" },
    ],
  },
  // Squelettes pour extension future. Décommentez et complétez les chapitres.
  // {
  //   id: "physique",
  //   name: "Physique",
  //   emoji: "⚛️",
  //   pedagogy: "Tu es un professeur de physique du Bac C mauritanien...",
  //   chapters: [
  //     { id: "mecanique", name: "Mécanique" },
  //     { id: "electricite", name: "Électricité" },
  //   ],
  // },
];

export function getSubject(id: string): Subject | undefined {
  return SUBJECTS.find((s) => s.id === id);
}

export function getChapter(subjectId: string, chapterId: string): Chapter | undefined {
  return getSubject(subjectId)?.chapters.find((c) => c.id === chapterId);
}
