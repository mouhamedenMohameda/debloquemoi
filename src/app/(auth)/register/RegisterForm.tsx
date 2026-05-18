"use client";

import { useState } from "react";
import { registerAction } from "../actions";

export function RegisterForm() {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(formData: FormData) {
    setError(null);
    setPending(true);
    const r = await registerAction(formData);
    if (r && !r.ok) {
      setError(r.error);
    }
    setPending(false);
  }

  return (
    <form action={onSubmit} className="space-y-4">
      <Field
        label="Email"
        name="email"
        type="email"
        autoComplete="email"
        required
        placeholder="ton@email.com"
      />

      <Field
        label="Mot de passe (8 caractères min)"
        name="password"
        type="password"
        autoComplete="new-password"
        required
        minLength={8}
      />

      <Field
        label="NNI"
        name="nni"
        type="text"
        inputMode="numeric"
        required
        placeholder="N° de carte d'identité mauritanienne"
        hint="Permet de récupérer ton compte si tu oublies ton mot de passe."
      />

      <Field
        label="WhatsApp"
        name="whatsapp"
        type="tel"
        inputMode="tel"
        required
        placeholder="+22245123456"
        hint="Numéro avec indicatif (+222 pour Mauritanie)."
      />

      <Field
        label="Code de parrainage (optionnel)"
        name="referral_code"
        type="text"
        placeholder="Code de l'ami qui t'invite"
        hint="Vous recevez tous les deux un bonus si valide."
      />

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          ⚠️ {error}
        </div>
      )}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-2xl bg-gradient-to-br from-indigo-600 to-emerald-600 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-200 transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? "Création..." : "Créer mon compte"}
      </button>
    </form>
  );
}

function Field({
  label,
  hint,
  ...input
}: React.InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  hint?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-600">
        {label}
      </span>
      <input
        {...input}
        className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-800 outline-none transition focus:border-indigo-400 focus:bg-white focus:ring-4 focus:ring-indigo-100"
      />
      {hint && <span className="mt-1 block text-[11px] text-slate-500">{hint}</span>}
    </label>
  );
}
