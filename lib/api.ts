import { API_URL, AUTH_API_URL } from "./config";
import { clearToken, loadToken } from "./auth";

export class ApiError extends Error {
  status: number;
  body: unknown;
  constructor(status: number, message: string, body: unknown) {
    super(message);
    this.status = status;
    this.body = body;
  }
}

type Method = "GET" | "POST" | "PUT" | "DELETE" | "PATCH";

/**
 * Callbacks externes (déclenchés par n'importe quel 401 sur les APIs).
 * Permet à useSession d'invalider le user et au router de rediriger vers /login.
 */
type AuthListener = () => void;
const authListeners: Set<AuthListener> = new Set();

export function onUnauthenticated(cb: AuthListener): () => void {
  authListeners.add(cb);
  return () => authListeners.delete(cb);
}

function notifyUnauthenticated() {
  for (const cb of authListeners) {
    try {
      cb();
    } catch {
      // ignore listener errors
    }
  }
}

async function request<T>(
  base: string,
  method: Method,
  path: string,
  body?: unknown,
  extraHeaders?: Record<string, string>,
): Promise<T> {
  const token = await loadToken();
  const headers: Record<string, string> = {
    Accept: "application/json",
    ...extraHeaders,
  };
  if (body !== undefined && !(body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }
  if (token) headers.Authorization = `Bearer ${token}`;

  const url = `${base}${path}`;
  let res: Response;
  try {
    res = await fetch(url, {
      method,
      headers,
      body:
        body === undefined
          ? undefined
          : body instanceof FormData
            ? body
            : JSON.stringify(body),
    });
  } catch (e) {
    // Échec réseau (offline, DNS, CORS, certif). Remonte un ApiError lisible
    // plutôt qu'un TypeError opaque ("Network request failed").
    const msg = e instanceof Error ? e.message : "Erreur réseau.";
    console.warn(`[api] fetch failed ${method} ${url}:`, msg);
    throw new ApiError(0, `Erreur réseau : ${msg}`, null);
  }

  const text = await res.text();
  const parsed: unknown = text ? safeJson(text) : null;

  if (!res.ok) {
    const msg = pickError(parsed) ?? `HTTP ${res.status}`;
    // 401 → on purge le token côté device et on prévient l'app pour rediriger.
    // Évite les boucles d'erreurs quand le JWT expire en plein milieu d'une session.
    if (res.status === 401 && token) {
      await clearToken();
      notifyUnauthenticated();
    }
    if (res.status >= 500) {
      console.warn(`[api] ${method} ${url} → ${res.status}: ${msg}`);
    }
    throw new ApiError(res.status, msg, parsed);
  }
  return parsed as T;
}

function safeJson(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    return s;
  }
}

function pickError(b: unknown): string | undefined {
  // Logique alignée sur jsonOrThrow côté web (Bac/app/src/lib/auth-api.ts) :
  // - Next.js renvoie { error: "..." }
  // - FastAPI renvoie { detail: "..." } pour les HTTPException,
  //   { detail: [{loc, msg, type}, ...] } pour les erreurs de validation Pydantic 422.
  if (!b || typeof b !== "object") return undefined;
  const obj = b as Record<string, unknown>;
  if (typeof obj.error === "string") return obj.error;
  if (typeof obj.message === "string") return obj.message;
  const detail = obj.detail;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail) && detail.length > 0) {
    // Pydantic 422 : on concatène les messages des champs invalides pour
    // que l'utilisateur voie quel champ a échoué (mieux que "HTTP 422").
    const msgs = detail
      .map((d) => {
        if (!d || typeof d !== "object") return null;
        const e = d as Record<string, unknown>;
        const loc = Array.isArray(e.loc) ? e.loc.slice(-1)[0] : undefined;
        const m = typeof e.msg === "string" ? e.msg : null;
        if (!m) return null;
        return loc ? `${String(loc)}: ${m}` : m;
      })
      .filter((s): s is string => !!s);
    if (msgs.length > 0) return msgs.join(" · ");
  }
  return undefined;
}

/** Client pour auth-api (FastAPI) : auth, credits, referrals, topup. */
export const authApi = {
  get: <T>(path: string) => request<T>(AUTH_API_URL, "GET", path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(AUTH_API_URL, "POST", path, body),
  postForm: <T>(path: string, form: FormData) =>
    request<T>(AUTH_API_URL, "POST", path, form),
};

/** Client pour Bac/app (Next.js) : features AI hint/ocr/exercises. */
export const api = {
  get: <T>(path: string) => request<T>(API_URL, "GET", path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(API_URL, "POST", path, body),
};
