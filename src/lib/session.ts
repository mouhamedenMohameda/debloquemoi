/**
 * Gestion de la session côté Next.js.
 *
 * Le JWT émis par auth-api est stocké dans un cookie httpOnly Secure.
 * Pour décoder ce JWT (sans vérifier la signature — auth-api est la seule
 * autorité), on utilise `jose` qui marche en Edge runtime (middleware).
 *
 * Toute lecture sécurisée du user passe par /api/auth/me sur auth-api
 * (qui re-vérifie la signature côté serveur Python).
 */

import "server-only";

import { cookies } from "next/headers";
import { decodeJwt } from "jose";

const COOKIE_NAME = process.env.SESSION_COOKIE_NAME ?? "debloquemoi_session";
const COOKIE_MAX_AGE = 14 * 24 * 60 * 60; // 14 jours (idem JWT côté auth-api)

export type SessionPayload = {
  sub: string; // user_id (string dans le JWT)
  email: string;
  iat: number;
  exp: number;
};

export type Session = {
  user_id: number;
  email: string;
  expires_at: number; // epoch secondes
};

/** Décode le JWT du cookie. Renvoie null si pas de session ou token corrompu/expiré. */
export async function getSession(): Promise<Session | null> {
  const store = await cookies();
  const tok = store.get(COOKIE_NAME)?.value;
  if (!tok) return null;
  try {
    const p = decodeJwt(tok) as SessionPayload;
    if (!p.sub || !p.exp || p.exp * 1000 < Date.now()) return null;
    return {
      user_id: Number(p.sub),
      email: p.email,
      expires_at: p.exp,
    };
  } catch {
    return null;
  }
}

/** Récupère le JWT brut du cookie (pour appeler /api/auth/me sur auth-api). */
export async function getJwt(): Promise<string | null> {
  const store = await cookies();
  return store.get(COOKIE_NAME)?.value ?? null;
}

/** Pose le cookie de session après un login/register réussi. */
export async function setSessionCookie(jwt: string): Promise<void> {
  const store = await cookies();
  store.set(COOKIE_NAME, jwt, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: COOKIE_MAX_AGE,
  });
}

/** Supprime le cookie (logout). */
export async function clearSessionCookie(): Promise<void> {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}

export { COOKIE_NAME };
