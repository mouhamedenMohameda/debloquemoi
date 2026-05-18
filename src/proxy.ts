/**
 * Proxy Next.js 16 (anciennement middleware) — auth gate.
 *
 * Toute requête qui n'est PAS dans la whitelist (login, register, assets...)
 * doit avoir un cookie de session non expiré. Sinon : redirect vers /login.
 *
 * NB : on ne vérifie ici que l'existence + l'expiration LOCALE du JWT.
 * La vérification cryptographique est faite côté auth-api (Python) à chaque
 * appel /api/auth/me ou S2S — c'est lui la source de vérité.
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { decodeJwt } from "jose";

const COOKIE_NAME = process.env.SESSION_COOKIE_NAME ?? "debloquemoi_session";

// Chemins publics (pas besoin d'être connecté).
const PUBLIC_PATHS = new Set<string>([
  "/login",
  "/register",
  "/forgot-password",
]);

// Préfixes publics (assets, internals Next, etc.)
const PUBLIC_PREFIXES = [
  "/_next",
  "/api/health",
  "/favicon",
  "/static",
];

function isPublic(pathname: string): boolean {
  if (PUBLIC_PATHS.has(pathname)) return true;
  return PUBLIC_PREFIXES.some((p) => pathname.startsWith(p));
}

function hasValidSession(req: NextRequest): boolean {
  const tok = req.cookies.get(COOKIE_NAME)?.value;
  if (!tok) return false;
  try {
    const p = decodeJwt(tok);
    if (!p.exp) return false;
    return p.exp * 1000 > Date.now();
  } catch {
    return false;
  }
}

export function proxy(req: NextRequest) {
  const { pathname, search } = req.nextUrl;

  if (isPublic(pathname)) {
    // Si déjà connecté et qu'on tente /login ou /register → renvoyer à l'accueil
    if ((pathname === "/login" || pathname === "/register") && hasValidSession(req)) {
      return NextResponse.redirect(new URL("/", req.url));
    }
    return NextResponse.next();
  }

  if (!hasValidSession(req)) {
    const url = new URL("/login", req.url);
    // Garde l'URL d'origine pour rediriger après login (à brancher plus tard)
    url.searchParams.set("next", pathname + search);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  // Applique à tout, sauf assets et API internes spécifiques (gérés par PUBLIC_PREFIXES).
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
