import { redirect } from "next/navigation";
import Link from "next/link";

import {
  AuthApiError,
  adminListTopups,
  adminStats,
  me,
  type AdminTopupRequest,
  type AdminStats,
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
  let stats: AdminStats | null = null;
  try {
    const [r, statsRes] = await Promise.all([
      adminListTopups(jwt, currentTab),
      adminStats(jwt, "debloquemoi").catch((e) => {
        console.error("[adminStats error]", e);
        return null;
      }),
    ]);
    rows = r.requests;
    stats = statsRes;
  } catch (e) {
    error = e instanceof AuthApiError ? e.message : "Erreur de chargement.";
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-2xl font-extrabold text-slate-900">🛡️ Admin — recharges</h1>
        <div className="flex items-center gap-3">
          <Link
            href="/admin/exercices"
            className="text-xs font-semibold text-indigo-600 underline-offset-2 hover:underline"
          >
            Exercices →
          </Link>
          <Link
            href="/admin/cours"
            className="text-xs font-semibold text-indigo-600 underline-offset-2 hover:underline"
          >
            Cours →
          </Link>
          <Link
            href="/admin/users"
            className="text-xs font-semibold text-indigo-600 underline-offset-2 hover:underline"
          >
            Utilisateurs →
          </Link>
        </div>
      </div>
      <p className="mt-1 text-sm text-slate-600">
        Valide ou rejette les demandes de top-up en attente.
      </p>

      {/* ── Cartes métriques financières ─────────────────────────────── */}
      {stats && (
        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
          {/* Carte 1 : Ce que les users ont payé */}
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">💳 Recharges users</p>
            <p className="mt-1 text-2xl font-extrabold tabular-nums text-slate-900">
              {stats.total_topups_mru.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              <span className="ml-1 text-sm font-semibold text-slate-400">MRU</span>
            </p>
            <p className="mt-1 text-[10px] text-slate-400">Total déposé par les utilisateurs</p>
          </div>

          {/* Carte 2 : Ce que j'ai payé aux modèles (coût API estimé) */}
          <div className="rounded-2xl border border-orange-100 bg-orange-50 p-4 shadow-sm">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-orange-600">🤖 Coût API (estimé)</p>
            <p className="mt-1 text-2xl font-extrabold tabular-nums text-orange-700">
              {stats.estimated_provider_cost_mru.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              <span className="ml-1 text-sm font-semibold text-orange-400">MRU</span>
            </p>
            <p className="mt-1 text-[10px] text-orange-400">Facturé ÷ marge ×{stats.margin_multiplier.toFixed(2)}</p>
          </div>

          {/* Carte 3 : Ce que j'ai gagné */}
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 shadow-sm">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-600">💰 Bénéfice net (estimé)</p>
            <p className="mt-1 text-2xl font-extrabold tabular-nums text-emerald-700">
              {stats.estimated_profit_mru.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              <span className="ml-1 text-sm font-semibold text-emerald-400">MRU</span>
            </p>
            <p className="mt-1 text-[10px] text-emerald-500">Facturé − coût API = {stats.total_billed_mru.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} MRU facturés</p>
          </div>
        </div>
      )}

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
