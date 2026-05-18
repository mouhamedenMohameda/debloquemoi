import { redirect } from "next/navigation";

import { AuthApiError, creditsMe, myTopupRequests, type TopupRequest } from "@/lib/auth-api";
import { getJwt } from "@/lib/session";
import { TopupForm } from "./TopupForm";

export const metadata = {
  title: "Recharger mon portefeuille — Débloque-moi",
};

// Numéros de paiement (Bankily / Sedad / Masrvi)
// TODO: déplacer dans une config admin via auth-api quand on aura plusieurs comptes.
const PAYMENT_CHANNELS = [
  { label: "Bankily", value: "+222 36 12 34 56", icon: "📱" },
  { label: "Sedad", value: "+222 22 12 34 56", icon: "💳" },
];

function StatusBadge({ status }: { status: TopupRequest["status"] }) {
  const map = {
    pending: { label: "En attente", cls: "bg-amber-50 text-amber-700 ring-amber-200" },
    approved: { label: "Approuvée", cls: "bg-emerald-50 text-emerald-700 ring-emerald-200" },
    rejected: { label: "Rejetée", cls: "bg-red-50 text-red-700 ring-red-200" },
  };
  const m = map[status];
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ${m.cls}`}>
      {m.label}
    </span>
  );
}

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("fr-FR", {
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

  let balanceMru = 0;
  let blockedReason: string | null = null;
  let expiresAt: string | null = null;
  let requests: TopupRequest[] = [];
  try {
    const [credits, mine] = await Promise.all([
      creditsMe(jwt),
      myTopupRequests(jwt),
    ]);
    balanceMru = credits.balance_mru;
    blockedReason = credits.block_reason;
    expiresAt = credits.credits_expire_at;
    requests = mine.requests;
  } catch (e) {
    if (e instanceof AuthApiError && e.status === 401) redirect("/login?next=/topup");
    throw e;
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="text-2xl font-extrabold text-slate-900">Recharger mon portefeuille</h1>
      <p className="mt-1 text-sm text-slate-600">
        Solde actuel :{" "}
        <strong>{balanceMru.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} MRU</strong>
        {expiresAt && (
          <span className="text-slate-500"> — valide jusqu&apos;au {fmtDate(expiresAt)}</span>
        )}
        {blockedReason && (
          <span className="ml-2 text-red-600">— {blockedReason}</span>
        )}
      </p>

      {/* Instructions */}
      <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-base font-bold text-slate-900">Comment recharger ?</h2>
        <ol className="mt-3 space-y-2 text-sm text-slate-700">
          <li>
            <strong>1.</strong> Fais un virement vers l&apos;un des numéros ci-dessous (montant libre en MRU) :
          </li>
          <div className="ml-4 mt-1 space-y-1">
            {PAYMENT_CHANNELS.map((c) => (
              <div key={c.label} className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2">
                <span>{c.icon}</span>
                <span className="text-xs font-semibold text-slate-500">{c.label}</span>
                <span className="ml-auto font-mono text-sm font-bold text-slate-800">{c.value}</span>
              </div>
            ))}
          </div>
          <li>
            <strong>2.</strong> Prends une <strong>capture d&apos;écran</strong> de la confirmation de virement (montant + heure visibles).
          </li>
          <li>
            <strong>3.</strong> Envoie-nous la capture ci-dessous. Un admin créditera ton compte sous 24h.
          </li>
        </ol>
      </section>

      {/* Form */}
      <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-base font-bold text-slate-900">Envoyer la preuve</h2>
        <p className="mt-1 text-xs text-slate-500">
          🎁 Bonus parrainage : à ta première recharge approuvée, toi et ton parrain recevez chacun un bonus.
        </p>
        <div className="mt-4">
          <TopupForm />
        </div>
      </section>

      {/* History */}
      <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-base font-bold text-slate-900">Mes demandes</h2>
        {requests.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">Aucune demande pour l&apos;instant.</p>
        ) : (
          <ul className="mt-3 divide-y divide-slate-100">
            {requests.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-slate-500">#{r.id}</span>
                    <StatusBadge status={r.status} />
                  </div>
                  <div className="mt-0.5 text-xs text-slate-500">
                    Envoyée le {fmtDate(r.created_at)}
                    {r.reviewed_at && ` · Traitée le ${fmtDate(r.reviewed_at)}`}
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
                      +{r.granted_mru_approx.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} MRU
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
