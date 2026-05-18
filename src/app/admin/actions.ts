"use server";

import { revalidatePath } from "next/cache";

import {
  AuthApiError,
  adminApproveTopup,
  adminRejectTopup,
  me,
} from "@/lib/auth-api";
import { getJwt } from "@/lib/session";

export type AdminActionResult =
  | { ok: true; message?: string }
  | { ok: false; error: string };

async function adminJwt(): Promise<string | { error: string }> {
  const jwt = await getJwt();
  if (!jwt) return { error: "Reconnecte-toi." };
  try {
    const r = await me(jwt);
    if (!r.user.is_admin) return { error: "Action réservée aux admins." };
    return jwt;
  } catch {
    return { error: "Session invalide." };
  }
}

export async function approveTopupAction(
  formData: FormData,
): Promise<AdminActionResult> {
  const idRaw = formData.get("request_id");
  const mruRaw = formData.get("mru_credit");
  const note = String(formData.get("admin_note") ?? "").trim() || undefined;
  const daysRaw = formData.get("extend_validity_days");

  const requestId = Number(idRaw);
  const mru = Number(mruRaw);
  if (!Number.isInteger(requestId) || requestId <= 0) {
    return { ok: false, error: "ID demande invalide." };
  }
  if (!Number.isFinite(mru) || mru <= 0) {
    return { ok: false, error: "Indique un montant MRU > 0." };
  }
  const days = daysRaw ? Number(daysRaw) : undefined;
  if (days !== undefined && (!Number.isInteger(days) || days < 1 || days > 3650)) {
    return { ok: false, error: "Durée de validité invalide (1..3650 jours)." };
  }

  const j = await adminJwt();
  if (typeof j !== "string") return { ok: false, error: j.error };

  try {
    const r = await adminApproveTopup(j, requestId, {
      mru_credit: mru,
      admin_note: note,
      extend_validity_days: days,
    });
    revalidatePath("/admin");
    return {
      ok: true,
      message: `Approuvée — solde user ${r.user_id} : ${r.balance_mru_approx.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} MRU`,
    };
  } catch (e) {
    if (e instanceof AuthApiError) return { ok: false, error: e.message };
    return { ok: false, error: "Erreur d'approbation." };
  }
}

export async function rejectTopupAction(
  formData: FormData,
): Promise<AdminActionResult> {
  const requestId = Number(formData.get("request_id"));
  const note = String(formData.get("admin_note") ?? "").trim() || undefined;
  if (!Number.isInteger(requestId) || requestId <= 0) {
    return { ok: false, error: "ID demande invalide." };
  }

  const j = await adminJwt();
  if (typeof j !== "string") return { ok: false, error: j.error };

  try {
    await adminRejectTopup(j, requestId, { admin_note: note });
    revalidatePath("/admin");
    return { ok: true, message: "Demande rejetée." };
  } catch (e) {
    if (e instanceof AuthApiError) return { ok: false, error: e.message };
    return { ok: false, error: "Erreur de rejet." };
  }
}
