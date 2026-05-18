"use server";

import { redirect } from "next/navigation";
import {
  AuthApiError,
  login as apiLogin,
  register as apiRegister,
} from "@/lib/auth-api";
import { clearSessionCookie, setSessionCookie } from "@/lib/session";

export type ActionResult =
  | { ok: true }
  | { ok: false; error: string };

export async function loginAction(formData: FormData): Promise<ActionResult> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!email || !password) {
    return { ok: false, error: "Email et mot de passe requis." };
  }
  try {
    const r = await apiLogin({ email, password });
    await setSessionCookie(r.access_token);
  } catch (e) {
    if (e instanceof AuthApiError) {
      return { ok: false, error: e.message };
    }
    return { ok: false, error: "Erreur de connexion. Réessaye." };
  }
  // En cas de succès on redirige côté serveur (ne PAS renvoyer ok: true ici
  // car redirect() throw et l'appelant ne le voit pas — l'élève sera redirigé).
  redirect("/");
}

export async function registerAction(formData: FormData): Promise<ActionResult> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const nni = String(formData.get("nni") ?? "").trim();
  const whatsapp = String(formData.get("whatsapp") ?? "").trim();
  const referral_code = String(formData.get("referral_code") ?? "").trim() || undefined;

  if (!email || !password || !nni || !whatsapp) {
    return { ok: false, error: "Tous les champs sont requis." };
  }
  if (password.length < 8) {
    return { ok: false, error: "Mot de passe : 8 caractères minimum." };
  }
  try {
    const r = await apiRegister({ email, password, nni, whatsapp, referral_code });
    await setSessionCookie(r.access_token);
  } catch (e) {
    if (e instanceof AuthApiError) {
      return { ok: false, error: e.message };
    }
    return { ok: false, error: "Erreur d'inscription. Réessaye." };
  }
  redirect("/");
}

export async function logoutAction() {
  await clearSessionCookie();
  redirect("/login");
}
