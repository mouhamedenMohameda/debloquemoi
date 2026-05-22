/**
 * GET    /api/admin/courses/{notion_id} — détail (notion + exos + cours stocké)
 * PATCH  /api/admin/courses/{notion_id} — édition manuelle du cours
 * DELETE /api/admin/courses/{notion_id} — supprime le cours (la notion reste)
 */
import { NextRequest, NextResponse } from "next/server";

import { requireAdminApi } from "@/lib/admin-guard";
import {
  deleteCourse,
  getCourseDetail,
  patchCourse,
  RagAdminError,
} from "@/lib/rag-admin";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ notion_id: string }> };

export async function GET(_req: NextRequest, ctx: Ctx) {
  const guard = await requireAdminApi();
  if (guard) return guard;
  const { notion_id } = await ctx.params;
  try {
    return NextResponse.json(await getCourseDetail(notion_id));
  } catch (e) {
    if (e instanceof RagAdminError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    return NextResponse.json({ error: String(e) }, { status: 502 });
  }
}

export async function PATCH(req: NextRequest, ctx: Ctx) {
  const guard = await requireAdminApi();
  if (guard) return guard;
  const { notion_id } = await ctx.params;
  let body: { content?: string; validated_by_admin?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 });
  }
  try {
    return NextResponse.json(await patchCourse(notion_id, body));
  } catch (e) {
    if (e instanceof RagAdminError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    return NextResponse.json({ error: String(e) }, { status: 502 });
  }
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const guard = await requireAdminApi();
  if (guard) return guard;
  const { notion_id } = await ctx.params;
  try {
    return NextResponse.json(await deleteCourse(notion_id));
  } catch (e) {
    if (e instanceof RagAdminError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    return NextResponse.json({ error: String(e) }, { status: 502 });
  }
}
