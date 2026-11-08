/**
 * POST /api/admin/chapters/registry-notion — crée une notion canonique
 * (idempotent sur le label). Body : { matiere_id, label }
 */
import { NextRequest, NextResponse } from "next/server";

import { requireAdminApi } from "@/lib/admin-guard";
import { createRegistryNotion, RagAdminError } from "@/lib/rag-admin";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const guard = await requireAdminApi();
  if (guard) return guard;
  let body: { matiere_id: string; label: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 });
  }
  try {
    return NextResponse.json(await createRegistryNotion(body));
  } catch (e) {
    if (e instanceof RagAdminError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    return NextResponse.json({ error: String(e) }, { status: 502 });
  }
}
