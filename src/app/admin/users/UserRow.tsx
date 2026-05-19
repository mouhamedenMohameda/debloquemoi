"use client";

import { useState, useTransition } from "react";

import type { AdminUserSummary } from "@/lib/auth-api";
import { grantWalletAction } from "../actions";

function fmtMRU(value: number): string {
  return value.toLocaleString("fr-FR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("fr-FR");
  } catch {
    return iso;
  }
}

export function UserRow({ user }: { user: AdminUserSummary }) {
  const [open, setOpen] = useState(false);
  const [mru, setMru] = useState("");
  const [note, setNote] = useState("");
  const [days, setDays] = useState("");
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  function handleSubmit() {
    const n = Number(mru);
    if (!Number.isFinite(n) || n === 0) {
      setMessage({ ok: false, text: "Indique un montant MRU non nul." });
      return;
    }
    const fd = new FormData();
    fd.set("user_id", String(user.id));
    fd.set("mru_credit", mru);
    if (note) fd.set("admin_note", note);
    if (days) fd.set("extend_validity_days", days);
    startTransition(async () => {
      const r = await grantWalletAction(fd);
      setMessage({ ok: r.ok, text: r.ok ? (r.message ?? "OK") : r.error });
      if (r.ok) {
        setMru("");
        setNote("");
        setDays("");
      }
    });
  }

  return (
    <li className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 text-left"
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="truncate text-sm font-semibold text-slate-900">
              {user.email}
            </span>
            {user.is_admin && (
              <span className="rounded-full bg-slate-900 px-1.5 py-0.5 text-[9px] font-bold text-white">
                ADMIN
              </span>
            )}
          </div>
          <div className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-slate-500">
            <span>ID #{user.id}</span>
            <span>Inscrit : {fmtDate(user.created_at)}</span>
            {user.credits_expire_at && (
              <span>Expire : {fmtDate(user.credits_expire_at)}</span>
            )}
          </div>
        </div>
        <div className="text-right">
          <div className="text-sm font-extrabold tabular-nums text-emerald-700">
            {fmtMRU(user.balance_mru_approx)}
          </div>
          <div className="text-[10px] text-slate-500">MRU</div>
        </div>
        <span className="text-slate-400" aria-hidden>
          {open ? "▾" : "▸"}
        </span>
      </button>

      {open && (
        <div className="mt-3 space-y-2 border-t border-slate-100 pt-3">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <label className="block">
              <span className="block text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                Montant MRU (signé)
              </span>
              <input
                type="number"
                step="0.01"
                value={mru}
                onChange={(e) => setMru(e.target.value)}
                placeholder="ex : 10 ou -5"
                className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1 text-sm tabular-nums"
              />
            </label>
            <label className="block">
              <span className="block text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                Validité (jours, optionnel)
              </span>
              <input
                type="number"
                min="1"
                max="3650"
                value={days}
                onChange={(e) => setDays(e.target.value)}
                placeholder="ex : 90"
                className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1 text-sm tabular-nums"
              />
            </label>
            <label className="block sm:col-span-1">
              <span className="block text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                Note interne
              </span>
              <input
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="raison de l'ajustement"
                className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1 text-sm"
              />
            </label>
          </div>
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={handleSubmit}
              disabled={pending}
              className="rounded-full bg-indigo-600 px-4 py-1.5 text-xs font-semibold text-white shadow hover:bg-indigo-700 disabled:opacity-50"
            >
              {pending ? "Ajustement…" : "Appliquer"}
            </button>
          </div>
          {message && (
            <p
              className={[
                "rounded-lg px-3 py-2 text-xs",
                message.ok
                  ? "bg-emerald-50 text-emerald-700"
                  : "bg-red-50 text-red-700",
              ].join(" ")}
            >
              {message.text}
            </p>
          )}
          <p className="text-[10px] text-slate-400">
            Montant positif = créditer • négatif = retirer. La validité étend la
            date d&apos;expiration uniquement si le montant est positif.
          </p>
        </div>
      )}
    </li>
  );
}
