import { redirect } from "next/navigation";

import { AuthApiError, creditsMe, myTopupRequests, type TopupRequest } from "@/lib/auth-api";
import { getJwt } from "@/lib/session";
import { TopupForm } from "./TopupForm";
import { getTranslationsServer } from "@/lib/i18n";

export async function generateMetadata() {
  const { t } = await getTranslationsServer();
  return {
    title: `${t.topup.title} — Débloque-moi`,
  };
}

// Numéros de paiement (Bankily / Sedad / Masrvi)
const PAYMENT_CHANNELS = [
  { label: "Bankily", value: "42986738", icon: "📱" },
  { label: "Sedad", value: "32164356", icon: "💳" },
];

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

export default async function TopupPage() {
  const jwt = await getJwt();
  if (!jwt) redirect("/login?next=/topup");

  const [{ t, locale }, credits, mine] = await Promise.all([
    getTranslationsServer(),
    creditsMe(jwt).catch((e) => {
      if (e instanceof AuthApiError && e.status === 401) redirect("/login?next=/topup");
      throw e;
    }),
    myTopupRequests(jwt).catch((e) => {
      if (e instanceof AuthApiError && e.status === 401) redirect("/login?next=/topup");
      throw e;
    }),
  ]);

  const balanceMru = credits.balance_mru;
  const blockedReason = credits.block_reason;
  const expiresAt = credits.credits_expire_at;
  const requests = mine.requests;

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="text-2xl font-extrabold text-slate-900">{t.topup.title}</h1>
      <p className="mt-1 text-sm text-slate-600">
        {t.topup.subtitle}{" "}
        <strong>{balanceMru.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {t.common.mru}</strong>
        {expiresAt && (
          <span className="text-slate-500"> — {t.topup.validUntil} {fmtDate(expiresAt, locale)}</span>
        )}
        {blockedReason && (
          <span className="ms-2 text-red-600">— {t.topup.blockedReason} {blockedReason}</span>
        )}
      </p>

      {/* Instructions */}
      <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-base font-bold text-slate-900">{t.topup.howToTitle}</h2>
        <ol className="mt-3 space-y-2 text-sm text-slate-700">
          <li className="flex gap-1">
            <span>{t.topup.howToStep1}</span>
          </li>
          <div className="ms-4 mt-1 space-y-1">
            {PAYMENT_CHANNELS.map((c) => (
              <div key={c.label} className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2">
                <span>{c.icon}</span>
                <span className="text-xs font-semibold text-slate-500">{c.label}</span>
                <span className="ms-auto font-mono text-sm font-bold text-slate-800">{c.value}</span>
              </div>
            ))}
          </div>
          <li className="flex gap-1">
            <span>{t.topup.howToStep2}</span>
          </li>
          <li className="flex gap-1">
            <span>{t.topup.howToStep3}</span>
          </li>
        </ol>
      </section>

      {/* Form */}
      <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-base font-bold text-slate-900">{t.topup.sendProofTitle}</h2>
        <p className="mt-1 text-xs text-slate-500">
          {t.topup.sendProofBonus}
        </p>
        <div className="mt-4">
          <TopupForm />
        </div>
      </section>

      {/* History */}
      <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-base font-bold text-slate-900">{t.topup.myRequestsTitle}</h2>
        {requests.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">{t.topup.emptyRequests}</p>
        ) : (
          <ul className="mt-3 divide-y divide-slate-100">
            {requests.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-slate-500">#{r.id}</span>
                    <StatusBadge status={r.status} t={t} />
                  </div>
                  <div className="mt-0.5 text-xs text-slate-500">
                    {t.topup.requestSent.replace("{date}", fmtDate(r.created_at, locale))}
                    {r.reviewed_at && ` · ${t.topup.requestReviewed.replace("{date}", fmtDate(r.reviewed_at, locale))}`}
                  </div>
                  {r.admin_note && (
                    <div className="mt-1 text-xs italic text-slate-600">
                      &laquo; {r.admin_note} &raquo;
                    </div>
                  )}
                </div>
                {r.granted_mru_approx != null && (
                  <div className="shrink-0 text-right">
                    <div className="text-sm font-bold text-emerald-700">
                      +{r.granted_mru_approx.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {t.common.mru}
                    </div>
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
