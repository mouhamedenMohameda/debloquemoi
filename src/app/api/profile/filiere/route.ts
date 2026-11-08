/**
 * POST /api/profile/filiere — enregistre la série du bac de l'élève (C ou D)
 * dans son profil auth-api. Demandée une seule fois, modifiable ensuite.
 */
import { NextRequest, NextResponse } from "next/server";

import { AuthApiError, updateBacFiliere } from "@/lib/auth-api";
import { getJwt } from "@/lib/session";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const jwt = await getJwt();
  if (!jwt) return NextResponse.json({ error: "Connecte-toi pour continuer." }, { status: 401 });
  let filiere = "";
  try {
    filiere = String((await req.json())?.bac_filiere ?? "").trim().toUpperCase();
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 });
  }
  if (filiere !== "C" && filiere !== "D") {
    return NextResponse.json({ error: "Série invalide (C ou D)." }, { status: 400 });
  }
  try {
    return NextResponse.json(await updateBacFiliere(jwt, filiere));
  } catch (e) {
    const status = e instanceof AuthApiError ? e.status : 502;
    return NextResponse.json({ error: "Impossible d'enregistrer la série." }, { status });
  }
}
