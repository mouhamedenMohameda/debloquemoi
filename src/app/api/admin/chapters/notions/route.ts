/**
 * PUT /api/admin/chapters/notions — fixe la liste de notions d'un chapitre.
 * Body : { filiere_id, matiere_id, chapitre, notion_ids: string[] }
 */
import { NextRequest, NextResponse } from "next/server";

import { requireAdminApi } from "@/lib/admin-guard";
import { RagAdminError, setChapterNotions } from "@/lib/rag-admin";
import type { ChapterScope } from "@/lib/rag-admin";

export const runtime = "nodejs";

export async function PUT(req: NextRequest) {
  const guard = await requireAdminApi();
  if (guard) return guard;
  let body: ChapterScope & { notion_ids: string[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 });
  }
  try {
    return NextResponse.json(await setChapterNotions(body));
  } catch (e) {
    if (e instanceof RagAdminError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    return NextResponse.json({ error: String(e) }, { status: 502 });
  }
}
