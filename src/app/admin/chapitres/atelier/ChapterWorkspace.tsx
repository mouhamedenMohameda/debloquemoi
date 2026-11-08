"use client";

/**
 * Atelier d'un chapitre (ex. Série D · Mathématiques · Nombres complexes).
 *
 *   1. Notions du chapitre : la liste courte que verront les élèves.
 *   2. Cours : un cours par notion, écrit / corrigé par l'admin, puis validé.
 *   3. Exercices : énoncé, correction, notions, validation.
 *   4. Publication : brouillon ↔ publié (aperçu élève avant).
 */

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";

import { MathText } from "@/components/MathText";
import type { ChapterDetail, ChapterNotionRow } from "@/lib/rag-admin";

import { chapterHref, MATIERE_LABEL, scopeQuery } from "../ui";

type Scope = { filiere_id: string; matiere_id: string; chapitre: string };
type NotionPick = { notion_id: string; label: string };

async function jsonOrThrow<T>(r: Response): Promise<T> {
  const d = await r.json().catch(() => ({}));
  if (!r.ok) {
    const msg = (d as { error?: string }).error || r.statusText;
    throw new Error(msg);
  }
  return d as T;
}

// ─── Checklist ───────────────────────────────────────────────────────────────

function Check({ ok, children }: { ok: boolean; children: ReactNode }) {
  return (
    <li className={`flex items-start gap-2 text-sm ${ok ? "text-emerald-700" : "text-slate-700"}`}>
      <span className="mt-0.5">{ok ? "✅" : "⬜"}</span>
      <span>{children}</span>
    </li>
  );
}

// ─── Workspace ───────────────────────────────────────────────────────────────

export function ChapterWorkspace({ scope }: { scope: Scope }) {
  const [detail, setDetail] = useState<ChapterDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Liste de notions en cours d'édition (non enregistrée tant que dirty)
  const [picks, setPicks] = useState<NotionPick[]>([]);
  const [dirty, setDirty] = useState(false);
  const [lessonFor, setLessonFor] = useState<string | null>(null);
  const [openExercise, setOpenExercise] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setError(null);
    try {
      const d = await jsonOrThrow<ChapterDetail>(
        await fetch(`/api/admin/chapters/detail?${scopeQuery(scope)}`, { cache: "no-store" }),
      );
      setDetail(d);
      setPicks(d.notions.map((n) => ({ notion_id: n.notion_id, label: n.label })));
      setDirty(!d.notions_curated && d.notions.length > 0);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [scope]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const notionRows = useMemo(() => {
    const byId = new Map<string, ChapterNotionRow>();
    for (const n of [...(detail?.notions ?? []), ...(detail?.other_notions_in_exercises ?? [])]) {
      byId.set(n.notion_id, n);
    }
    return byId;
  }, [detail]);

  const pickIds = useMemo(() => new Set(picks.map((p) => p.notion_id)), [picks]);

  function addPick(p: NotionPick) {
    if (pickIds.has(p.notion_id)) return;
    setPicks((cur) => [...cur, p]);
    setDirty(true);
  }
  function removePick(id: string) {
    setPicks((cur) => cur.filter((p) => p.notion_id !== id));
    setDirty(true);
  }

  async function saveNotions() {
    setBusy(true);
    setError(null);
    try {
      await jsonOrThrow(
        await fetch(`/api/admin/chapters/notions`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...scope, notion_ids: picks.map((p) => p.notion_id) }),
        }),
      );
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function setPublished(published: boolean) {
    if (!detail) return;
    if (published && !detail.checks.ready) {
      const gaps: string[] = [];
      const c = detail.checks;
      if (c.exercises_validated < c.exercises) gaps.push(`${c.exercises - c.exercises_validated} exercice(s) non validé(s) (cachés aux élèves)`);
      if (c.corrections_ready < c.exercises) gaps.push(`${c.exercises - c.corrections_ready} exercice(s) sans correction validée`);
      if (c.lessons_validated < c.notions) gaps.push(`${c.notions - c.lessons_validated} notion(s) sans cours validé`);
      if (c.exercises_without_chapter_notion.length) gaps.push(`${c.exercises_without_chapter_notion.length} exercice(s) sans notion du chapitre`);
      if (!window.confirm(`Le chapitre n'est pas complet :\n\n• ${gaps.join("\n• ")}\n\nPublier quand même ?`)) return;
    }
    if (!published && !window.confirm("Dépublier ? Les élèves verront « Pas encore disponible ».")) return;
    setBusy(true);
    setError(null);
    try {
      await jsonOrThrow(
        await fetch(`/api/admin/chapters/publish`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...scope, published }),
        }),
      );
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  if (!detail) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-8">
        {error ? (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
        ) : (
          <p className="text-sm text-slate-500">Chargement…</p>
        )}
      </main>
    );
  }

  const c = detail.checks;
  const isPublished = detail.status === "published";

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <Link href="/admin/chapitres" className="text-xs font-semibold text-indigo-600 hover:underline">
        ← Tous les chapitres
      </Link>

      {/* ── En-tête + publication ─────────────────────────────────────── */}
      <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Série {detail.filiere_id} · {MATIERE_LABEL[detail.matiere_id] ?? detail.matiere_id}
          </p>
          <h1 className="text-2xl font-extrabold text-slate-900">{detail.chapitre}</h1>
          <p className="mt-1 text-sm">
            {isPublished ? (
              <span className="rounded-full bg-emerald-600 px-2.5 py-0.5 text-xs font-bold text-white">Publié</span>
            ) : (
              <span className="rounded-full bg-slate-200 px-2.5 py-0.5 text-xs font-bold text-slate-700">
                Brouillon — invisible pour les élèves
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={chapterHref("/admin/chapitres/apercu", detail)}
            className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-indigo-700 ring-1 ring-indigo-200 hover:bg-indigo-50"
          >
            👁️ Aperçu élève
          </Link>
          {isPublished ? (
            <button
              disabled={busy}
              onClick={() => setPublished(false)}
              className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-red-700 ring-1 ring-red-200 hover:bg-red-50 disabled:opacity-50"
            >
              Dépublier
            </button>
          ) : (
            <button
              disabled={busy || !detail.notions_curated || dirty || picks.length === 0}
              title={!detail.notions_curated || dirty ? "Enregistre d'abord la liste des notions" : ""}
              onClick={() => setPublished(true)}
              className="rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-emerald-700 disabled:opacity-40"
            >
              Publier
            </button>
          )}
        </div>
      </div>

      {error && <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      {/* ── Checklist ─────────────────────────────────────────────────── */}
      <ul className="mt-5 grid gap-1.5 rounded-2xl bg-white p-4 ring-1 ring-slate-200 sm:grid-cols-2">
        <Check ok={c.notions_curated && !dirty}>Liste des notions enregistrée ({picks.length})</Check>
        <Check ok={c.notions > 0 && c.lessons_validated === c.notions}>
          Cours validés : {c.lessons_validated}/{c.notions}
        </Check>
        <Check ok={c.exercises > 0 && c.exercises_validated === c.exercises}>
          Exercices validés : {c.exercises_validated}/{c.exercises}
        </Check>
        <Check ok={c.exercises > 0 && c.corrections_ready === c.exercises}>
          Corrections validées : {c.corrections_ready}/{c.exercises}
        </Check>
        <Check ok={c.notions_curated && c.exercises_without_chapter_notion.length === 0}>
          Chaque exercice a au moins une notion du chapitre
          {c.notions_curated && c.exercises_without_chapter_notion.length > 0 &&
            ` (${c.exercises_without_chapter_notion.length} sans)`}
        </Check>
      </ul>

      {/* ── 1. Notions ────────────────────────────────────────────────── */}
      <NotionsSection
        matiere={detail.matiere_id}
        picks={picks}
        rows={notionRows}
        dirty={dirty}
        curated={detail.notions_curated}
        busy={busy}
        suggestions={detail.other_notions_in_exercises}
        onAdd={addPick}
        onRemove={removePick}
        onSave={saveNotions}
        onOpenLesson={(id) => setLessonFor(lessonFor === id ? null : id)}
        lessonFor={lessonFor}
        onLessonChanged={reload}
      />

      {/* ── 2. Exercices ──────────────────────────────────────────────── */}
      <section className="mt-8">
        <h2 className="text-lg font-bold text-slate-900">Exercices du chapitre ({detail.exercises.length})</h2>
        <p className="text-sm text-slate-600">
          Seuls les exercices <b>validés</b> sont montrés aux élèves, et la correction seulement si elle
          est remplie.
        </p>
        <div className="mt-3 space-y-2">
          {detail.exercises.map((e) => {
            const open = openExercise === e.id;
            const missing = c.notions_curated && c.exercises_without_chapter_notion.includes(e.id);
            return (
              <div key={e.id} className="rounded-2xl bg-white ring-1 ring-slate-200">
                <button
                  onClick={() => setOpenExercise(open ? null : e.id)}
                  className="flex w-full flex-wrap items-center gap-2 px-4 py-3 text-left"
                >
                  <span className="font-semibold text-slate-900">
                    {e.annee} · {/compl/i.test(e.session) ? "Complémentaire" : "Normale"} · Ex {e.exercice_numero}
                  </span>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${e.validated_by_admin ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                    {e.validated_by_admin ? "Validé" : "Non validé"}
                  </span>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${e.has_correction ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
                    {e.has_correction ? "Correction ✓" : "Sans correction"}
                  </span>
                  {missing && (
                    <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-700">
                      Aucune notion du chapitre
                    </span>
                  )}
                  <span className="ml-auto text-xs text-slate-500">{open ? "Fermer" : "Modifier"}</span>
                </button>
                {open && (
                  <ExerciseEditor
                    id={e.id}
                    chapterNotions={picks}
                    labelOf={(id) => notionRows.get(id)?.label ?? id}
                    onSaved={reload}
                  />
                )}
              </div>
            );
          })}
        </div>
      </section>
    </main>
  );
}

// ─── Notions ─────────────────────────────────────────────────────────────────

function NotionsSection(props: {
  matiere: string;
  picks: NotionPick[];
  rows: Map<string, ChapterNotionRow>;
  dirty: boolean;
  curated: boolean;
  busy: boolean;
  suggestions: ChapterNotionRow[];
  onAdd: (p: NotionPick) => void;
  onRemove: (id: string) => void;
  onSave: () => void;
  onOpenLesson: (id: string) => void;
  lessonFor: string | null;
  onLessonChanged: () => Promise<void>;
}) {
  const { picks, rows, dirty, curated, busy, suggestions, onAdd, onRemove, onSave, onOpenLesson, lessonFor } = props;
  const [q, setQ] = useState("");
  const [results, setResults] = useState<NotionPick[]>([]);
  const [newLabel, setNewLabel] = useState("");
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) {
      setResults([]);
      return;
    }
    const t = setTimeout(async () => {
      try {
        const qs = new URLSearchParams({ matiere: props.matiere, q: term, min_exos: "0", limit: "15" });
        const d = await jsonOrThrow<{ items: { notion_id: string; label: string }[] }>(
          await fetch(`/api/admin/courses/notions?${qs.toString()}`, { cache: "no-store" }),
        );
        setResults(d.items.map((i) => ({ notion_id: i.notion_id, label: i.label })));
      } catch {
        setResults([]);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [q, props.matiere]);

  async function createNotion() {
    const label = newLabel.trim();
    if (label.length < 3) return;
    setErr(null);
    try {
      const d = await jsonOrThrow<{ notion_id: string; label: string }>(
        await fetch(`/api/admin/chapters/registry-notion`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ matiere_id: props.matiere, label }),
        }),
      );
      onAdd({ notion_id: d.notion_id, label: d.label });
      setNewLabel("");
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <section className="mt-8">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-bold text-slate-900">Notions du chapitre ({picks.length})</h2>
        <button
          disabled={busy || !dirty}
          onClick={onSave}
          className="rounded-full bg-indigo-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-40"
        >
          {dirty ? "Enregistrer la liste" : "Liste enregistrée"}
        </button>
      </div>
      <p className="text-sm text-slate-600">
        C&apos;est la liste courte que verront les élèves. Chaque notion a un seul cours, écrit une fois
        et corrigé ici.
        {!curated && " Proposition de départ : les notions déjà taguées sur les exercices du chapitre."}
      </p>

      <div className="mt-3 space-y-2">
        {picks.map((p) => {
          const r = rows.get(p.notion_id);
          const open = lessonFor === p.notion_id;
          return (
            <div key={p.notion_id} className="rounded-2xl bg-white ring-1 ring-slate-200">
              <div className="flex flex-wrap items-center gap-2 px-4 py-2.5">
                <span className="font-semibold text-slate-900">{p.label}</span>
                <span className="text-xs text-slate-400">{p.notion_id}</span>
                {r && (
                  <span className="text-xs text-slate-500">
                    {r.exercises_in_chapter} exo{r.exercises_in_chapter > 1 ? "s" : ""}
                  </span>
                )}
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                    r?.course_validated
                      ? "bg-emerald-50 text-emerald-700"
                      : r?.has_course
                        ? "bg-amber-50 text-amber-700"
                        : "bg-slate-100 text-slate-500"
                  }`}
                >
                  {r?.course_validated ? "Cours validé" : r?.has_course ? "Cours à valider" : "Pas de cours"}
                </span>
                <div className="ml-auto flex items-center gap-2">
                  <button
                    onClick={() => onOpenLesson(p.notion_id)}
                    className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700 hover:bg-indigo-100"
                  >
                    {open ? "Fermer le cours" : "Cours"}
                  </button>
                  <button
                    onClick={() => onRemove(p.notion_id)}
                    className="rounded-full px-2 py-1 text-xs font-semibold text-slate-500 hover:bg-red-50 hover:text-red-700"
                    title="Retirer du chapitre"
                  >
                    ✕
                  </button>
                </div>
              </div>
              {open && (
                <LessonEditor notionId={p.notion_id} onChanged={props.onLessonChanged} />
              )}
            </div>
          );
        })}
        {picks.length === 0 && (
          <p className="rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-500">Aucune notion retenue.</p>
        )}
      </div>

      {suggestions.filter((s) => !picks.some((p) => p.notion_id === s.notion_id)).length > 0 && (
        <div className="mt-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Autres notions taguées sur ces exercices
          </p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {suggestions
              .filter((s) => !picks.some((p) => p.notion_id === s.notion_id))
              .map((s) => (
                <button
                  key={s.notion_id}
                  onClick={() => onAdd({ notion_id: s.notion_id, label: s.label })}
                  className="rounded-full bg-white px-2.5 py-1 text-xs text-slate-700 ring-1 ring-slate-200 hover:ring-indigo-300"
                  title={s.notion_id}
                >
                  + {s.label} <span className="text-slate-400">({s.exercises_in_chapter})</span>
                </button>
              ))}
          </div>
        </div>
      )}

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div>
          <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Chercher une notion existante
          </label>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="ex. argument, module, racines n-ièmes…"
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
          />
          {results.length > 0 && (
            <div className="mt-1 max-h-56 overflow-auto rounded-lg bg-white ring-1 ring-slate-200">
              {results.map((r) => (
                <button
                  key={r.notion_id}
                  disabled={picks.some((p) => p.notion_id === r.notion_id)}
                  onClick={() => onAdd(r)}
                  className="block w-full px-3 py-1.5 text-left text-sm hover:bg-indigo-50 disabled:opacity-40"
                >
                  {r.label} <span className="text-xs text-slate-400">{r.notion_id}</span>
                </button>
              ))}
            </div>
          )}
        </div>
        <div>
          <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Créer une nouvelle notion
          </label>
          <div className="mt-1 flex gap-2">
            <input
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              placeholder="ex. Forme exponentielle d'un nombre complexe"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
            <button
              onClick={createNotion}
              disabled={newLabel.trim().length < 3}
              className="whitespace-nowrap rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white disabled:opacity-40"
            >
              Créer
            </button>
          </div>
          {err && <p className="mt-1 text-xs text-red-700">{err}</p>}
        </div>
      </div>
    </section>
  );
}

// ─── Cours d'une notion ──────────────────────────────────────────────────────

type CourseEntry = { content: string; validated_by_admin: boolean; model?: string; edited_at?: string | null };

function LessonEditor({ notionId, onChanged }: { notionId: string; onChanged: () => Promise<void> }) {
  const [course, setCourse] = useState<CourseEntry | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [draft, setDraft] = useState("");
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const d = await jsonOrThrow<{ course: CourseEntry | null }>(
        await fetch(`/api/admin/courses/${encodeURIComponent(notionId)}`, { cache: "no-store" }),
      );
      setCourse(d.course);
      setDraft(d.course?.content ?? "");
      setEditing(!d.course);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setLoaded(true);
    }
  }, [notionId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function patch(body: { content?: string; validated_by_admin?: boolean }) {
    setBusy(true);
    setErr(null);
    try {
      await jsonOrThrow(
        await fetch(`/api/admin/courses/${encodeURIComponent(notionId)}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }),
      );
      await load();
      await onChanged();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function generateDraft() {
    setBusy(true);
    setErr(null);
    try {
      await jsonOrThrow(
        await fetch(`/api/admin/courses/${encodeURIComponent(notionId)}/generate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ force: false }),
        }),
      );
      await load();
      await onChanged();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  if (!loaded) return <p className="border-t border-slate-100 px-4 py-3 text-sm text-slate-500">Chargement…</p>;

  return (
    <div className="border-t border-slate-100 px-4 py-3">
      {err && <p className="mb-2 rounded bg-red-50 px-2 py-1 text-xs text-red-700">{err}</p>}
      {editing ? (
        <div className="grid gap-3 lg:grid-cols-2">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={18}
            placeholder="Écris le cours en Markdown + LaTeX ($...$ et $$...$$)."
            className="w-full rounded-lg border border-slate-200 p-3 font-mono text-xs"
          />
          <div className="max-h-[28rem] overflow-auto rounded-lg bg-slate-50 p-3">
            {draft.trim() ? <MathText text={draft} /> : <p className="text-sm text-slate-400">Aperçu…</p>}
          </div>
        </div>
      ) : (
        <div className="max-h-[28rem] overflow-auto rounded-lg bg-slate-50 p-3">
          <MathText text={course?.content || "_Cours vide._"} />
        </div>
      )}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {editing ? (
          <>
            <button
              disabled={busy || !draft.trim()}
              onClick={() => patch({ content: draft }).then(() => setEditing(false))}
              className="rounded-full bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-40"
            >
              Enregistrer le cours
            </button>
            {course && (
              <button
                onClick={() => {
                  setDraft(course.content);
                  setEditing(false);
                }}
                className="rounded-full px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100"
              >
                Annuler
              </button>
            )}
            {!course && (
              <button
                disabled={busy}
                onClick={generateDraft}
                className="rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50 disabled:opacity-40"
                title="Une seule fois : l'IA propose un brouillon que tu corriges. Il reste caché tant que tu ne le valides pas."
              >
                {busy ? "Génération…" : "Proposer un brouillon (IA)"}
              </button>
            )}
          </>
        ) : (
          <button
            onClick={() => setEditing(true)}
            className="rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-indigo-700 ring-1 ring-indigo-200 hover:bg-indigo-50"
          >
            Corriger le cours
          </button>
        )}
        {course && (
          <label className="ml-auto flex items-center gap-2 text-xs font-semibold text-slate-700">
            <input
              type="checkbox"
              checked={course.validated_by_admin}
              disabled={busy || editing}
              onChange={(e) => patch({ validated_by_admin: e.target.checked })}
            />
            Cours validé (visible élèves)
          </label>
        )}
      </div>
    </div>
  );
}

// ─── Exercice ────────────────────────────────────────────────────────────────

type FullExercise = {
  id: string;
  annee: number;
  session: string;
  exercice_numero: string | number;
  ennonce_complet: string;
  correction?: string;
  notion_ids?: string[];
  validated_by_admin?: boolean;
  fichier?: string;
};

function ExerciseEditor({
  id,
  chapterNotions,
  labelOf,
  onSaved,
}: {
  id: string;
  chapterNotions: NotionPick[];
  labelOf: (id: string) => string;
  onSaved: () => Promise<void>;
}) {
  const [ex, setEx] = useState<FullExercise | null>(null);
  const [enonce, setEnonce] = useState("");
  const [correction, setCorrection] = useState("");
  const [notionIds, setNotionIds] = useState<string[]>([]);
  const [validated, setValidated] = useState(false);
  const [tab, setTab] = useState<"enonce" | "correction">("enonce");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const d = await jsonOrThrow<FullExercise>(
          await fetch(`/api/admin/exercices/${encodeURIComponent(id)}`, { cache: "no-store" }),
        );
        if (cancelled) return;
        setEx(d);
        setEnonce(d.ennonce_complet ?? "");
        setCorrection(d.correction ?? "");
        setNotionIds(d.notion_ids ?? []);
        setValidated(!!d.validated_by_admin);
      } catch (e) {
        if (!cancelled) setErr(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const options = useMemo(() => {
    const ids = new Set<string>(chapterNotions.map((n) => n.notion_id));
    const out = [...chapterNotions];
    for (const nid of notionIds) {
      if (!ids.has(nid)) out.push({ notion_id: nid, label: labelOf(nid) });
    }
    return out;
  }, [chapterNotions, notionIds, labelOf]);

  function toggle(nid: string) {
    setNotionIds((cur) => (cur.includes(nid) ? cur.filter((x) => x !== nid) : [...cur, nid]));
  }

  async function save() {
    setBusy(true);
    setErr(null);
    try {
      await jsonOrThrow(
        await fetch(`/api/admin/exercices/${encodeURIComponent(id)}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ennonce_complet: enonce,
            correction,
            notion_ids: notionIds,
            validated_by_admin: validated,
          }),
        }),
      );
      setSavedAt(Date.now());
      await onSaved();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  if (!ex) {
    return (
      <div className="border-t border-slate-100 px-4 py-3 text-sm text-slate-500">
        {err ? <span className="text-red-700">{err}</span> : "Chargement…"}
      </div>
    );
  }

  const text = tab === "enonce" ? enonce : correction;
  const setText = tab === "enonce" ? setEnonce : setCorrection;

  return (
    <div className="border-t border-slate-100 px-4 py-3">
      {ex.fichier && <p className="mb-2 text-xs text-slate-500">Source : {ex.fichier}</p>}
      <div className="mb-2 flex gap-1">
        {(["enonce", "correction"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-full px-3 py-1 text-xs font-semibold ${tab === t ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-700"}`}
          >
            {t === "enonce" ? "Énoncé" : "Correction"}
          </button>
        ))}
      </div>
      <div className="grid gap-3 lg:grid-cols-2">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={16}
          placeholder={tab === "correction" ? "Correction en Markdown + LaTeX." : ""}
          className="w-full rounded-lg border border-slate-200 p-3 font-mono text-xs"
        />
        <div className="max-h-[26rem] overflow-auto rounded-lg bg-slate-50 p-3">
          {text.trim() ? <MathText text={text} /> : <p className="text-sm text-slate-400">Aperçu…</p>}
        </div>
      </div>

      <div className="mt-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Notions de cet exercice</p>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {options.map((n) => {
            const on = notionIds.includes(n.notion_id);
            const inChapter = chapterNotions.some((c) => c.notion_id === n.notion_id);
            return (
              <button
                key={n.notion_id}
                onClick={() => toggle(n.notion_id)}
                className={`rounded-full px-2.5 py-1 text-xs ring-1 ${
                  on ? "bg-indigo-600 text-white ring-indigo-600" : "bg-white text-slate-700 ring-slate-200"
                } ${inChapter ? "" : "italic"}`}
                title={inChapter ? n.notion_id : `${n.notion_id} — hors liste du chapitre`}
              >
                {on ? "✓ " : ""}
                {n.label}
              </button>
            );
          })}
        </div>
        <p className="mt-1 text-xs text-slate-400">En italique : notion taguée mais hors de la liste du chapitre.</p>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
          <input type="checkbox" checked={validated} onChange={(e) => setValidated(e.target.checked)} />
          Exercice validé (visible élèves)
        </label>
        <button
          disabled={busy}
          onClick={save}
          className="ml-auto rounded-full bg-indigo-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-40"
        >
          {busy ? "Enregistrement…" : "Enregistrer"}
        </button>
        {savedAt && !busy && <span className="text-xs text-emerald-700">Enregistré ✓</span>}
        {err && <span className="text-xs text-red-700">{err}</span>}
      </div>
    </div>
  );
}
