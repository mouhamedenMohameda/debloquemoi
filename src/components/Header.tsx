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
import { getTranslationsServer } from "@/lib/i18n";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { LogoutButton } from "@/components/LogoutButton";

function formatMRU(value: number): string {
  return value.toLocaleString("fr-FR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatExpiresIn(iso: string | null, locale: string): string | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  const ms = t - Date.now();
  if (ms <= 0) return null;
  const h = Math.floor(ms / 3_600_000);
  if (h >= 1) return locale === "ar" ? `${h} ساعة متبقية` : `${h}h restantes`;
  const m = Math.max(1, Math.floor(ms / 60_000));
  return locale === "ar" ? `${m} دقيقة متبقية` : `${m}min restantes`;
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
  const [walletRes, creditsRes, { t, locale }] = await Promise.all([
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
    getTranslationsServer(),
  ]);

  const balanceMru = walletRes?.balance_mru ?? null;
  const blockedReason = walletRes?.blocked_reason ?? null;
  const isAdmin = !!creditsRes?.is_admin;
  const freeHintsRemaining = creditsRes?.free_hints_remaining ?? 0;
  const freeHintsExpires = creditsRes?.free_hints_expires_at ?? null;
  const freeHintsActive = freeHintsRemaining > 0;
  const lowBalance = balanceMru !== null && balanceMru < 1;

  const navLabels: Record<string, string> = {
    "/": t.nav.home,
    "/topup": t.nav.topup,
    "/referrals": t.nav.referrals,
    "/profile": t.nav.profile,
  };

  const formattedBlockedReason = blockedReason 
    ? (locale === "ar" ? `${t.topup.blockedReason} ${blockedReason}` : `${t.nav.blocked} : ${blockedReason}`)
    : null;

  const walletTitle = formattedBlockedReason ?? (locale === "ar" 
    ? "رصيد محفظتك — اضغط للشحن" 
    : "Solde de ton portefeuille — clique pour recharger");

  const freeHintsTitle = locale === "ar"
    ? `لديك ${freeHintsRemaining} تصحيحات مجانية${
        formatExpiresIn(freeHintsExpires, locale)
          ? ` — ${formatExpiresIn(freeHintsExpires, locale)}`
          : ""
      }`
    : `Tu as ${freeHintsRemaining} corrections gratuites${
        formatExpiresIn(freeHintsExpires, locale)
          ? ` — ${formatExpiresIn(freeHintsExpires, locale)}`
          : ""
      }`;

  return (
    <>
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/85 backdrop-blur supports-[backdrop-filter]:bg-white/70">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-3 py-1.5 sm:px-4 sm:py-2">
          
          {/* Logo & Desktop Navigation */}
          <div className="flex items-center gap-6 min-w-0">
            <Link href="/" className="flex min-w-0 items-center gap-2">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-emerald-500 text-sm text-white shadow-sm">
                🎓
              </span>
              <div className="hidden min-w-0 sm:block">
                <div className="truncate text-sm font-extrabold leading-tight text-slate-900">
                  Débloque-moi
                </div>
                <div className="truncate text-[10px] text-slate-500">{session.email}</div>
              </div>
            </Link>

            {/* Desktop Navigation Links */}
            <nav className="hidden sm:block">
              <ul className="flex gap-1.5 whitespace-nowrap text-[11px] sm:text-xs">
                {NAV_LINKS.map((l) => {
                  const label = navLabels[l.href] || l.label;
                  return (
                    <li key={l.href}>
                      <Link
                        href={l.href}
                        className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 font-semibold text-slate-700 transition hover:bg-slate-200 sm:px-3 sm:py-1.5 shadow-sm"
                        title={label}
                      >
                        <span aria-hidden>{l.icon}</span>
                        <span>{label}</span>
                      </Link>
                    </li>
                  );
                })}
                {isAdmin && (
                  <li>
                    <Link
                      href="/admin"
                      className="inline-flex items-center gap-1 rounded-full bg-slate-900 px-2.5 py-1 font-semibold text-white transition hover:bg-slate-800 sm:px-3 sm:py-1.5 shadow-sm"
                      title={t.nav.admin}
                    >
                      <span aria-hidden>🛡️</span>
                      <span>{t.nav.admin}</span>
                    </Link>
                  </li>
                )}
              </ul>
            </nav>
          </div>

          {/* Badges, LanguageSwitcher & LogoutButton */}
          <div className="flex items-center gap-1.5 shrink-0">
            {/* Solde MRU — toujours visible (montre 0,00 si user n'a pas rechargé) */}
            {balanceMru !== null && (
              <Link
                href="/topup"
                title={walletTitle}
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
                <span>{t.nav.mru}</span>
              </Link>
            )}

            {/* Badge prioritaire : free hints (offre signup) */}
            {freeHintsActive && (
              <Link
                href="/profile"
                title={freeHintsTitle}
                className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2.5 py-1 text-[11px] font-bold text-indigo-700 ring-1 ring-indigo-200 transition hover:brightness-105"
              >
                <span aria-hidden>🎁</span>
                <span className="tabular-nums">{freeHintsRemaining}</span>
                <span className="hidden sm:inline">{t.nav.gratuits}</span>
              </Link>
            )}

            {/* Sélecteur de langue */}
            <LanguageSwitcher />

            {/* Déconnexion avec confirmation */}
            <LogoutButton />
          </div>
        </div>
      </header>

      {/* Barre de navigation collante en bas (uniquement sur mobile) */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-slate-200 bg-white/95 backdrop-blur pb-safe sm:hidden shadow-lg shadow-slate-900/10">
        <ul className="flex items-center justify-around py-2">
          {NAV_LINKS.map((l) => {
            const label = navLabels[l.href] || l.label;
            return (
              <li key={l.href} className="flex-1">
                <Link
                  href={l.href}
                  className="flex flex-col items-center justify-center gap-0.5 text-slate-500 hover:text-indigo-600 active:scale-95 transition-all"
                  title={label}
                >
                  <span className="text-lg" aria-hidden>{l.icon}</span>
                  <span className="text-[9px] font-bold tracking-tight text-slate-700">{label}</span>
                </Link>
              </li>
            );
          })}
          {isAdmin && (
            <li className="flex-1">
              <Link
                href="/admin"
                className="flex flex-col items-center justify-center gap-0.5 text-slate-900 hover:text-indigo-600 active:scale-95 transition-all"
                title={t.nav.admin}
              >
                <span className="text-lg" aria-hidden>🛡️</span>
                <span className="text-[9px] font-bold tracking-tight text-slate-700">{t.nav.admin}</span>
              </Link>
            </li>
          )}
        </ul>
      </nav>
    </>
  );
}
