/**
 * POST /api/admin/courses/{notion_id}/generate — lance la génération via Groq.
 * Body : { force?: boolean, max_context_exos?: number }
 * Idempotent : 409 si cours existant et force=false.
 */
import { NextRequest, NextResponse } from "next/server";

import { requireAdminApi } from "@/lib/admin-guard";
import { generateCourse, RagAdminError } from "@/lib/rag-admin";

export const runtime = "nodejs";
// La génération LLM peut prendre 10-30s — augmenter la limite Next.js
export const maxDuration = 60;

type Ctx = { params: Promise<{ notion_id: string }> };

export async function POST(req: NextRequest, ctx: Ctx) {
  const guard = await requireAdminApi();
  if (guard) return guard;
  const { notion_id } = await ctx.params;
  let body: { force?: boolean; max_context_exos?: number } = {};
  try {
    body = await req.json().catch(() => ({}));
  } catch {
    body = {};
  }
  try {
    return NextResponse.json(await generateCourse(notion_id, body));
  } catch (e) {
    if (e instanceof RagAdminError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    return NextResponse.json({ error: String(e) }, { status: 502 });
  }
}
