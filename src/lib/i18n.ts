import { cookies } from "next/headers";
import { translations, Locale } from "./translations";

export async function getLocaleServer(): Promise<Locale> {
  try {
    const cookieStore = await cookies();
    const locale = cookieStore.get("NEXT_LOCALE")?.value as Locale;
    return locale === "ar" ? "ar" : "fr";
  } catch (e) {
    // Dans certains contextes où les cookies ne sont pas disponibles (build statique par ex)
    return "fr";
  }
}

export async function getTranslationsServer() {
  const locale = await getLocaleServer();
  return {
    t: translations[locale],
    locale,
  };
}
