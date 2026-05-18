"use server";

import { revalidatePath } from "next/cache";

import { AuthApiError, createTopupRequest } from "@/lib/auth-api";
import { getJwt } from "@/lib/session";

export type TopupActionResult =
  | { ok: true; id: number; message: string }
  | { ok: false; error: string };

const MAX_BYTES = 6 * 1024 * 1024;
const ALLOWED_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
  "image/gif",
]);

export async function uploadTopupAction(
  formData: FormData,
): Promise<TopupActionResult> {
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: "Choisis une capture de ton virement." };
  }
  if (file.size > MAX_BYTES) {
    return { ok: false, error: "Fichier trop lourd (max 6 Mo)." };
  }
  if (!ALLOWED_TYPES.has(file.type)) {
    return {
      ok: false,
      error: "Format accepté : PNG, JPG, WEBP ou GIF.",
    };
  }

  const jwt = await getJwt();
  if (!jwt) {
    return { ok: false, error: "Reconnecte-toi pour envoyer ta preuve." };
  }

  try {
    const r = await createTopupRequest(jwt, file);
    revalidatePath("/topup");
    return { ok: true, id: r.id, message: r.message };
  } catch (e) {
    if (e instanceof AuthApiError) {
      return { ok: false, error: e.message };
    }
    return { ok: false, error: "Erreur d'envoi. Réessaye." };
  }
}
