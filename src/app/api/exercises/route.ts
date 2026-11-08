/**
 * GET /api/exercises — Liste les exercices du json_bac avec ennoncé.
 * Proxy vers le rag-service /admin/exercises (clé S2S server-side).
 * Requiert une session active (pas forcément admin).
 *
 * Query params (tous optionnels) :
 *   matiere   = math | pc | svt
 *   filiere   = C | D
 *   annee     = 2015..2025
 *   q         = recherche texte libre dans l'énoncé
 *   limit     = 20 (défaut)
 *   offset    = 0  (défaut)
 */

import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";

const BASE = process.env.RAG_SERVICE_URL ?? "http://127.0.0.1:8001";
const S2S_KEY = process.env.RAG_S2S_KEY ?? "";

export async function GET(req: NextRequest) {
  // ── Auth ────────────────────────────────────────────────────────────────
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Non connecté" }, { status: 401 });
  }

  // ── Paramètres ──────────────────────────────────────────────────────────
  const sp = req.nextUrl.searchParams;
  const params = new URLSearchParams({
    skeleton: "false",   // exclure les squelettes vides
    limit: sp.get("limit") ?? "20",
    offset: sp.get("offset") ?? "0",
    sort: "chronological",
  });

  const matiere = sp.get("matiere");
  const filiere = sp.get("filiere");
  const annee = sp.get("annee");
  const q = sp.get("q");

  if (matiere) params.set("matiere", matiere);
  if (filiere) params.set("filiere", filiere);
  if (annee) params.set("annee", annee);
  if (q) params.set("q", q);

  // ── Proxy vers rag-service ──────────────────────────────────────────────
  try {
    const ctrl = new AbortController();
    const timeout = setTimeout(() => ctrl.abort(), 5000);
    const res = await fetch(`${BASE}/admin/exercises?${params}`, {
      headers: { "X-Api-Key": S2S_KEY },
      signal: ctrl.signal,
    });
    clearTimeout(timeout);

    if (!res.ok) {
      return NextResponse.json({ error: "rag-service indisponible" }, { status: 502 });
    }

    const data = await res.json();

    // On renvoie les exercices avec l'énoncé complet (le client en a besoin
    // pour pré-remplir le champ exercice de l'app).
    // Le payload /admin/exercises renvoie déjà ennonce_preview (140 chars).
    // Pour avoir l'énoncé complet, on pourrait faire N+1 appels, mais c'est
    // coûteux. On utilise ennonce_preview pour le picker et on charge le
    // détail à la sélection via /api/exercises/[id].
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: "Timeout rag-service" }, { status: 504 });
  }
}
