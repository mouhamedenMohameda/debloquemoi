/**
 * Garde admin commun pour toutes les routes /api/admin/exercices/*.
 *
 * Vérifie via auth-api que l'utilisateur connecté est admin. Renvoie
 * la réponse NextResponse 401/403 si non, ou null si OK.
 */
import "server-only";

import { NextResponse } from "next/server";

import { AuthApiError, me } from "@/lib/auth-api";
import { getJwt } from "@/lib/session";

export async function requireAdminApi(): Promise<NextResponse | null> {
  const jwt = await getJwt();
  if (!jwt) {
    return NextResponse.json({ error: "Non connecté." }, { status: 401 });
  }
  try {
    const r = await me(jwt);
    if (!r.user.is_admin) {
      return NextResponse.json({ error: "Accès admin requis." }, { status: 403 });
    }
    return null;
  } catch (e) {
    if (e instanceof AuthApiError && e.status === 401) {
      return NextResponse.json({ error: "Session expirée." }, { status: 401 });
    }
    return NextResponse.json({ error: "Erreur de vérification admin." }, { status: 502 });
  }
}
