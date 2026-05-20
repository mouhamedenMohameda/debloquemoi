"use client";

import React, { createContext, useContext, useState } from "react";
import { translations, Locale } from "@/lib/translations";

type LanguageContextType = {
  locale: Locale;
  t: typeof translations.fr;
  setLocale: (locale: Locale) => void;
};

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({
  children,
  initialLocale,
}: {
  children: React.ReactNode;
  initialLocale: Locale;
}) {
  const [locale, setLocaleState] = useState<Locale>(initialLocale);

  const setLocale = (newLocale: Locale) => {
    setLocaleState(newLocale);
    // Définir le cookie pour persister le choix
    document.cookie = `NEXT_LOCALE=${newLocale}; path=/; max-age=31536000; SameSite=Lax`;
    // Recharger pour mettre à jour le HTML direction (dir="rtl") et les composants serveurs
    window.location.reload();
  };

  return (
    <LanguageContext.Provider value={{ locale, t: translations[locale], setLocale }}>
      <div dir={locale === "ar" ? "rtl" : "ltr"} className="w-full h-full flex flex-col flex-1">
        {children}
      </div>
    </LanguageContext.Provider>
  );
}

export function useTranslation() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error("useTranslation must be used within a LanguageProvider");
  }
  return context;
}
