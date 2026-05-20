import { redirect } from "next/navigation";

import { AuthApiError, referralInfo } from "@/lib/auth-api";
import { getJwt } from "@/lib/session";
import { CopyButton, ShareWhatsAppButton } from "./CopyButton";
import { getTranslationsServer } from "@/lib/i18n";

export async function generateMetadata() {
  const { t } = await getTranslationsServer();
  return {
    title: `${t.referrals.title.replace(/^[^\s]+\s+/, "")} — Débloque-moi`,
  };
}

function fmtMRU(value: number): string {
  return value.toLocaleString("fr-FR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export default async function ReferralsPage() {
  const jwt = await getJwt();
  if (!jwt) redirect("/login?next=/referrals");

  const [{ t, locale }, info] = await Promise.all([
    getTranslationsServer(),
    referralInfo(jwt).catch((e) => {
      if (e instanceof AuthApiError && e.status === 401) {
        redirect("/login?next=/referrals");
      }
      throw e;
    }),
  ]);

  try {
    const code = info.referral_code;
    const shareUrl = info.share_url;
    const shareMessage = code
      ? t.referrals.shareMessage.replace("{code}", code) + (shareUrl ? `\n👉 ${shareUrl}` : "")
      : "";

    return (
      <main className="mx-auto max-w-2xl px-4 py-8">
        <h1 className="text-2xl font-extrabold text-slate-900">{t.referrals.title}</h1>
        <p className="mt-1 text-sm text-slate-600">
          {t.referrals.subtitle}
        </p>

        {/* Code */}
        <section className="mt-6 rounded-2xl border border-slate-200 bg-gradient-to-br from-indigo-50 via-white to-emerald-50 p-5 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            {t.referrals.yourCode}
          </div>
          {code ? (
            <>
              <div className="mt-1 flex items-center gap-3">
                <span className="font-mono text-3xl font-extrabold tracking-widest text-slate-900">
                  {code}
                </span>
                <CopyButton text={code} label={t.referrals.btnCopyCode} />
              </div>
              {shareUrl && (
                <div className="mt-3">
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    {t.referrals.yourLink}
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <span className="break-all rounded-lg bg-white px-3 py-1.5 font-mono text-xs text-slate-700 ring-1 ring-slate-200">
                      {shareUrl}
                    </span>
                    <CopyButton text={shareUrl} label={t.referrals.btnCopyLink} />
                  </div>
                </div>
              )}
              <div className="mt-4">
                <ShareWhatsAppButton text={shareMessage} label={t.referrals.whatsappShareBtn} />
              </div>
            </>
          ) : (
            <p className="mt-2 text-sm text-slate-600">
              {t.referrals.codeUnavailable}
            </p>
          )}
        </section>

        {/* Stats */}
        <section className="mt-6 grid grid-cols-2 gap-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              {t.referrals.statReferredCount}
            </div>
            <div className="mt-1 text-3xl font-extrabold text-slate-900">
              {info.referred_count}
            </div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              {t.referrals.statPaidCount}
            </div>
            <div className="mt-1 text-3xl font-extrabold text-emerald-700">
              {info.paid_referred_count}
            </div>
          </div>
        </section>

        {/* Comment ça marche */}
        <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-base font-bold text-slate-900">{t.referrals.howItWorksTitle}</h2>
          <ol className="mt-3 space-y-2.5 text-sm text-slate-700">
            <li className="flex gap-1.5">
              <span>{t.referrals.howItWorksStep1}</span>
            </li>
            <li className="flex gap-1.5">
              <span>
                {t.referrals.howItWorksStep2.replace(
                  "{bonusText}",
                  info.bonus_signup_mru > 0
                    ? t.referrals.bonusTextBoth.replace("{amount}", fmtMRU(info.bonus_signup_mru))
                    : ""
                )}
              </span>
            </li>
            <li className="space-y-1">
              <div>{t.referrals.howItWorksStep3}</div>
              <ul className={`${locale === "ar" ? "mr-5" : "ml-5"} list-disc text-xs text-slate-600 space-y-1`}>
                <li>
                  {t.referrals.howItWorksBonusReferrer.replace("{amount}", fmtMRU(info.bonus_paid_mru_referrer))}
                </li>
                <li>
                  {t.referrals.howItWorksBonusReferred.replace("{amount}", fmtMRU(info.bonus_paid_mru_referred))}
                </li>
              </ul>
            </li>
          </ol>
        </section>
      </main>
    );
  } catch (e) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-16 text-center">
        <h1 className="text-xl font-bold text-slate-900">{t.common.error}</h1>
        <p className="mt-2 text-sm text-red-600">
          {e instanceof Error ? e.message : "Error"}
        </p>
      </main>
    );
  }
}
