"use client";

import { useState, useTransition } from "react";
import type { AdminTopupRequest } from "@/lib/auth-api";
import { approveTopupAction, rejectTopupAction } from "./actions";

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

export function TopupRow({ row }: { row: AdminTopupRequest }) {
  const [showProof, setShowProof] = useState(false);
  const [mru, setMru] = useState("");
  const [note, setNote] = useState("");
  const [days, setDays] = useState("");
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  function handleApprove() {
    if (!mru || Number(mru) <= 0) {
      setMessage({ ok: false, text: "Indique un montant MRU > 0." });
      return;
    }
    const fd = new FormData();
    fd.set("request_id", String(row.id));
    fd.set("mru_credit", mru);
    if (note) fd.set("admin_note", note);
    if (days) fd.set("extend_validity_days", days);
    startTransition(async () => {
      const r = await approveTopupAction(fd);
      setMessage({ ok: r.ok, text: r.ok ? (r.message ?? "OK") : r.error });
    });
  }

  function handleReject() {
    const fd = new FormData();
    fd.set("request_id", String(row.id));
    if (note) fd.set("admin_note", note);
    startTransition(async () => {
      const r = await rejectTopupAction(fd);
      setMessage({ ok: r.ok, text: r.ok ? (r.message ?? "OK") : r.error });
    });
  }

  const isPending = row.status === "pending";

  return (
    <li className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-slate-500">#{row.id}</span>
            <span
              className={[
                "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1",
                row.status === "pending"
                  ? "bg-amber-50 text-amber-700 ring-amber-200"
                  : row.status === "approved"
                    ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
                    : "bg-red-50 text-red-700 ring-red-200",
              ].join(" ")}
            >
              {row.status === "pending" ? "En attente" : row.status === "approved" ? "Approuvée" : "Rejetée"}
            </span>
            <span className="truncate text-sm font-semibold text-slate-800">{row.user_email}</span>
            <span className="text-xs text-slate-400">(user #{row.user_id})</span>
          </div>
          <div className="mt-1 text-xs text-slate-500">
            Envoyée le {fmtDate(row.created_at)}
            {row.reviewed_at && ` · Traitée le ${fmtDate(row.reviewed_at)}`}
          </div>
          <div className="mt-0.5 text-xs text-slate-400">📎 {row.original_filename}</div>
          {row.granted_mru_approx != null && (
            <div className="mt-1 text-sm font-bold text-emerald-700">
              Crédit accordé : +{row.granted_mru_approx.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} MRU
            </div>
          )}
          {row.admin_note && (
            <div className="mt-1 text-xs italic text-slate-600">
              Note admin : &laquo; {row.admin_note} &raquo;
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={() => setShowProof((s) => !s)}
          className="shrink-0 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
        >
          {showProof ? "Masquer" : "Voir preuve"}
        </button>
      </div>

      {showProof && (
        <div className="mt-3 overflow-hidden rounded-xl border border-slate-200 bg-slate-50 p-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`/api/admin/proof/${row.id}`}
            alt={`Preuve #${row.id}`}
            className="mx-auto max-h-[480px] rounded-lg"
          />
        </div>
      )}

      {isPending && (
        <div className="mt-4 grid gap-2 border-t border-slate-100 pt-4 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              Montant MRU à créditer *
            </span>
            <input
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0.01"
              value={mru}
              onChange={(e) => setMru(e.target.value)}
              placeholder="ex: 50"
              disabled={pending}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              Durée validité (jours, optionnel)
            </span>
            <input
              type="number"
              inputMode="numeric"
              min="1"
              max="3650"
              value={days}
              onChange={(e) => setDays(e.target.value)}
              placeholder="défaut serveur"
              disabled={pending}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
            />
          </label>
          <label className="block sm:col-span-2">
            <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              Note admin (visible par le user)
            </span>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={500}
              placeholder="ex: virement reçu 50 MRU sur Bankily 17/05"
              disabled={pending}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
            />
          </label>

          <div className="flex gap-2 sm:col-span-2">
            <button
              type="button"
              onClick={handleApprove}
              disabled={pending}
              className="flex-1 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 active:scale-[0.98] disabled:opacity-50"
            >
              {pending ? "..." : "✅ Approuver"}
            </button>
            <button
              type="button"
              onClick={handleReject}
              disabled={pending}
              className="flex-1 rounded-xl border border-red-200 bg-white px-4 py-2.5 text-sm font-semibold text-red-700 transition hover:bg-red-50 active:scale-[0.98] disabled:opacity-50"
            >
              {pending ? "..." : "❌ Rejeter"}
            </button>
          </div>
        </div>
      )}

      {message && (
        <div
          className={[
            "mt-3 rounded-lg p-2.5 text-xs",
            message.ok
              ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200"
              : "bg-red-50 text-red-700 ring-1 ring-red-200",
          ].join(" ")}
        >
          {message.text}
        </div>
      )}
    </li>
  );
}
