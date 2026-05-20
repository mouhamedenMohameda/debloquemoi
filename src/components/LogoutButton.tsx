"use client";

import { useState } from "react";
import { useTranslation } from "./LanguageProvider";
import { logoutAction } from "@/app/(auth)/actions";

export function LogoutButton() {
  const { t, locale } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);

  const handleSubmit = () => {
    // Crée un formulaire temporaire et le soumet pour déclencher l'action serveur
    const form = document.createElement("form");
    form.action = "/api/auth/logout"; // fallback ou action directe
    form.method = "POST";
    
    // Pour Next.js server actions, on peut aussi appeler l'action directement
    // mais le plus simple et robuste avec le state est d'appeler l'action dans une transition
    // ou d'utiliser le formulaire d'origine.
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        title={t.nav.logout}
        className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-bold text-slate-700 transition hover:bg-slate-50 active:scale-95 cursor-pointer shadow-sm flex items-center justify-center gap-1"
      >
        <span className="hidden sm:inline">{t.nav.logout}</span>
        <span aria-hidden>🚪</span>
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop avec flou */}
          <div
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity"
            onClick={() => setIsOpen(false)}
          />

          {/* Fenêtre de dialogue (Card Modal) */}
          <div
            className="relative w-full max-w-sm transform overflow-hidden rounded-3xl border border-slate-100 bg-white p-6 text-center shadow-2xl transition-all animate-in fade-in zoom-in-95 duration-200"
            role="dialog"
            aria-modal="true"
          >
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-50 text-xl">
              🚪
            </div>

            <h3 className="text-base font-bold text-slate-900">
              {t.nav.logout}
            </h3>
            
            <p className="mt-2 text-xs leading-relaxed text-slate-500">
              {t.nav.confirmLogout}
            </p>

            <div className="mt-6 flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="flex-1 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 active:scale-98 cursor-pointer"
              >
                {t.common.cancel}
              </button>

              <form action={logoutAction} className="flex-1">
                <button
                  type="submit"
                  className="w-full rounded-xl bg-red-600 px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-red-700 active:scale-98 cursor-pointer shadow-sm"
                >
                  {t.nav.logout}
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
