"use client";

import { useState } from "react";
import { loginAction } from "../actions";
import { useTranslation } from "@/components/LanguageProvider";

export function LoginForm() {
  const { t } = useTranslation();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(formData: FormData) {
    setError(null);
    setPending(true);
    const r = await loginAction(formData);
    // En cas de succès, loginAction redirige → ce code ne s'exécute pas.
    // On n'arrive ici qu'en cas d'échec.
    if (r && !r.ok) {
      setError(r.error);
    }
    setPending(false);
  }

  return (
    <form action={onSubmit} className="space-y-4">
      <div>
        <label
          htmlFor="email"
          className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-600"
        >
          {t.auth.fieldEmail}
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-800 outline-none transition focus:border-indigo-400 focus:bg-white focus:ring-4 focus:ring-indigo-100"
          placeholder="ton@email.com"
        />
      </div>

      <div>
        <label
          htmlFor="password"
          className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-600"
        >
          {t.auth.fieldPassword}
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          minLength={8}
          className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-800 outline-none transition focus:border-indigo-400 focus:bg-white focus:ring-4 focus:ring-indigo-100"
        />
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          ⚠️ {error}
        </div>
      )}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-2xl bg-gradient-to-br from-indigo-600 to-emerald-600 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-200 transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 cursor-pointer"
      >
        {pending ? t.auth.btnConnecting : t.auth.btnConnect}
      </button>
    </form>
  );
}

