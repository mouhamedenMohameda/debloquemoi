/**
 * /admin/chapitres/atelier?filiere&matiere&chapitre — atelier d'un chapitre :
 * notions retenues, cours par notion, exercices (énoncé, correction,
 * validation), publication.
 */
import { AdminOnly } from "../AdminOnly";
import { ChapterWorkspace } from "./ChapterWorkspace";

export const metadata = {
  title: "Admin · Atelier chapitre",
};

type Props = {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

function one(v: string | string[] | undefined): string {
  return Array.isArray(v) ? v[0] ?? "" : v ?? "";
}

export default async function AtelierPage({ searchParams }: Props) {
  const sp = await searchParams;
  const scope = {
    filiere_id: one(sp.filiere),
    matiere_id: one(sp.matiere),
    chapitre: one(sp.chapitre),
  };
  const next = `/admin/chapitres/atelier?${new URLSearchParams({
    filiere: scope.filiere_id,
    matiere: scope.matiere_id,
    chapitre: scope.chapitre,
  }).toString()}`;
  return (
    <AdminOnly next={next}>
      <ChapterWorkspace scope={scope} />
    </AdminOnly>
  );
}
