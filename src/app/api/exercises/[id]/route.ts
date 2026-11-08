/**
 * GET /api/exercises/[id] — Détail d'un exercice (ennoncé complet inclus).
 * Proxy vers /admin/exercises/{id} du rag-service.
 * Requiert une session active.
 */

import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";

const BASE = process.env.RAG_SERVICE_URL ?? "http://127.0.0.1:8001";
const S2S_KEY = process.env.RAG_S2S_KEY ?? "";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Non connecté" }, { status: 401 });
  }

  const { id } = await params;
  if (!id || id.length > 200) {
    return NextResponse.json({ error: "ID invalide" }, { status: 400 });
  }

  try {
    const ctrl = new AbortController();
    const timeout = setTimeout(() => ctrl.abort(), 5000);
    const res = await fetch(`${BASE}/admin/exercises/${encodeURIComponent(id)}`, {
      headers: { "X-Api-Key": S2S_KEY },
      signal: ctrl.signal,
    });
    clearTimeout(timeout);

    if (res.status === 404) {
      return NextResponse.json({ error: "Exercice non trouvé" }, { status: 404 });
    }
    if (!res.ok) {
      return NextResponse.json({ error: "rag-service indisponible" }, { status: 502 });
    }

    const data = await res.json();

    // On renvoie uniquement les champs utiles à l'app (pas les champs admin).
    return NextResponse.json({
      id: data.id,
      titre: data.titre,
      matiere_id: data.matiere_id,
      filiere_id: data.filiere_id,
      annee: data.annee,
      session: data.session,
      exercice_numero: data.exercice_numero,
      chapitre: data.chapitre,
      chapitres: data.chapitres ?? [],
      notions_traitees: data.notions_traitees ?? [],
      ennonce_complet: data.ennonce_complet ?? "",
    });
  } catch {
    return NextResponse.json({ error: "Timeout rag-service" }, { status: 504 });
  }
}
