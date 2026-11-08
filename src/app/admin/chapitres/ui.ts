/** Helpers partagés (client + serveur) des pages /admin/chapitres/*. */

export const MATIERE_LABEL: Record<string, string> = {
  math: "Mathématiques",
  pc: "Sciences Physiques",
  svt: "Sciences Naturelles",
};

export function chapterHref(
  base: "/admin/chapitres/atelier" | "/admin/chapitres/apercu",
  s: { filiere_id: string; matiere_id: string; chapitre: string },
): string {
  const qs = new URLSearchParams({
    filiere: s.filiere_id,
    matiere: s.matiere_id,
    chapitre: s.chapitre,
  });
  return `${base}?${qs.toString()}`;
}

export function scopeQuery(s: { filiere_id: string; matiere_id: string; chapitre: string }): string {
  return new URLSearchParams({
    filiere: s.filiere_id,
    matiere: s.matiere_id,
    chapitre: s.chapitre,
  }).toString();
}
