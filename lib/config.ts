import Constants from "expo-constants";
import { Platform } from "react-native";

/**
 * URL d'auth-api (FastAPI Python).
 * Gère login, register, me, credits, referrals, topup.
 * Par défaut : prod de Bac.
 */
const fallbackAuth = "https://api.radar-mr.com";

function resolveUrl(envKey: string, extraKey: string, fallback: string): string {
  const fromEnv = process.env[envKey]?.trim();
  if (fromEnv) return fromEnv;
  const fromExtra = Constants.expoConfig?.extra?.[extraKey] as string | undefined;
  if (fromExtra?.trim()) return fromExtra.trim();
  return fallback;
}

function getLocalApiFallback(): string {
  const debuggerHost =
    (Constants.expoConfig?.hostUri as string | undefined) ??
    (Constants.expoConfig?.extra?.expoGo?.debuggerHost as string | undefined) ??
    "";

  if (debuggerHost) {
    const host = debuggerHost.split(":")[0];
    if (host && host !== "localhost" && host !== "127.0.0.1" && host !== "0.0.0.0") {
      return `http://${host}:3000`;
    }
  }

  if (Platform.OS === "android") return "http://10.0.2.2:3000";
  return "http://localhost:3000";
}

export const AUTH_API_URL: string = resolveUrl(
  "EXPO_PUBLIC_AUTH_API_URL",
  "authApiUrl",
  fallbackAuth,
);

export const API_URL: string = resolveUrl(
  "EXPO_PUBLIC_API_URL",
  "apiUrl",
  getLocalApiFallback(),
);
