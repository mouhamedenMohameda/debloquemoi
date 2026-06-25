/**
 * Gestion de la session côté Next.js.
 *
 * Le JWT émis par auth-api est stocké dans un cookie httpOnly Secure.
 * Pour décoder ce JWT (sans vérifier la signature — auth-api est la seule
 * autorité), on utilise `jose` qui marche en Edge runtime (middleware).
 *
 * Toute lecture sécurisée du user passe par /api/auth/me sur auth-api
 * (qui re-vérifie la signature côté serveur Python).
 *
 * ── Mobile (Authorization Bearer) ──────────────────────────────────────
 * Les clients mobiles (Bac/mobile, Expo/React Native) n'utilisent PAS le
 * cookie httpOnly : ils envoient `Authorization: Bearer <jwt>`.
 * Comme un Bearer header est entièrement contrôlé par le client (contrairement
 * au cookie httpOnly), on ne peut pas se contenter d'un decode sans vérif :
 * on appelle auth-api `/api/auth/me` pour valider la signature et récupérer
 * le payload. C'est plus lent (~100-300 ms) mais sécurisé.
 */

import "server-only";

import { cookies, headers } from "next/headers";
import { decodeJwt } from "jose";

const COOKIE_NAME = process.env.SESSION_COOKIE_NAME ?? "debloquemoi_session";
const COOKIE_MAX_AGE = 14 * 24 * 60 * 60; // 14 jours (idem JWT côté auth-api)
const AUTH_API_BASE = process.env.AUTH_API_URL ?? "https://api.radar-mr.com";

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

function decodeSession(tok: string): Session | null {
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

async function verifyBearerWithAuthApi(tok: string): Promise<Session | null> {
  // Vérification stricte de la signature et de l'expiration via auth-api.
  // Empêche les Bearer forgés (le decode local ne vérifie pas la signature).
  try {
    const res = await fetch(`${AUTH_API_BASE}/api/auth/me`, {
      headers: { Authorization: `Bearer ${tok}` },
      cache: "no-store",
    });
    if (!res.ok) return null;
    // On a quand même besoin de user_id : on décode le JWT (signature
    // déjà validée par auth-api juste au-dessus).
    return decodeSession(tok);
  } catch {
    return null;
  }
}

/**
 * Décode le JWT du cookie OU de l'en-tête Authorization Bearer.
 * Renvoie null si pas de session ou token corrompu/expiré.
 *
 * Priorité au Bearer (mobile) ; fallback sur le cookie (web SSR).
 */
export async function getSession(): Promise<Session | null> {
  // 1) Authorization: Bearer <token> (mobile)
  try {
    const h = await headers();
    const auth = h.get("authorization") ?? h.get("Authorization");
    if (auth && /^Bearer\s+/i.test(auth)) {
      const tok = auth.replace(/^Bearer\s+/i, "").trim();
      if (tok) {
        const sess = await verifyBearerWithAuthApi(tok);
        if (sess) return sess;
      }
    }
  } catch {
    // headers() lève hors d'un contexte de requête : on continue vers cookie.
  }

  // 2) Cookie httpOnly (web)
  try {
    const store = await cookies();
    const tok = store.get(COOKIE_NAME)?.value;
    if (!tok) return null;
    return decodeSession(tok);
  } catch {
    return null;
  }
}

/**
 * Récupère le JWT brut (cookie ou Bearer) pour appeler auth-api avec.
 * Bearer prioritaire (mobile), sinon cookie (web).
 */
export async function getJwt(): Promise<string | null> {
  try {
    const h = await headers();
    const auth = h.get("authorization") ?? h.get("Authorization");
    if (auth && /^Bearer\s+/i.test(auth)) {
      const tok = auth.replace(/^Bearer\s+/i, "").trim();
      if (tok) return tok;
    }
  } catch {
    // ignore
  }
  try {
    const store = await cookies();
    return store.get(COOKIE_NAME)?.value ?? null;
  } catch {
    return null;
  }
}

/** Pose le cookie de session après un login/register réussi (web). */
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
