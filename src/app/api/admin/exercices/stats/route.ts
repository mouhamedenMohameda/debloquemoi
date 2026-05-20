/**
 * GET /api/admin/exercices/stats — totaux, répartition.
 */
import { NextResponse } from "next/server";

import { requireAdminApi } from "@/lib/admin-guard";
import { getAdminStats, RagAdminError } from "@/lib/rag-admin";

export const runtime = "nodejs";

export async function GET() {
  const guard = await requireAdminApi();
  if (guard) return guard;
  try {
    return NextResponse.json(await getAdminStats());
  } catch (e) {
    if (e instanceof RagAdminError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    return NextResponse.json({ error: String(e) }, { status: 502 });
  }
}
