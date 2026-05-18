import { redirect } from "next/navigation";

import { AuthApiError, referralInfo } from "@/lib/auth-api";
import { getJwt } from "@/lib/session";
import { CopyButton, ShareWhatsAppButton } from "./CopyButton";

export const metadata = {
  title: "Parrainage — Débloque-moi",
};

function fmtMRU(value: number): string {
  return value.toLocaleString("fr-FR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export default async function ReferralsPage() {
  const jwt = await getJwt();
  if (!jwt) redirect("/login?next=/referrals");

  try {
    const info = await referralInfo(jwt);

    const code = info.referral_code;
    const shareUrl = info.share_url;
    const shareMessage = code
      ? `🎓 J'utilise *Débloque-moi* pour avoir des corrections pas-à-pas du Bac C. Inscris-toi avec mon code *${code}* et on gagne tous les deux un bonus !${shareUrl ? `\n👉 ${shareUrl}` : ""}`
      : "";

    return (
      <main className="mx-auto max-w-2xl px-4 py-8">
        <h1 className="text-2xl font-extrabold text-slate-900">🎁 Parrainage</h1>
        <p className="mt-1 text-sm text-slate-600">
          Invite tes amis et gagnez des MRU tous les deux.
        </p>

        {/* Code */}
        <section className="mt-6 rounded-2xl border border-slate-200 bg-gradient-to-br from-indigo-50 via-white to-emerald-50 p-5 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Ton code
          </div>
          {code ? (
            <>
              <div className="mt-1 flex items-center gap-3">
                <span className="font-mono text-3xl font-extrabold tracking-widest text-slate-900">
                  {code}
                </span>
                <CopyButton text={code} label="Copier le code" />
              </div>
              {shareUrl && (
                <div className="mt-3">
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Ton lien
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <span className="break-all rounded-lg bg-white px-3 py-1.5 font-mono text-xs text-slate-700 ring-1 ring-slate-200">
                      {shareUrl}
                    </span>
                    <CopyButton text={shareUrl} label="Copier le lien" />
                  </div>
                </div>
              )}
              <div className="mt-4">
                <ShareWhatsAppButton text={shareMessage} />
              </div>
            </>
          ) : (
            <p className="mt-2 text-sm text-slate-600">
              Code pas encore disponible. Reconnecte-toi ou contacte le support.
            </p>
          )}
        </section>

        {/* Stats */}
        <section className="mt-6 grid grid-cols-2 gap-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Amis inscrits
            </div>
            <div className="mt-1 text-3xl font-extrabold text-slate-900">
              {info.referred_count}
            </div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Amis ayant rechargé
            </div>
            <div className="mt-1 text-3xl font-extrabold text-emerald-700">
              {info.paid_referred_count}
            </div>
          </div>
        </section>

        {/* Comment ça marche */}
        <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-base font-bold text-slate-900">Comment ça marche ?</h2>
          <ol className="mt-3 space-y-2.5 text-sm text-slate-700">
            <li>
              <strong>1.</strong> Partage ton code (ou ton lien) avec un ami.
            </li>
            <li>
              <strong>2.</strong> Quand il s&apos;inscrit avec ton code, vous recevez chacun{" "}
              <strong>{fmtMRU(info.bonus_signup_mru)} MRU</strong> de bonus.
            </li>
            <li>
              <strong>3.</strong> À sa <em>première</em> recharge approuvée, vous recevez à nouveau :
              <ul className="ml-5 mt-1 list-disc text-xs text-slate-600">
                <li>
                  <strong>{fmtMRU(info.bonus_paid_mru_referrer)} MRU</strong> pour toi
                </li>
                <li>
                  <strong>{fmtMRU(info.bonus_paid_mru_referred)} MRU</strong> pour ton ami
                </li>
              </ul>
            </li>
          </ol>
        </section>
      </main>
    );
  } catch (e) {
    if (e instanceof AuthApiError && e.status === 401) redirect("/login?next=/referrals");
    return (
      <main className="mx-auto max-w-2xl px-4 py-16 text-center">
        <h1 className="text-xl font-bold text-slate-900">Erreur</h1>
        <p className="mt-2 text-sm text-red-600">
          {e instanceof Error ? e.message : "Impossible de charger les infos de parrainage."}
        </p>
      </main>
    );
  }
}
