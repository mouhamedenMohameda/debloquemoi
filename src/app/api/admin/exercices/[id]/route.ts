/**
 * GET    /api/admin/exercices/{id} — détail
 * PATCH  /api/admin/exercices/{id} — édition partielle (ennonce, notions, …)
 */
import { NextRequest, NextResponse } from "next/server";

import { requireAdminApi } from "@/lib/admin-guard";
import {
  deleteExercise,
  getExercise,
  patchExercise,
  RagAdminError,
  type ExerciceUpdate,
} from "@/lib/rag-admin";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: Ctx) {
  const guard = await requireAdminApi();
  if (guard) return guard;
  const { id } = await ctx.params;
  try {
    return NextResponse.json(await getExercise(id));
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
  const { id } = await ctx.params;
  let body: ExerciceUpdate;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 });
  }
  try {
    return NextResponse.json(await patchExercise(id, body));
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
  const { id } = await ctx.params;
  try {
    return NextResponse.json(await deleteExercise(id));
  } catch (e) {
    if (e instanceof RagAdminError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    return NextResponse.json({ error: String(e) }, { status: 502 });
  }
}
