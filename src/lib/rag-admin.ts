/**
 * Client TypeScript pour l'admin API du rag-service.
 *
 * Server-only : utilise la clé S2S. Les appels viennent des routes
 * /api/admin/exercices/* qui proxient après avoir vérifié que
 * l'utilisateur connecté est admin (auth-api me().is_admin).
 */
import "server-only";

const BASE = process.env.RAG_SERVICE_URL ?? "http://127.0.0.1:8001";
const S2S_KEY = process.env.RAG_S2S_KEY ?? "";

export type ExerciceListItem = {
  id: string;
  matiere_id: string;
  filiere_id: string;
  fichier: string;
  annee: number;
  session: string;
  chapitre: string;
  notions_count: number;
  ennonce_preview: string;
  validated_by_admin: boolean;
  updated_at: string | null;
};

export type ExerciceFull = {
  id: string;
  matiere_id: string;
  filiere_id: string;
  fichier: string;
  annee: number;
  session: string;
  filiere: string;
  matiere: string;
  exercice_numero: string | number;
  chapitre: string;
  chapitres?: string[];
  notions_traitees: string[];
  ennonce_complet: string;
  donnees_fournies?: Record<string, unknown>;
  validated_by_admin?: boolean;
  updated_at?: string;
};

export type ExerciceUpdate = {
  ennonce_complet?: string;
  notions_traitees?: string[];
  chapitre?: string;
  validated_by_admin?: boolean;
};

export type AdminStats = {
  total: number;
  validated: number;
  remaining: number;
  validated_pct: number;
  by_matiere: Record<string, number>;
  by_year: Record<string, number>;
  top_chapitres: Record<string, number>;
};

export type ExerciceNeighbors = {
  prev: string | null;
  next: string | null;
  position: number | null;
  total: number;
};

class RagAdminError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  if (!S2S_KEY) {
    throw new RagAdminError(500, "RAG_S2S_KEY non configurée côté Next.js.");
  }
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      ...(init?.headers ?? {}),
      "X-Api-Key": S2S_KEY,
      "Content-Type": "application/json",
    },
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new RagAdminError(res.status, text || res.statusText);
  }
  return (await res.json()) as T;
}

export async function listExercises(params: {
  matiere?: string;
  filiere?: string;
  annee?: number;
  validated?: boolean;
  q?: string;
  sort?: "chronological" | "unvalidated_first" | "id";
  limit?: number;
  offset?: number;
}): Promise<{ total: number; items: ExerciceListItem[]; limit: number; offset: number }> {
  const qs = new URLSearchParams();
  if (params.matiere) qs.set("matiere", params.matiere);
  if (params.filiere) qs.set("filiere", params.filiere);
  if (params.annee) qs.set("annee", String(params.annee));
  if (params.validated !== undefined) qs.set("validated", String(params.validated));
  if (params.q) qs.set("q", params.q);
  if (params.sort) qs.set("sort", params.sort);
  if (params.limit) qs.set("limit", String(params.limit));
  if (params.offset) qs.set("offset", String(params.offset));
  return call(`/admin/exercises?${qs.toString()}`);
}

export async function getExercise(id: string): Promise<ExerciceFull> {
  return call(`/admin/exercises/${encodeURIComponent(id)}`);
}

export async function patchExercise(
  id: string,
  body: ExerciceUpdate,
): Promise<ExerciceFull> {
  return call(`/admin/exercises/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export async function getNeighbors(
  id: string,
  opts: { only_unvalidated?: boolean; matiere?: string; filiere?: string } = {},
): Promise<ExerciceNeighbors> {
  const qs = new URLSearchParams();
  if (opts.only_unvalidated) qs.set("only_unvalidated", "true");
  if (opts.matiere) qs.set("matiere", opts.matiere);
  if (opts.filiere) qs.set("filiere", opts.filiere);
  return call(`/admin/exercises/${encodeURIComponent(id)}/neighbors?${qs.toString()}`);
}

export async function getAdminStats(): Promise<AdminStats> {
  return call(`/admin/stats`);
}

export { RagAdminError };
