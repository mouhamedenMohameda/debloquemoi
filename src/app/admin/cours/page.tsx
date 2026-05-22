/**
 * /admin/cours — génération et édition de cours par notion.
 *
 * Server component : vérifie auth + admin, puis monte le client component.
 * Le client (CoursEditor) parle aux routes /api/admin/courses/*.
 */
import { redirect } from "next/navigation";
import Link from "next/link";

import { AuthApiError, me } from "@/lib/auth-api";
import { getJwt } from "@/lib/session";

import { CoursEditor } from "./CoursEditor";

export const metadata = {
  title: "Admin · Cours par notion",
};

export default async function AdminCoursPage() {
  const jwt = await getJwt();
  if (!jwt) redirect("/login?next=/admin/cours");

  try {
    const r = await me(jwt);
    if (!r.user.is_admin) {
      return (
        <main className="mx-auto max-w-2xl px-4 py-16 text-center">
          <h1 className="text-2xl font-extrabold text-slate-900">🚫 Accès refusé</h1>
          <p className="mt-2 text-sm text-slate-600">
            Cette page est réservée aux administrateurs.
          </p>
          <Link
            href="/"
            className="mt-6 inline-block rounded-full bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-indigo-700"
          >
            Retour à l&apos;accueil
          </Link>
        </main>
      );
    }
  } catch (e) {
    if (e instanceof AuthApiError && e.status === 401) {
      redirect("/login?next=/admin/cours");
    }
    throw e;
  }

  return <CoursEditor />;
}
