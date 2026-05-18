"use client";

import { useState } from "react";
import { uploadTopupAction } from "./actions";

export function TopupForm() {
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  async function onSubmit(formData: FormData) {
    setError(null);
    setSuccess(null);
    setPending(true);
    const r = await uploadTopupAction(formData);
    setPending(false);
    if (r.ok) {
      setSuccess(r.message);
      setFileName(null);
      setPreviewUrl(null);
      // Reset le champ file
      const input = document.getElementById("topup-file") as HTMLInputElement | null;
      if (input) input.value = "";
    } else {
      setError(r.error);
    }
  }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (f) {
      setFileName(f.name);
      setPreviewUrl(URL.createObjectURL(f));
    } else {
      setFileName(null);
      setPreviewUrl(null);
    }
  }

  return (
    <form action={onSubmit} className="space-y-4">
      <label
        htmlFor="topup-file"
        className="block cursor-pointer rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 p-6 text-center transition hover:border-indigo-400 hover:bg-indigo-50/30"
      >
        {previewUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={previewUrl}
            alt="Aperçu"
            className="mx-auto max-h-60 rounded-lg shadow-sm"
          />
        ) : (
          <>
            <div className="text-3xl">📸</div>
            <div className="mt-2 text-sm font-semibold text-slate-700">
              Clique pour choisir la capture
            </div>
            <div className="text-xs text-slate-500">
              PNG, JPG, WEBP — max 6 Mo
            </div>
          </>
        )}
        {fileName && (
          <div className="mt-2 truncate text-xs text-indigo-700">{fileName}</div>
        )}
        <input
          id="topup-file"
          type="file"
          name="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          required
          className="hidden"
          onChange={onFileChange}
        />
      </label>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          ⚠️ {error}
        </div>
      )}
      {success && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
          ✅ {success}
        </div>
      )}

      <button
        type="submit"
        disabled={pending || !fileName}
        className="w-full rounded-2xl bg-gradient-to-br from-indigo-600 to-emerald-600 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-200 transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
      >
        {pending ? "Envoi..." : "Envoyer la preuve"}
      </button>
    </form>
  );
}
