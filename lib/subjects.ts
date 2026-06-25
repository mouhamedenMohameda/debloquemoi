/**
 * Source unique des matières et chapitres côté mobile.
 * Doit rester synchronisé avec `Bac/app/src/lib/subjects.ts` (mêmes ids).
 *
 * On ne porte PAS le champ `pedagogy` (volumineux, utilisé côté serveur
 * Next.js pour construire le system prompt).
 */

export type Chapter = { id: string; name: string };

export type Subject = {
  id: string;
  name: string;
  shortName: string; // pour les boutons compacts
  emoji: string;
  chapters: Chapter[];
};

export const SUBJECTS: Subject[] = [
  {
    id: "math",
    name: "Mathématiques",
    shortName: "Maths",
    emoji: "📐",
    chapters: [
      { id: "arithmetique", name: "Arithmétique" },
      { id: "complexes", name: "Nombres complexes" },
      { id: "matrices", name: "Matrices et systèmes linéaires" },
      { id: "suites", name: "Suites numériques" },
      { id: "fonctions", name: "Études de fonctions" },
      { id: "primitives", name: "Primitives et intégrales" },
      { id: "equations-diff", name: "Équations différentielles" },
      { id: "geometrie-espace", name: "Géométrie dans l'espace" },
      { id: "geometrie-plan", name: "Géométrie plane" },
      { id: "probabilites", name: "Probabilités et dénombrement" },
      { id: "statistiques", name: "Statistiques" },
      { id: "autre", name: "Autre / Je ne sais pas" },
    ],
  },
  {
    id: "physique",
    name: "Physique",
    shortName: "Physique",
    emoji: "⚛️",
    chapters: [
      { id: "cinematique", name: "Cinématique" },
      { id: "dynamique", name: "Dynamique (lois de Newton)" },
      { id: "energie", name: "Énergie mécanique" },
      { id: "oscillateurs", name: "Oscillateurs mécaniques" },
      { id: "champ-gravitation", name: "Champ de gravitation / satellites" },
      { id: "champ-magnetique", name: "Champ magnétique" },
      { id: "induction", name: "Induction électromagnétique" },
      { id: "force-laplace", name: "Force de Laplace et de Lorentz" },
      { id: "circuits-rc-rl", name: "Circuits RC, RL, RLC" },
      { id: "courant-alternatif", name: "Courant alternatif sinusoïdal" },
      { id: "ondes-mecaniques", name: "Ondes mécaniques" },
      { id: "ondes-stationnaires", name: "Ondes stationnaires" },
      { id: "photoelectrique", name: "Effet photoélectrique" },
      { id: "noyau-radioactivite", name: "Noyau et radioactivité" },
      { id: "autre", name: "Autre / Je ne sais pas" },
    ],
  },
  {
    id: "chimie",
    name: "Chimie",
    shortName: "Chimie",
    emoji: "🧪",
    chapters: [
      { id: "alcanes-alcenes", name: "Alcanes, alcènes, alcynes" },
      { id: "alcools-aldehydes", name: "Alcools, aldéhydes, cétones" },
      { id: "acides-esters", name: "Acides carboxyliques et esters" },
      { id: "amines-amides", name: "Amines et amides" },
      { id: "polymeres", name: "Polymères" },
      { id: "vitesse-reaction", name: "Vitesse de réaction" },
      { id: "ordre-reaction", name: "Ordre et catalyse" },
      { id: "ph-acide-base", name: "pH et couples acide/base" },
      { id: "dosages", name: "Dosages acide-base" },
      { id: "solubilite", name: "Solubilité et Ks" },
      { id: "oxydoreduction", name: "Oxydoréduction" },
      { id: "autre", name: "Autre / Je ne sais pas" },
    ],
  },
  {
    id: "svt",
    name: "Sciences naturelles",
    shortName: "SVT",
    emoji: "🧬",
    chapters: [
      { id: "reproduction-mam", name: "Reproduction des mammifères" },
      { id: "cycle-sexuel", name: "Cycle sexuel et hormones" },
      { id: "mendelienne", name: "Génétique mendélienne" },
      { id: "groupes-sanguins", name: "Génétique humaine" },
      { id: "chromosomes", name: "Chromosomes et anomalies" },
      { id: "neurone", name: "Le neurone et potentiel d'action" },
      { id: "synapse", name: "Synapse et transmission" },
      { id: "reflexe", name: "Réflexes et arc réflexe" },
      { id: "tectonique", name: "Tectonique des plaques" },
      { id: "stratigraphie", name: "Stratigraphie et fossiles" },
      { id: "geologie-mauritanie", name: "Géologie de la Mauritanie" },
      { id: "autre", name: "Autre / Je ne sais pas" },
    ],
  },
];

export function getSubject(id: string): Subject | undefined {
  return SUBJECTS.find((s) => s.id === id);
}
