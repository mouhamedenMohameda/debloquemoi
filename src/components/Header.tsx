/**
 * Header — Server Component.
 *
 * Affiche :
 *  - le logo / titre + email
 *  - les liens de navigation (Accueil, Recharger, Parrainage, Compte, Admin si is_admin)
 *  - le badge "solde MRU" récupéré en S2S depuis auth-api
 *  - un bouton "Se déconnecter" (Server Action)
 *
 * Si pas de session, on ne rend rien (les pages /login et /register ont leur
 * propre layout). Le proxy.ts (middleware) redirige déjà vers /login pour les
 * routes non-publiques.
 */

import Link from "next/link";

import { AuthApiError, me, walletInfo } from "@/lib/auth-api";
import { getJwt, getSession } from "@/lib/session";
import { logoutAction } from "@/app/(auth)/actions";

function formatMRU(value: number): string {
  return value.toLocaleString("fr-FR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

const NAV_LINKS = [
  { href: "/", label: "Accueil", icon: "🏠" },
  { href: "/topup", label: "Recharger", icon: "💰" },
  { href: "/referrals", label: "Parrainage", icon: "🎁" },
  { href: "/profile", label: "Compte", icon: "👤" },
];

export async function Header() {
  const session = await getSession();
  if (!session) return null;

  // Fetch en parallèle : solde + statut admin
  const jwt = await getJwt();
  const [walletRes, meRes] = await Promise.all([
    walletInfo(session.user_id).catch((e) => {
      if (!(e instanceof AuthApiError)) console.error("Header walletInfo error", e);
      return null;
    }),
    jwt
      ? me(jwt).catch((e) => {
          if (!(e instanceof AuthApiError)) console.error("Header me error", e);
          return null;
        })
      : Promise.resolve(null),
  ]);

  const balanceMru = walletRes?.balance_mru ?? null;
  const blockedReason = walletRes?.blocked_reason ?? null;
  const isAdmin = !!meRes?.user.is_admin;
  const lowBalance = balanceMru !== null && balanceMru < 1;

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/85 backdrop-blur supports-[backdrop-filter]:bg-white/70">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-2.5">
        <Link href="/" className="flex items-center gap-2 min-w-0">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-emerald-500 text-sm text-white shadow-md shrink-0">
            🎓
          </span>
          <div className="min-w-0 hidden sm:block">
            <div className="text-sm font-extrabold text-slate-900 leading-tight truncate">
              Débloque-moi
            </div>
            <div className="text-[10px] text-slate-500 truncate">
              {session.email}
            </div>
          </div>
        </Link>

        <div className="flex items-center gap-2">
          {balanceMru !== null && (
            <Link
              href="/topup"
              title={blockedReason ?? "Solde de ton portefeuille — clique pour recharger"}
              className={[
                "inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold ring-1 transition hover:brightness-105",
                blockedReason
                  ? "bg-red-50 text-red-700 ring-red-200"
                  : lowBalance
                    ? "bg-amber-50 text-amber-700 ring-amber-200"
                    : "bg-emerald-50 text-emerald-700 ring-emerald-200",
              ].join(" ")}
            >
              <span aria-hidden>{blockedReason ? "⛔" : lowBalance ? "⚠️" : "💰"}</span>
              <span>{formatMRU(balanceMru)} MRU</span>
            </Link>
          )}

          <form action={logoutAction}>
            <button
              type="submit"
              title="Se déconnecter"
              className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 active:scale-[0.97]"
            >
              <span className="hidden sm:inline">Se déconnecter</span>
              <span className="sm:hidden" aria-hidden>🚪</span>
            </button>
          </form>
        </div>
      </div>

      {/* Sous-barre de navigation — scrollable horizontalement sur mobile */}
      <nav className="mx-auto max-w-5xl overflow-x-auto px-4 pb-2">
        <ul className="flex gap-1.5 whitespace-nowrap text-xs">
          {NAV_LINKS.map((l) => (
            <li key={l.href}>
              <Link
                href={l.href}
                className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1.5 font-semibold text-slate-700 transition hover:bg-slate-200"
              >
                <span aria-hidden>{l.icon}</span>
                <span>{l.label}</span>
              </Link>
            </li>
          ))}
          {isAdmin && (
            <li>
              <Link
                href="/admin"
                className="inline-flex items-center gap-1 rounded-full bg-slate-900 px-3 py-1.5 font-semibold text-white transition hover:bg-slate-800"
              >
                <span aria-hidden>🛡️</span>
                <span>Admin</span>
              </Link>
            </li>
          )}
        </ul>
      </nav>
    </header>
  );
}
