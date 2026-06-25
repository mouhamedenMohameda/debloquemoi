import Constants from "expo-constants";

/**
 * URL d'auth-api (FastAPI Python).
 * Gère login, register, me, credits, referrals, topup.
 * Par défaut : prod de Bac.
 */
const fallbackAuth = "https://api.radar-mr.com";

/**
 * URL du backend Next.js (Bac/app déployé).
 * Gère les features AI : /api/hint, /api/ocr, /api/exercises.
 * À configurer via EXPO_PUBLIC_API_URL dans .env.local.
 */
const fallbackApi = "https://CHANGE_ME.example.com";

export const AUTH_API_URL: string =
  process.env.EXPO_PUBLIC_AUTH_API_URL ??
  (Constants.expoConfig?.extra?.authApiUrl as string | undefined) ??
  fallbackAuth;

export const API_URL: string =
  process.env.EXPO_PUBLIC_API_URL ??
  (Constants.expoConfig?.extra?.apiUrl as string | undefined) ??
  fallbackApi;
