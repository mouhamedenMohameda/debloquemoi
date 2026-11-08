/**
 * GET /api/admin/chapters/preview?filiere&matiere&chapitre — vue élève (avec
 * les infos admin sur ce qui est caché), publiée ou non.
 */
import { NextRequest, NextResponse } from "next/server";

import { requireAdminApi } from "@/lib/admin-guard";
import { getChapterPreview, RagAdminError } from "@/lib/rag-admin";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const guard = await requireAdminApi();
  if (guard) return guard;
  const sp = req.nextUrl.searchParams;
  const filiere = sp.get("filiere");
  const matiere = sp.get("matiere");
  const chapitre = sp.get("chapitre");
  if (!filiere || !matiere || !chapitre) {
    return NextResponse.json({ error: "filiere, matiere et chapitre requis." }, { status: 400 });
  }
  try {
    return NextResponse.json(await getChapterPreview({ filiere, matiere, chapitre }));
  } catch (e) {
    if (e instanceof RagAdminError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    return NextResponse.json({ error: String(e) }, { status: 502 });
  }
}
