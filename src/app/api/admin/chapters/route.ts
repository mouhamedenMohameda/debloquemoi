/**
 * GET /api/admin/chapters — grille série × matière × chapitre (statut + checklist).
 * Gated par is_admin ; proxy vers rag-service /admin/chapters.
 */
import { NextRequest, NextResponse } from "next/server";

import { requireAdminApi } from "@/lib/admin-guard";
import { listChapters, RagAdminError } from "@/lib/rag-admin";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const guard = await requireAdminApi();
  if (guard) return guard;
  const sp = req.nextUrl.searchParams;
  try {
    return NextResponse.json(
      await listChapters({
        filiere: sp.get("filiere") || undefined,
        matiere: sp.get("matiere") || undefined,
      }),
    );
  } catch (e) {
    if (e instanceof RagAdminError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    return NextResponse.json({ error: String(e) }, { status: 502 });
  }
}
