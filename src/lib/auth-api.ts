/**
 * Client TypeScript pour l'API auth-api (https://api.radar-mr.com).
 *
 * IMPORTANT : ce module n'est utilisable QUE côté serveur Next.js
 * (Server Components, API routes, Server Actions). Ne JAMAIS importer ce
 * fichier dans un composant client : il contient la clé S2S secrète.
 */

import "server-only";

const BASE = process.env.AUTH_API_URL ?? "https://api.radar-mr.com";
const S2S_KEY = process.env.AUTH_API_S2S_KEY ?? "";

if (!S2S_KEY && process.env.NODE_ENV !== "test") {
  // En dev, on warn une fois au boot. En prod, on laisse passer pour pouvoir
  // lire les logs au démarrage avant de crash.
  console.warn(
    "[auth-api] AUTH_API_S2S_KEY manquante. Les appels S2S vont échouer.",
  );
}

// ─── Types ───────────────────────────────────────────────────────────────────

export type AuthUser = {
  email: string;
  nni_masked: string;
  whatsapp_masked: string;
  is_admin: boolean;
  credit_balance: number;
  balance_mru: number;
  credits_expire_at: string | null;
  credits_blocked_reason: string | null;
  can_use_paid_features: boolean;
  referral_code: string | null;
};

export type WalletInfo = {
  user_id: number;
  balance_units: number;
  balance_mru: number;
  blocked_reason: string | null;
  expires_at: string | null;
};

export type LoginResult = {
  access_token: string;
  token_type: string;
  user: {
    email: string;
    nni_masked: string;
    whatsapp_masked: string;
    is_admin: boolean;
  };
};

export type CreditsMe = {
  feature_enabled: boolean;
  credit_balance: number;
  balance_mru: number;
  credits_expire_at: string | null;
  can_use_features: boolean;
  block_reason: string | null;
  email: string;
  is_admin: boolean;
  free_hints_remaining: number;
  free_hints_expires_at: string | null;
};

export type FreeHintConsumeResult = {
  consumed: boolean;
  remaining: number;
  expires_at: string | null;
  reason?: "expired" | "exhausted" | null;
};

export type TopupRequest = {
  id: number;
  status: "pending" | "approved" | "rejected";
  created_at: string | null;
  reviewed_at: string | null;
  credits_granted: number | null;
  granted_mru_approx: number | null;
  admin_note: string | null;
};

export type AdminTopupRequest = TopupRequest & {
  user_id: number;
  user_email: string;
  original_filename: string;
};

export type ReferralInfo = {
  referral_code: string | null;
  share_url: string | null;
  referred_count: number;
  paid_referred_count: number;
  bonus_signup_units: number;
  bonus_paid_units_referrer: number;
  bonus_paid_units_referred: number;
  bonus_signup_mru: number;
  bonus_paid_mru_referrer: number;
  bonus_paid_mru_referred: number;
};

class AuthApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public detail?: unknown,
  ) {
    super(message);
    this.name = "AuthApiError";
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function jsonOrThrow<T>(res: Response): Promise<T> {
  const text = await res.text();
  let body: unknown;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  if (!res.ok) {
    const detail =
      (body && typeof body === "object" && "detail" in body
        ? (body as { detail: unknown }).detail
        : body) ?? res.statusText;
    throw new AuthApiError(
      typeof detail === "string" ? detail : "Erreur auth-api",
      res.status,
      detail,
    );
  }
  return body as T;
}

// ─── Appels côté JWT utilisateur (login/register/me) ─────────────────────────

export async function register(input: {
  email: string;
  password: string;
  nni: string;
  whatsapp: string;
  referral_code?: string;
}): Promise<LoginResult> {
  const res = await fetch(`${BASE}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
    cache: "no-store",
  });
  return jsonOrThrow<LoginResult>(res);
}

export async function login(input: {
  email: string;
  password: string;
}): Promise<LoginResult> {
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
    cache: "no-store",
  });
  return jsonOrThrow<LoginResult>(res);
}

/** Récupère le profil + portefeuille du user à partir de son JWT. */
export async function me(jwt: string): Promise<{ authenticated: true; user: AuthUser }> {
  const res = await fetch(`${BASE}/api/auth/me`, {
    headers: { Authorization: `Bearer ${jwt}` },
    cache: "no-store",
  });
  return jsonOrThrow<{ authenticated: true; user: AuthUser }>(res);
}

// ─── Appels S2S (clé X-Api-Key, jamais exposée au client) ────────────────────

export async function walletInfo(userId: number): Promise<WalletInfo> {
  const res = await fetch(
    `${BASE}/s2s/wallet/me?user_id=${userId}`,
    {
      headers: { "X-Api-Key": S2S_KEY },
      cache: "no-store",
    },
  );
  return jsonOrThrow<WalletInfo>(res);
}

/** Consomme un free hint (upload gratuit). À appeler AVANT walletDebit côté /api/hint.
 * Si {consumed:true} : on a décrémenté le compteur user, on n'a PAS débité MRU.
 * Si {consumed:false} : free hints expirés ou épuisés → bascule sur MRU.
 */
export async function freeHintConsume(userId: number): Promise<FreeHintConsumeResult> {
  const res = await fetch(`${BASE}/s2s/free-hint/consume`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Api-Key": S2S_KEY,
    },
    body: JSON.stringify({ user_id: userId }),
    cache: "no-store",
  });
  return jsonOrThrow<FreeHintConsumeResult>(res);
}

export async function walletDebit(input: {
  user_id: number;
  amount_units: number;
  external_ref?: string;
  note?: string;
}): Promise<WalletInfo & { debited_units: number; transaction_id: number }> {
  const res = await fetch(`${BASE}/s2s/wallet/debit`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Api-Key": S2S_KEY,
    },
    body: JSON.stringify(input),
    cache: "no-store",
  });
  return jsonOrThrow(res);
}

export async function walletCredit(input: {
  user_id: number;
  amount_units: number;
  external_ref?: string;
  note?: string;
}) {
  const res = await fetch(`${BASE}/s2s/wallet/credit`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Api-Key": S2S_KEY,
    },
    body: JSON.stringify(input),
    cache: "no-store",
  });
  return jsonOrThrow(res);
}

// ─── Appels JWT user (topup / referral / profile) ────────────────────────────

function authHeaders(jwt: string): HeadersInit {
  return { Authorization: `Bearer ${jwt}` };
}

/** Détails portefeuille (solde, expiration, raison de blocage). */
export async function creditsMe(jwt: string): Promise<CreditsMe> {
  const res = await fetch(`${BASE}/api/credits/me`, {
    headers: authHeaders(jwt),
    cache: "no-store",
  });
  return jsonOrThrow<CreditsMe>(res);
}

/** Liste des demandes de top-up du user connecté. */
export async function myTopupRequests(
  jwt: string,
): Promise<{ requests: TopupRequest[] }> {
  const res = await fetch(`${BASE}/api/credits/topup-requests/mine`, {
    headers: authHeaders(jwt),
    cache: "no-store",
  });
  return jsonOrThrow(res);
}

/** Upload d'une preuve de paiement (image). Retourne la demande créée. */
export async function createTopupRequest(
  jwt: string,
  file: File,
): Promise<{ id: number; status: string; message: string }> {
  const form = new FormData();
  form.append("file", file, file.name);
  const res = await fetch(`${BASE}/api/credits/topup-requests`, {
    method: "POST",
    headers: authHeaders(jwt), // pas de Content-Type : fetch le pose seul pour multipart
    body: form,
    cache: "no-store",
  });
  return jsonOrThrow(res);
}

/** Infos de parrainage du user connecté. */
export async function referralInfo(jwt: string): Promise<ReferralInfo> {
  const res = await fetch(`${BASE}/api/referrals/me`, {
    headers: authHeaders(jwt),
    cache: "no-store",
  });
  return jsonOrThrow<ReferralInfo>(res);
}

// ─── Endpoints admin (JWT du compte admin) ───────────────────────────────────

export async function adminListTopups(
  jwt: string,
  status: "pending" | "approved" | "rejected" | "all" = "pending",
): Promise<{ requests: AdminTopupRequest[] }> {
  const res = await fetch(
    `${BASE}/api/admin/credit-topups?status=${encodeURIComponent(status)}`,
    { headers: authHeaders(jwt), cache: "no-store" },
  );
  return jsonOrThrow(res);
}

export async function adminApproveTopup(
  jwt: string,
  requestId: number,
  body: { mru_credit: number; admin_note?: string; extend_validity_days?: number },
): Promise<{ ok: true; user_id: number; balance_mru_approx: number; credits_expire_at: string | null }> {
  const res = await fetch(`${BASE}/api/admin/credit-topups/${requestId}/approve`, {
    method: "POST",
    headers: { ...authHeaders(jwt), "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  return jsonOrThrow(res);
}

export async function adminRejectTopup(
  jwt: string,
  requestId: number,
  body: { admin_note?: string },
): Promise<{ ok: true }> {
  const res = await fetch(`${BASE}/api/admin/credit-topups/${requestId}/reject`, {
    method: "POST",
    headers: { ...authHeaders(jwt), "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  return jsonOrThrow(res);
}

/** URL absolue d'une preuve de virement (à passer en src d'une <img>). */
export function adminProofUrl(requestId: number): string {
  return `${BASE}/api/admin/credit-topups/${requestId}/proof`;
}

export { AuthApiError };
