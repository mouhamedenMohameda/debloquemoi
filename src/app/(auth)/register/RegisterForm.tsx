"use client";

import { useState } from "react";
import { registerAction } from "../actions";
import { useTranslation } from "@/components/LanguageProvider";

export function RegisterForm() {
  const { t } = useTranslation();
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
        label={t.auth.fieldEmail}
        name="email"
        type="email"
        autoComplete="email"
        required
        placeholder="ton@email.com"
      />

      <Field
        label={t.auth.fieldPassword}
        name="password"
        type="password"
        autoComplete="new-password"
        required
        minLength={8}
        hint={t.auth.passwordMinLength}
      />

      <Field
        label={t.auth.fieldNni}
        name="nni"
        type="text"
        inputMode="numeric"
        required
        placeholder={t.auth.fieldNniPlaceholder}
        hint={t.auth.fieldNniHint}
      />

      <Field
        label={t.auth.fieldWhatsapp}
        name="whatsapp"
        type="tel"
        inputMode="tel"
        required
        placeholder={t.auth.fieldWhatsappPlaceholder}
        hint={t.auth.fieldWhatsappHint}
      />

      <Field
        label={t.auth.fieldReferralCode}
        name="referral_code"
        type="text"
        placeholder={t.auth.fieldReferralCodePlaceholder}
        hint={t.auth.fieldReferralCodeHint}
      />

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
        {pending ? t.auth.btnRegistering : t.auth.btnRegister}
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

