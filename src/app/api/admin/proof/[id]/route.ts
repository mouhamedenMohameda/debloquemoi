/**
 * Proxy admin pour télécharger la preuve d'une demande de top-up.
 *
 * Le browser ne peut pas attacher d'Authorization header à une balise <img>.
 * On passe donc par cette route Next.js qui :
 *  1. Vérifie que la session existe ET que le user est admin
 *  2. Refait l'appel à auth-api avec le JWT
 *  3. Re-stream le binaire au browser
 */

import { NextRequest, NextResponse } from "next/server";

import { adminProofUrl, me } from "@/lib/auth-api";
import { getJwt } from "@/lib/session";

export const runtime = "nodejs";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const requestId = Number(id);
  if (!Number.isInteger(requestId) || requestId <= 0) {
    return NextResponse.json({ error: "id invalide" }, { status: 400 });
  }

  const jwt = await getJwt();
  if (!jwt) {
    return NextResponse.json({ error: "Non connecté" }, { status: 401 });
  }

  // Re-check admin côté auth-api (source de vérité)
  let isAdmin = false;
  try {
    const r = await me(jwt);
    isAdmin = !!r.user.is_admin;
  } catch {
    return NextResponse.json({ error: "Session invalide" }, { status: 401 });
  }
  if (!isAdmin) {
    return NextResponse.json({ error: "Réservé aux admins" }, { status: 403 });
  }

  const upstream = await fetch(adminProofUrl(requestId), {
    headers: { Authorization: `Bearer ${jwt}` },
    cache: "no-store",
  });
  if (!upstream.ok) {
    return NextResponse.json(
      { error: `auth-api ${upstream.status}` },
      { status: upstream.status },
    );
  }

  // ─── Forcer le bon Content-Type ────────────────────────────────────────
  // auth-api renvoie application/octet-stream → Safari refuse de l'afficher
  // comme <img>. On déduit le MIME à partir de l'extension du filename dans
  // le header Content-Disposition.
  const EXT_MIME: Record<string, string> = {
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    webp: "image/webp",
    gif: "image/gif",
  };

  const headers = new Headers();
  const cd = upstream.headers.get("content-disposition") ?? "";
  const fnameMatch = cd.match(/filename="?([^";]+)"?/i);
  const ext = fnameMatch?.[1]?.split(".").pop()?.toLowerCase() ?? "";
  const mime = EXT_MIME[ext] ?? "image/jpeg"; // fallback raisonnable pour MVP

  headers.set("content-type", mime);
  // On affiche en inline (pas téléchargement)
  headers.set("content-disposition", `inline${fnameMatch ? `; filename="${fnameMatch[1]}"` : ""}`);
  // Cache court côté browser pour éviter de re-télécharger pendant la review
  headers.set("cache-control", "private, max-age=60");

  return new NextResponse(upstream.body, { status: 200, headers });
}
