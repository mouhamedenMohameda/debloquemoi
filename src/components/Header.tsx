/**
 * Header — Server Component.
 *
 * Mobile-first :
 *  - barre fine en haut (logo + MRU + logout) — minimaliste sur mobile
 *  - sous-barre de nav (icônes seules sur mobile, icônes+texte dès sm:)
 *
 * Si pas de session, on ne rend rien (les pages /login et /register ont leur
 * propre layout). Le proxy.ts (middleware) redirige déjà vers /login pour les
 * routes non-publiques.
 */

import Link from "next/link";

import { AuthApiError, creditsMe, walletInfo } from "@/lib/auth-api";
import { getJwt, getSession } from "@/lib/session";
import { logoutAction } from "@/app/(auth)/actions";

function formatMRU(value: number): string {
  return value.toLocaleString("fr-FR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatExpiresIn(iso: string | null): string | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  const ms = t - Date.now();
  if (ms <= 0) return null;
  const h = Math.floor(ms / 3_600_000);
  if (h >= 1) return `${h}h restantes`;
  const m = Math.max(1, Math.floor(ms / 60_000));
  return `${m}min restantes`;
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

  // Fetch en parallèle : solde MRU (S2S) + credits/me (free hints + is_admin)
  const jwt = await getJwt();
  const [walletRes, creditsRes] = await Promise.all([
    walletInfo(session.user_id).catch((e) => {
      if (!(e instanceof AuthApiError)) console.error("Header walletInfo error", e);
      return null;
    }),
    jwt
      ? creditsMe(jwt).catch((e) => {
          if (!(e instanceof AuthApiError)) console.error("Header creditsMe error", e);
          return null;
        })
      : Promise.resolve(null),
  ]);

  const balanceMru = walletRes?.balance_mru ?? null;
  const blockedReason = walletRes?.blocked_reason ?? null;
  const isAdmin = !!creditsRes?.is_admin;
  const freeHintsRemaining = creditsRes?.free_hints_remaining ?? 0;
  const freeHintsExpires = creditsRes?.free_hints_expires_at ?? null;
  const freeHintsActive = freeHintsRemaining > 0;
  const lowBalance = balanceMru !== null && balanceMru < 1;

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/85 backdrop-blur supports-[backdrop-filter]:bg-white/70">
      {/* Ligne 1 — logo + badge + logout, ultra-compact sur mobile */}
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-2 px-3 py-1.5 sm:px-4 sm:py-2">
        <Link href="/" className="flex min-w-0 items-center gap-2">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-emerald-500 text-xs text-white shadow-sm">
            🎓
          </span>
          <div className="hidden min-w-0 sm:block">
            <div className="truncate text-sm font-extrabold leading-tight text-slate-900">
              Débloque-moi
            </div>
            <div className="truncate text-[10px] text-slate-500">{session.email}</div>
          </div>
        </Link>

        <div className="flex items-center gap-1.5">
          {/* Badge prioritaire : free hints (offre signup) */}
          {freeHintsActive && (
            <Link
              href="/profile"
              title={`Tu as ${freeHintsRemaining} corrections gratuites${
                formatExpiresIn(freeHintsExpires)
                  ? ` — ${formatExpiresIn(freeHintsExpires)}`
                  : ""
              }`}
              className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2.5 py-1 text-[11px] font-bold text-indigo-700 ring-1 ring-indigo-200 transition hover:brightness-105"
            >
              <span aria-hidden>🎁</span>
              <span className="tabular-nums">{freeHintsRemaining}</span>
              <span className="hidden sm:inline">gratuits</span>
            </Link>
          )}

          {/* Solde MRU — toujours visible (montre 0,00 si user n'a pas rechargé) */}
          {balanceMru !== null && (
            <Link
              href="/topup"
              title={blockedReason ?? "Solde de ton portefeuille — clique pour recharger"}
              className={[
                "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold ring-1 transition hover:brightness-105",
                blockedReason
                  ? "bg-red-50 text-red-700 ring-red-200"
                  : lowBalance
                    ? "bg-amber-50 text-amber-700 ring-amber-200"
                    : "bg-emerald-50 text-emerald-700 ring-emerald-200",
              ].join(" ")}
            >
              <span aria-hidden>{blockedReason ? "⛔" : lowBalance ? "⚠️" : "💰"}</span>
              <span className="tabular-nums">{formatMRU(balanceMru)}</span>
              <span>MRU</span>
            </Link>
          )}

          <form action={logoutAction}>
            <button
              type="submit"
              title="Se déconnecter"
              className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700 transition hover:bg-slate-50 active:scale-95"
            >
              <span className="hidden sm:inline">Déconnexion</span>
              <span className="sm:hidden" aria-hidden>🚪</span>
            </button>
          </form>
        </div>
      </div>

      {/* Ligne 2 — nav (icônes seules sur mobile) */}
      <nav className="mx-auto max-w-5xl overflow-x-auto px-3 pb-1.5 sm:px-4 sm:pb-2">
        <ul className="flex gap-1 whitespace-nowrap text-[11px] sm:gap-1.5 sm:text-xs">
          {NAV_LINKS.map((l) => (
            <li key={l.href}>
              <Link
                href={l.href}
                className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 font-semibold text-slate-700 transition hover:bg-slate-200 sm:px-3 sm:py-1.5"
                title={l.label}
              >
                <span aria-hidden>{l.icon}</span>
                <span className="hidden sm:inline">{l.label}</span>
              </Link>
            </li>
          ))}
          {isAdmin && (
            <li>
              <Link
                href="/admin"
                className="inline-flex items-center gap-1 rounded-full bg-slate-900 px-2.5 py-1 font-semibold text-white transition hover:bg-slate-800 sm:px-3 sm:py-1.5"
                title="Admin"
              >
                <span aria-hidden>🛡️</span>
                <span className="hidden sm:inline">Admin</span>
              </Link>
            </li>
          )}
        </ul>
      </nav>
    </header>
  );
}
