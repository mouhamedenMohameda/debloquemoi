/**
 * POST /api/admin/chapters/publish — publie ou dépublie un chapitre.
 * Body : { filiere_id, matiere_id, chapitre, published: boolean }
 */
import { NextRequest, NextResponse } from "next/server";

import { requireAdminApi } from "@/lib/admin-guard";
import { publishChapter, RagAdminError } from "@/lib/rag-admin";
import type { ChapterScope } from "@/lib/rag-admin";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const guard = await requireAdminApi();
  if (guard) return guard;
  let body: ChapterScope & { published: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 });
  }
  try {
    return NextResponse.json(await publishChapter(body));
  } catch (e) {
    if (e instanceof RagAdminError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    return NextResponse.json({ error: String(e) }, { status: 502 });
  }
}
