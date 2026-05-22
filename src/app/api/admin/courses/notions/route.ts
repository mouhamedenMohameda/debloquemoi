/**
 * GET /api/admin/courses/notions — liste paginée + filtres des notions
 * candidates à la génération d'un cours. Gated par is_admin.
 */
import { NextRequest, NextResponse } from "next/server";

import { requireAdminApi } from "@/lib/admin-guard";
import { listNotions, RagAdminError } from "@/lib/rag-admin";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const guard = await requireAdminApi();
  if (guard) return guard;

  const { searchParams } = req.nextUrl;
  try {
    const data = await listNotions({
      matiere: searchParams.get("matiere") || undefined,
      filiere: searchParams.get("filiere") || undefined,
      min_exos: searchParams.get("min_exos")
        ? Number(searchParams.get("min_exos"))
        : undefined,
      has_course:
        searchParams.get("has_course") === null
          ? undefined
          : searchParams.get("has_course") === "true",
      q: searchParams.get("q") || undefined,
      sort:
        (searchParams.get("sort") as
          | "nb_exos_desc"
          | "nb_exos_asc"
          | "label"
          | "notion_id") || undefined,
      limit: searchParams.get("limit")
        ? Number(searchParams.get("limit"))
        : undefined,
      offset: searchParams.get("offset")
        ? Number(searchParams.get("offset"))
        : undefined,
    });
    return NextResponse.json(data);
  } catch (e) {
    if (e instanceof RagAdminError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    return NextResponse.json({ error: String(e) }, { status: 502 });
  }
}
