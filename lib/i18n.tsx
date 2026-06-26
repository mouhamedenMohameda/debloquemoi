import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { ActivityIndicator, Alert, I18nManager, View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Updates from "expo-updates";
import { translations, type Locale } from "./translations";

const STORAGE_KEY = "debloquemoi_locale";

type LanguageContextType = {
  locale: Locale;
  t: typeof translations.fr;
  setLocale: (locale: Locale) => Promise<void>;
};

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

/**
 * Initialise la direction RTL/LTR pour l'arabe AVANT le rendu (au boot de
 * l'app). À appeler une seule fois depuis app/_layout.tsx avant que les
 * écrans soient instanciés.
 *
 * Sur native (iOS/Android), I18nManager.forceRTL() nécessite un reload de
 * l'app pour appliquer le flip de layout. On utilise expo-updates pour ça.
 */
async function applyDirectionIfNeeded(locale: Locale): Promise<boolean> {
  const wantRtl = locale === "ar";
  if (I18nManager.isRTL === wantRtl) return false;
  I18nManager.allowRTL(wantRtl);
  I18nManager.forceRTL(wantRtl);
  return true;
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale | null>(null);

  // Charge la locale stockée. On bloque le rendu sur null pour éviter un
  // flash en français puis bascule arabe.
  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        const next: Locale = raw === "ar" ? "ar" : "fr";
        await applyDirectionIfNeeded(next);
        setLocaleState(next);
      } catch {
        setLocaleState("fr");
      }
    })();
  }, []);

  const setLocale = useCallback(
    async (next: Locale) => {
      try {
        await AsyncStorage.setItem(STORAGE_KEY, next);
      } catch {
        // ignore
      }
      const flipped = await applyDirectionIfNeeded(next);
      if (flipped) {
        // Reload obligatoire pour que I18nManager bascule effectivement.
        try {
          await Updates.reloadAsync();
        } catch {
          Alert.alert(
            "Redémarre l'app",
            "Ferme et rouvre Débloque-moi pour appliquer la nouvelle langue.",
          );
        }
      } else {
        setLocaleState(next);
      }
    },
    [],
  );

  if (locale === null) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: "#fff",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <LanguageContext.Provider
      value={{ locale, t: translations[locale], setLocale }}
    >
      {children}
    </LanguageContext.Provider>
  );
}

export function useTranslation() {
  const ctx = useContext(LanguageContext);
  if (!ctx) {
    throw new Error("useTranslation must be used within a LanguageProvider");
  }
  return ctx;
}

export { type Locale } from "./translations";
