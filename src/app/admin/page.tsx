import { redirect } from "next/navigation";
import Link from "next/link";

import {
  AuthApiError,
  adminListTopups,
  me,
  type AdminTopupRequest,
} from "@/lib/auth-api";
import { getJwt } from "@/lib/session";
import { TopupRow } from "./TopupRow";

export const metadata = {
  title: "Admin — Débloque-moi",
};

type Tab = "pending" | "approved" | "rejected" | "all";
const TABS: { id: Tab; label: string }[] = [
  { id: "pending", label: "En attente" },
  { id: "approved", label: "Approuvées" },
  { id: "rejected", label: "Rejetées" },
  { id: "all", label: "Toutes" },
];

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const jwt = await getJwt();
  if (!jwt) redirect("/login?next=/admin");

  // Vérifier admin via auth-api (source de vérité)
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
    if (e instanceof AuthApiError && e.status === 401) redirect("/login?next=/admin");
    throw e;
  }

  const sp = await searchParams;
  const currentTab: Tab = (TABS.find((t) => t.id === sp.status)?.id) ?? "pending";

  let rows: AdminTopupRequest[] = [];
  let error: string | null = null;
  try {
    const r = await adminListTopups(jwt, currentTab);
    rows = r.requests;
  } catch (e) {
    error = e instanceof AuthApiError ? e.message : "Erreur de chargement.";
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-2xl font-extrabold text-slate-900">🛡️ Admin — recharges</h1>
        <Link
          href="/admin/users"
          className="text-xs font-semibold text-indigo-600 underline-offset-2 hover:underline"
        >
          Utilisateurs →
        </Link>
      </div>
      <p className="mt-1 text-sm text-slate-600">
        Valide ou rejette les demandes de top-up en attente.
      </p>

      {/* Tabs */}
      <nav className="mt-5 flex gap-1.5 overflow-x-auto pb-1">
        {TABS.map((t) => {
          const isActive = t.id === currentTab;
          return (
            <Link
              key={t.id}
              href={`/admin?status=${t.id}`}
              className={[
                "shrink-0 rounded-full px-3.5 py-1.5 text-xs font-semibold transition",
                isActive
                  ? "bg-slate-900 text-white shadow-md"
                  : "bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50",
              ].join(" ")}
            >
              {t.label}
            </Link>
          );
        })}
      </nav>

      {error && (
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          ⚠️ {error}
        </div>
      )}

      <section className="mt-4">
        {rows.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
            Aucune demande {currentTab !== "all" ? `(${TABS.find((t) => t.id === currentTab)?.label.toLowerCase()})` : ""}.
          </p>
        ) : (
          <ul className="space-y-3">
            {rows.map((r) => (
              <TopupRow key={r.id} row={r} />
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
