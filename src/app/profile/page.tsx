import { redirect } from "next/navigation";
import Link from "next/link";

import {
  AuthApiError,
  creditsMe,
  me,
  myTopupRequests,
  referralInfo,
  type TopupRequest,
} from "@/lib/auth-api";
import { getJwt } from "@/lib/session";
import { getTranslationsServer } from "@/lib/i18n";

export async function generateMetadata() {
  const { t } = await getTranslationsServer();
  return {
    title: `${t.profile.title.replace(/^[^\s]+\s+/, "")} — Débloque-moi`,
  };
}

function fmtMRU(value: number, locale: string): string {
  return value.toLocaleString(locale === "ar" ? "ar-MR" : "fr-FR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function fmtDate(iso: string | null, locale: string): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString(locale === "ar" ? "ar-MR" : "fr-FR", {
      dateStyle: "short",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
}

function fmtDateOnly(iso: string | null, locale: string): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString(locale === "ar" ? "ar-MR" : "fr-FR", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

function StatusBadge({ status, t }: { status: TopupRequest["status"]; t: any }) {
  const map = {
    pending: { label: t.topup.statusPending, cls: "bg-amber-50 text-amber-700 ring-amber-200" },
    approved: { label: t.topup.statusApproved, cls: "bg-emerald-50 text-emerald-700 ring-emerald-200" },
    rejected: { label: t.topup.statusRejected, cls: "bg-red-50 text-red-700 ring-red-200" },
  };
  const m = map[status];
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ${m.cls}`}>
      {m.label}
    </span>
  );
}

export default async function ProfilePage() {
  const jwt = await getJwt();
  if (!jwt) redirect("/login?next=/profile");

  const [{ t, locale }, profile, credits, topups, refInfo] = await Promise.all([
    getTranslationsServer(),
    me(jwt).catch((e) => {
      if (e instanceof AuthApiError && e.status === 401) redirect("/login?next=/profile");
      throw e;
    }),
    creditsMe(jwt).catch((e) => {
      if (e instanceof AuthApiError && e.status === 401) redirect("/login?next=/profile");
      throw e;
    }),
    myTopupRequests(jwt).catch((e) => {
      if (e instanceof AuthApiError && e.status === 401) redirect("/login?next=/profile");
      throw e;
    }),
    referralInfo(jwt).catch(() => null),
  ]);

  const u = profile.user;

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="text-2xl font-extrabold text-slate-900">{t.profile.title}</h1>

      {/* Identité */}
      <section className="mt-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">
          {t.profile.sectionIdentity}
        </h2>
        <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs text-slate-500">{t.profile.fieldEmail}</dt>
            <dd className="font-semibold text-slate-800">{u.email}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">{t.profile.fieldNni}</dt>
            <dd className="font-mono text-slate-800">{u.nni_masked}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">{t.profile.fieldWhatsapp}</dt>
            <dd className="font-mono text-slate-800">{u.whatsapp_masked}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">{t.profile.fieldStatus}</dt>
            <dd className="font-semibold text-slate-800">
              {u.is_admin ? t.profile.statusAdmin : t.profile.statusStudent}
            </dd>
          </div>
        </dl>
      </section>

      {/* Free hints (offre signup) */}
      {credits.free_hints_remaining > 0 && (
        <section className="mt-5 rounded-2xl border border-indigo-200 bg-gradient-to-br from-indigo-50 to-emerald-50 p-5 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-bold uppercase tracking-wide text-indigo-700">
                {t.profile.sectionFreeHints}
              </h2>
              <div className="mt-2 text-4xl font-extrabold text-indigo-900">
                {credits.free_hints_remaining}
                <span className="ms-2 text-base font-bold text-indigo-600">
                  {t.nav.remaining}
                </span>
              </div>
              {credits.free_hints_expires_at && (
                <div className="mt-1 text-xs text-indigo-700">
                  {t.profile.freeHintsExpires.replace("{date}", fmtDate(credits.free_hints_expires_at, locale))}
                </div>
              )}
              <p className="mt-2 text-xs text-slate-600">
                {t.profile.freeHintsDesc}
              </p>
            </div>
          </div>
        </section>
      )}

      {/* Portefeuille */}
      <section className="mt-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">
              {t.profile.sectionWallet}
            </h2>
            <div className="mt-2 text-4xl font-extrabold text-slate-900">
              {fmtMRU(credits.balance_mru, locale)}{" "}
              <span className="text-base font-bold text-slate-500">{t.common.mru}</span>
            </div>
            {credits.credits_expire_at && (
              <div className="mt-1 text-xs text-slate-500">
                {t.profile.walletValidUntil.replace("{date}", fmtDateOnly(credits.credits_expire_at, locale))}
              </div>
            )}
            {credits.block_reason && !credits.free_hints_remaining && (
              <div className="mt-2 inline-flex rounded-lg bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-700 ring-1 ring-red-200">
                ⛔ {credits.block_reason}
              </div>
            )}
          </div>
          <Link
            href="/topup"
            className="shrink-0 rounded-full bg-gradient-to-br from-indigo-600 to-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-md hover:brightness-110"
          >
            {t.profile.btnWalletTopup}
          </Link>
        </div>
      </section>

      {/* Parrainage (compact) */}
      {refInfo?.referral_code && (
        <section className="mt-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">
                {t.profile.sectionReferrals}
              </h2>
              <div className="mt-2 text-sm text-slate-700">
                {t.profile.referralCode} <span className="font-mono font-bold text-slate-900">{refInfo.referral_code}</span>
              </div>
              <div className="mt-1 text-xs text-slate-500">
                {t.profile.referralStats
                  .replace("{referredCount}", String(refInfo.referred_count))
                  .replace(/{referredPlural}/g, refInfo.referred_count > 1 ? "s" : "")
                  .replace("{paidCount}", String(refInfo.paid_referred_count))}
              </div>
            </div>
            <Link
              href="/referrals"
              className="shrink-0 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              {t.profile.btnReferralsDetails}
            </Link>
          </div>
        </section>
      )}

      {/* Historique de recharges */}
      <section className="mt-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">
            {t.profile.sectionHistory}
          </h2>
          <Link
            href="/topup"
            className="text-xs font-semibold text-indigo-600 hover:text-indigo-700"
          >
            {t.profile.btnNewHistoryTopup}
          </Link>
        </div>
        {topups.requests.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">
            {t.profile.emptyHistory}
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-slate-100">
            {topups.requests.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-slate-500">#{r.id}</span>
                    <StatusBadge status={r.status} t={t} />
                  </div>
                  <div className="mt-0.5 text-xs text-slate-500">
                    {fmtDate(r.created_at, locale)}
                  </div>
                  {r.admin_note && (
                    <div className="mt-1 max-w-md truncate text-xs italic text-slate-600">
                      &laquo; {r.admin_note} &raquo;
                    </div>
                  )}
                </div>
                {r.granted_mru_approx != null && (
                  <div className="text-sm font-bold text-emerald-700">
                    +{fmtMRU(r.granted_mru_approx, locale)} {t.common.mru}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
