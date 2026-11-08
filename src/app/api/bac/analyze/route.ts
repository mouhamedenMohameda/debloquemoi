/**
 * POST /api/bac/analyze — texte d'un exercice (lu sur la photo) → exercice du
 * bac reconnu, chapitre, notions, années, cours (chapitres publiés uniquement).
 *
 * Gratuit : aucune IA n'est appelée ici (la lecture de la photo est facturée
 * par /api/ocr). La série vient du profil de l'élève (auth-api).
 */
import { NextRequest, NextResponse } from "next/server";

import { AuthApiError, me } from "@/lib/auth-api";
import { analyzeExercise, CatalogError } from "@/lib/catalog";
import { getJwt } from "@/lib/session";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const jwt = await getJwt();
  if (!jwt) return NextResponse.json({ error: "Connecte-toi pour continuer." }, { status: 401 });

  let text = "";
  try {
    text = String((await req.json())?.text ?? "").trim();
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 });
  }
  if (text.length < 10) {
    return NextResponse.json({ error: "Énoncé trop court." }, { status: 400 });
  }

  let filiere: string | null = null;
  try {
    filiere = (await me(jwt)).user.bac_filiere ?? null;
  } catch (e) {
    if (e instanceof AuthApiError && e.status === 401) {
      return NextResponse.json({ error: "Session expirée." }, { status: 401 });
    }
    return NextResponse.json({ error: "Profil indisponible, réessaie." }, { status: 502 });
  }
  if (!filiere) {
    return NextResponse.json({ error: "Choisis d'abord ta série.", need_filiere: true }, { status: 409 });
  }

  try {
    return NextResponse.json(await analyzeExercise(filiere, text.slice(0, 20000)));
  } catch (e) {
    if (e instanceof CatalogError) {
      console.error("[bac/analyze]", e.status, e.message);
    } else {
      console.error("[bac/analyze]", e);
    }
    return NextResponse.json({ error: "Service indisponible, réessaie dans un instant." }, { status: 502 });
  }
}
