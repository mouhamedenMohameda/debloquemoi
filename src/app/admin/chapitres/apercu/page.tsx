/**
 * /admin/chapitres/apercu?filiere&matiere&chapitre — le chapitre exactement
 * comme l'élève le verra une fois publié, avec les avertissements admin.
 */
import { AdminOnly } from "../AdminOnly";
import { ApercuClient } from "./ApercuClient";

export const metadata = {
  title: "Admin · Aperçu élève",
};

type Props = {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

function one(v: string | string[] | undefined): string {
  return Array.isArray(v) ? v[0] ?? "" : v ?? "";
}

export default async function ApercuPage({ searchParams }: Props) {
  const sp = await searchParams;
  const scope = {
    filiere_id: one(sp.filiere),
    matiere_id: one(sp.matiere),
    chapitre: one(sp.chapitre),
  };
  const next = `/admin/chapitres/apercu?${new URLSearchParams({
    filiere: scope.filiere_id,
    matiere: scope.matiere_id,
    chapitre: scope.chapitre,
  }).toString()}`;
  return (
    <AdminOnly next={next}>
      <ApercuClient scope={scope} />
    </AdminOnly>
  );
}
