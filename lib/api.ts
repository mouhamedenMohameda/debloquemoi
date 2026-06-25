import { API_URL, AUTH_API_URL } from "./config";
import { loadToken } from "./auth";

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

  const res = await fetch(`${base}${path}`, {
    method,
    headers,
    body:
      body === undefined
        ? undefined
        : body instanceof FormData
          ? body
          : JSON.stringify(body),
  });

  const text = await res.text();
  const parsed: unknown = text ? safeJson(text) : null;

  if (!res.ok) {
    const msg = pickError(parsed) ?? `HTTP ${res.status}`;
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
  // Même logique que jsonOrThrow côté web (Bac/app/src/lib/auth-api.ts) :
  // FastAPI renvoie { detail: ... }, Next.js renvoie { error: ... }.
  // Si detail n'est pas une string (ex: array Pydantic 422), on renvoie un
  // message générique — la validation côté client doit intercepter avant.
  if (!b || typeof b !== "object") return undefined;
  const obj = b as Record<string, unknown>;
  if (typeof obj.error === "string") return obj.error;
  if (typeof obj.detail === "string") return obj.detail;
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
