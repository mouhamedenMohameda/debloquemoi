"use client";

import { useTranslation } from "./LanguageProvider";

export function LanguageSwitcher() {
  const { locale, setLocale } = useTranslation();

  return (
    <button
      type="button"
      onClick={() => setLocale(locale === "fr" ? "ar" : "fr")}
      title={locale === "fr" ? "Passer en Arabe / تحويل إلى العربية" : "Passer en Français / التحويل للفرنسية"}
      className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-bold text-slate-700 transition hover:bg-slate-50 active:scale-95 cursor-pointer shadow-sm"
    >
      <span aria-hidden>🌐</span>
      <span className="font-semibold">{locale === "fr" ? "عربي" : "FR"}</span>
    </button>
  );
}
