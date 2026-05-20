import { redirect } from "next/navigation";
import Link from "next/link";

import {
  AuthApiError,
  adminListUsers,
  adminStats,
  me,
  type AdminUserSummary,
  type AdminStats,
} from "@/lib/auth-api";
import { getJwt } from "@/lib/session";
import { UserRow } from "./UserRow";

export const metadata = {
  title: "Admin — Utilisateurs",
};

const PAGE_SIZE = 50;

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; offset?: string }>;
}) {
  const jwt = await getJwt();
  if (!jwt) redirect("/login?next=/admin/users");

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
            Retour
          </Link>
        </main>
      );
    }
  } catch (e) {
    if (e instanceof AuthApiError && e.status === 401) redirect("/login?next=/admin/users");
    throw e;
  }

  const sp = await searchParams;
  const q = (sp.q ?? "").trim();
  const offset = Math.max(0, Number(sp.offset ?? 0) || 0);

  let users: AdminUserSummary[] = [];
  let total = 0;
  let error: string | null = null;
  let stats: AdminStats | null = null;

  try {
    const [usersRes, statsRes] = await Promise.all([
      adminListUsers(jwt, { q, limit: PAGE_SIZE, offset }),
      adminStats(jwt, "debloquemoi").catch(() => null),
    ]);
    users = usersRes.users;
    total = usersRes.total;
    stats = statsRes;
  } catch (e) {
    error = e instanceof AuthApiError ? e.message : "Erreur de chargement.";
  }

  const prevOffset = Math.max(0, offset - PAGE_SIZE);
  const nextOffset = offset + PAGE_SIZE;
  const hasPrev = offset > 0;
  const hasNext = nextOffset < total;

  function pageHref(o: number): string {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (o > 0) params.set("offset", String(o));
    const qs = params.toString();
    return `/admin/users${qs ? `?${qs}` : ""}`;
  }

  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-2xl font-extrabold text-slate-900">👥 Utilisateurs</h1>
        <Link
          href="/admin"
          className="text-xs font-semibold text-indigo-600 underline-offset-2 hover:underline"
        >
          ← Recharges
        </Link>
      </div>
      <p className="mt-1 text-sm text-slate-600">
        Recherche par e-mail (min. 2 caractères) puis créditer/débiter manuellement.
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

      <form method="get" action="/admin/users" className="mt-5 flex gap-2">
        <input
          type="text"
          name="q"
          defaultValue={q}
          placeholder="email@exemple.com"
          className="flex-1 rounded-full border border-slate-300 bg-white px-4 py-2 text-sm shadow-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
        />
        <button
          type="submit"
          className="rounded-full bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-indigo-700"
        >
          Chercher
        </button>
        {q && (
          <Link
            href="/admin/users"
            className="rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
          >
            Effacer
          </Link>
        )}
      </form>

      {error && (
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          ⚠️ {error}
        </div>
      )}

      <p className="mt-4 text-xs text-slate-500">
        {total > 0
          ? `${total} compte${total > 1 ? "s" : ""} ${q ? `correspondant à « ${q} »` : "au total"} — affichage ${offset + 1}–${Math.min(offset + users.length, total)}`
          : "Aucun résultat."}
      </p>

      <section className="mt-3">
        {users.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
            Aucun utilisateur à afficher.
          </p>
        ) : (
          <ul className="space-y-2">
            {users.map((u) => (
              <UserRow key={u.id} user={u} />
            ))}
          </ul>
        )}
      </section>

      {(hasPrev || hasNext) && (
        <nav className="mt-6 flex items-center justify-between gap-2 text-xs">
          {hasPrev ? (
            <Link
              href={pageHref(prevOffset)}
              className="rounded-full border border-slate-200 bg-white px-3 py-1.5 font-semibold text-slate-700 hover:bg-slate-50"
            >
              ← Précédent
            </Link>
          ) : (
            <span />
          )}
          {hasNext && (
            <Link
              href={pageHref(nextOffset)}
              className="rounded-full border border-slate-200 bg-white px-3 py-1.5 font-semibold text-slate-700 hover:bg-slate-50"
            >
              Suivant →
            </Link>
          )}
        </nav>
      )}
    </main>
  );
}
