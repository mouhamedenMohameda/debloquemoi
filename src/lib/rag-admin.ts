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
  titre?: string;
  matiere_id: string;
  filiere_id: string;
  fichier: string;
  annee: number;
  session: string;
  exercice_numero?: string | number;
  chapitre: string;
  notions_count: number;
  ennonce_preview: string;
  has_correction: boolean;
  is_skeleton: boolean;
  validated_by_admin: boolean;
  updated_at: string | null;
};

export type ExerciceFull = {
  id: string;
  titre?: string;
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
  correction?: string;
  donnees_fournies?: Record<string, unknown>;
  validated_by_admin?: boolean;
  is_skeleton?: boolean;
  updated_at?: string;
};

export type ExerciceUpdate = {
  ennonce_complet?: string;
  correction?: string;
  notions_traitees?: string[];
  chapitre?: string;
  fichier?: string;
  validated_by_admin?: boolean;
};

export type ExerciceCreate = {
  filiere_id: "C" | "D";
  matiere_id: "math" | "pc" | "svt";
  annee: number;
  session: "Normale" | "Complémentaire";
  exercice_numero: number;
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
  skeleton?: boolean;
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
  if (params.skeleton !== undefined) qs.set("skeleton", String(params.skeleton));
  if (params.q) qs.set("q", params.q);
  if (params.sort) qs.set("sort", params.sort);
  if (params.limit) qs.set("limit", String(params.limit));
  if (params.offset) qs.set("offset", String(params.offset));
  return call(`/admin/exercises?${qs.toString()}`);
}

export async function createExercise(body: ExerciceCreate): Promise<ExerciceFull> {
  return call(`/admin/exercises`, { method: "POST", body: JSON.stringify(body) });
}

export async function deleteExercise(id: string): Promise<{ deleted: boolean; id: string }> {
  return call(`/admin/exercises/${encodeURIComponent(id)}`, { method: "DELETE" });
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

// ─── Cours (admin_courses.py) ────────────────────────────────────────────────

export type NotionListItem = {
  notion_id: string;
  label: string;
  matiere_id: string;
  chapitre: string | null;
  nb_exos: number;
  filieres: string[];
  has_course: boolean;
  course_generated_at: string | null;
  course_edited_at: string | null;
  course_validated: boolean;
};

export type NotionListResponse = {
  items: NotionListItem[];
  total: number;
  offset: number;
  limit: number;
  stats: {
    total_notions: number;
    with_course: number;
    without_course: number;
  };
};

export type CourseEntry = {
  content: string;
  model: string;
  generated_at: string;
  edited_at: string | null;
  validated_by_admin: boolean;
  notion_label: string;
  context_exo_ids: string[];
};

export type CourseExoRef = {
  id: string;
  annee: number;
  session: string;
  filiere_id: string;
  matiere_id: string;
  exercice_numero: string | number;
  ennonce_preview: string;
};

export type CourseDetail = {
  notion_id: string;
  label: string;
  matiere_id: string;
  chapitre: string | null;
  exos: CourseExoRef[];
  course: CourseEntry | null;
};

export async function listNotions(params: {
  matiere?: string;
  filiere?: string;
  min_exos?: number;
  has_course?: boolean;
  q?: string;
  sort?: "nb_exos_desc" | "nb_exos_asc" | "label" | "notion_id";
  limit?: number;
  offset?: number;
} = {}): Promise<NotionListResponse> {
  const qs = new URLSearchParams();
  if (params.matiere) qs.set("matiere", params.matiere);
  if (params.filiere) qs.set("filiere", params.filiere);
  if (params.min_exos !== undefined) qs.set("min_exos", String(params.min_exos));
  if (params.has_course !== undefined) qs.set("has_course", String(params.has_course));
  if (params.q) qs.set("q", params.q);
  if (params.sort) qs.set("sort", params.sort);
  if (params.limit) qs.set("limit", String(params.limit));
  if (params.offset) qs.set("offset", String(params.offset));
  return call(`/admin/courses/notions?${qs.toString()}`);
}

export async function getCourseDetail(notion_id: string): Promise<CourseDetail> {
  return call(`/admin/courses/${encodeURIComponent(notion_id)}`);
}

export async function generateCourse(
  notion_id: string,
  opts: { force?: boolean; max_context_exos?: number } = {},
): Promise<{ notion_id: string; label: string; course: CourseEntry }> {
  return call(`/admin/courses/${encodeURIComponent(notion_id)}/generate`, {
    method: "POST",
    body: JSON.stringify({
      force: opts.force ?? false,
      max_context_exos: opts.max_context_exos ?? 5,
    }),
  });
}

export async function patchCourse(
  notion_id: string,
  body: { content?: string; validated_by_admin?: boolean },
): Promise<{ notion_id: string; course: CourseEntry }> {
  return call(`/admin/courses/${encodeURIComponent(notion_id)}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export async function deleteCourse(notion_id: string): Promise<{ ok: boolean }> {
  return call(`/admin/courses/${encodeURIComponent(notion_id)}`, { method: "DELETE" });
}

export { RagAdminError };
