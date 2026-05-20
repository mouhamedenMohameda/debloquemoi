/**
 * GET /api/admin/exercices/{id}/neighbors?only_unvalidated=true&matiere=math
 */
import { NextRequest, NextResponse } from "next/server";

import { requireAdminApi } from "@/lib/admin-guard";
import { getNeighbors, RagAdminError } from "@/lib/rag-admin";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, ctx: Ctx) {
  const guard = await requireAdminApi();
  if (guard) return guard;
  const { id } = await ctx.params;
  const { searchParams } = req.nextUrl;
  try {
    return NextResponse.json(
      await getNeighbors(id, {
        only_unvalidated: searchParams.get("only_unvalidated") === "true",
        matiere: searchParams.get("matiere") || undefined,
        filiere: searchParams.get("filiere") || undefined,
      }),
    );
  } catch (e) {
    if (e instanceof RagAdminError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    return NextResponse.json({ error: String(e) }, { status: 502 });
  }
}
