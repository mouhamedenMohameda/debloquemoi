/**
 * /bac — « Mes annales » : l'élève photographie un exercice et voit le
 * chapitre, les notions, les années où elles sont tombées au bac, les
 * corrections et les cours (chapitres publiés par l'admin uniquement).
 */
import { redirect } from "next/navigation";

import { AuthApiError, me } from "@/lib/auth-api";
import { getJwt, getSession } from "@/lib/session";

import { BacClient } from "./BacClient";

export const metadata = {
  title: "Débloque-moi · Mes annales",
};

export default async function BacPage() {
  const session = await getSession();
  if (!session) redirect("/login?next=/bac");
  const jwt = await getJwt();
  let filiere: string | null = null;
  if (jwt) {
    try {
      filiere = (await me(jwt)).user.bac_filiere ?? null;
    } catch (e) {
      if (e instanceof AuthApiError && e.status === 401) redirect("/login?next=/bac");
    }
  }
  return <BacClient initialFiliere={filiere === "C" || filiere === "D" ? filiere : null} />;
}
