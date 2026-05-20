/**
 * GET /api/admin/exercices — liste paginée + filtres.
 * Gated par is_admin via auth-api ; proxy vers rag-service /admin/exercises.
 */
import { NextRequest, NextResponse } from "next/server";

import { requireAdminApi } from "@/lib/admin-guard";
import { listExercises, RagAdminError } from "@/lib/rag-admin";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const guard = await requireAdminApi();
  if (guard) return guard;

  const { searchParams } = req.nextUrl;
  try {
    const data = await listExercises({
      matiere: searchParams.get("matiere") || undefined,
      annee: searchParams.get("annee") ? Number(searchParams.get("annee")) : undefined,
      validated:
        searchParams.get("validated") === null
          ? undefined
          : searchParams.get("validated") === "true",
      q: searchParams.get("q") || undefined,
      sort: (searchParams.get("sort") as "unvalidated_first" | "id") || undefined,
      limit: searchParams.get("limit") ? Number(searchParams.get("limit")) : 50,
      offset: searchParams.get("offset") ? Number(searchParams.get("offset")) : 0,
    });
    return NextResponse.json(data);
  } catch (e) {
    if (e instanceof RagAdminError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    return NextResponse.json({ error: String(e) }, { status: 502 });
  }
}
