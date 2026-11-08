/**
 * /admin/chapitres — grille série × matière × chapitre : statut de
 * publication et checklist de préparation. Un chapitre en brouillon n'est
 * jamais visible par les élèves.
 */
import { AdminOnly } from "./AdminOnly";
import { ChapitresGrid } from "./ChapitresGrid";

export const metadata = {
  title: "Admin · Chapitres",
};

export default async function AdminChapitresPage() {
  return (
    <AdminOnly next="/admin/chapitres">
      <ChapitresGrid />
    </AdminOnly>
  );
}
