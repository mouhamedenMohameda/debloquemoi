"use client";

/**
 * Atelier d'un chapitre (ex. Série D · Mathématiques · Nombres complexes).
 *
 * La page suit l'ordre du travail de l'admin :
 *   Étape 1 — Notions du chapitre : la liste que verront les élèves, avec pour
 *             chacune son cours (rédiger / corriger / valider) et le nombre
 *             d'exercices du bac qui l'utilisent.
 *   Étape 2 — Exercices : énoncé, correction, notions (uniquement celles du
 *             chapitre), validation.
 *   Étape 3 — Publier (bouton en haut), après l'aperçu élève.
 */

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";

import { MathText } from "@/components/MathText";
import type { ChapterDetail, ChapterExerciseRow, ChapterNotionRow } from "@/lib/rag-admin";

import { chapterHref, MATIERE_LABEL, scopeQuery } from "../ui";

type Scope = { filiere_id: string; matiere_id: string; chapitre: string };
type NotionPick = { notion_id: string; label: string };
type ExerciseFilter = "all" | "todo" | "no_correction" | "no_notion";

async function jsonOrThrow<T>(r: Response): Promise<T> {
  const d = await r.json().catch(() => ({}));
  if (!r.ok) {
    const msg = (d as { error?: string }).error || r.statusText;
    throw new Error(msg);
  }
  return d as T;
}

function short(label: string, max = 34): string {
  return label.length > max ? `${label.slice(0, max - 1)}…` : label;
}

function sessionLabel(s: string): string {
  return /compl/i.test(s) ? "Complémentaire" : "Normale";
}

// ─── Petits composants ───────────────────────────────────────────────────────

function Check({ ok, children }: { ok: boolean; children: ReactNode }) {
  return (
    <li className={`flex items-start gap-2 text-sm ${ok ? "text-emerald-700" : "text-slate-700"}`}>
      <span className="mt-0.5">{ok ? "✅" : "⬜"}</span>
      <span>{children}</span>
    </li>
  );
}

function StepTitle({ n, title, children }: { n: number; title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-2">
      <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900">
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-indigo-600 text-xs font-bold text-white">
          {n}
        </span>
        {title}
      </h2>
      {children}
    </div>
  );
}

function Pill({ tone, children }: { tone: "ok" | "warn" | "muted"; children: ReactNode }) {
  const cls =
    tone === "ok"
      ? "bg-emerald-50 text-emerald-700"
      : tone === "warn"
        ? "bg-amber-50 text-amber-700"
        : "bg-slate-100 text-slate-500";
  return <span className={`whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-semibold ${cls}`}>{children}</span>;
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
  const [filter, setFilter] = useState<ExerciseFilter>("all");

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
    for (const n of detail?.notions ?? []) byId.set(n.notion_id, n);
    return byId;
  }, [detail]);

  const pickIds = useMemo(() => new Set(picks.map((p) => p.notion_id)), [picks]);
  const labelOf = useCallback(
    (id: string) => picks.find((p) => p.notion_id === id)?.label ?? notionRows.get(id)?.label ?? id,
    [picks, notionRows],
  );

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
  const withoutNotion = new Set(c.notions_curated ? c.exercises_without_chapter_notion : []);
  const filtered = detail.exercises.filter((e) => {
    if (filter === "todo") return !e.validated_by_admin;
    if (filter === "no_correction") return !e.has_correction;
    if (filter === "no_notion") return withoutNotion.has(e.id);
    return true;
  });
  const counts = {
    all: detail.exercises.length,
    todo: detail.exercises.filter((e) => !e.validated_by_admin).length,
    no_correction: detail.exercises.filter((e) => !e.has_correction).length,
    no_notion: withoutNotion.size,
  };

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <Link href="/admin/chapitres" className="text-xs font-semibold text-indigo-600 hover:underline">
        ← Tous les chapitres
      </Link>

      {/* ── En-tête + publication (étape 3) ───────────────────────────── */}
      <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Série {detail.filiere_id} · {MATIERE_LABEL[detail.matiere_id] ?? detail.matiere_id}
          </p>
          <h1 className="text-2xl font-extrabold text-slate-900">{detail.chapitre}</h1>
          <p className="mt-1 text-sm">
            {isPublished ? (
              <span className="rounded-full bg-emerald-600 px-2.5 py-0.5 text-xs font-bold text-white">
                Publié — visible par les élèves
              </span>
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
              title={!detail.notions_curated || dirty ? "Enregistre d'abord la liste des notions (étape 1)" : ""}
              onClick={() => setPublished(true)}
              className="rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-emerald-700 disabled:opacity-40"
            >
              Publier
            </button>
          )}
        </div>
      </div>

      {error && <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      {/* ── Où en est le chapitre ─────────────────────────────────────── */}
      <ul className="mt-5 grid gap-1.5 rounded-2xl bg-white p-4 ring-1 ring-slate-200 sm:grid-cols-2">
        <Check ok={c.notions_curated && !dirty}>Étape 1 — liste des notions enregistrée ({picks.length})</Check>
        <Check ok={c.notions > 0 && c.lessons_validated === c.notions}>
          Étape 1 — cours validés : {c.lessons_validated}/{c.notions}
        </Check>
        <Check ok={c.exercises > 0 && c.exercises_validated === c.exercises}>
          Étape 2 — exercices validés : {c.exercises_validated}/{c.exercises}
        </Check>
        <Check ok={c.exercises > 0 && c.corrections_ready === c.exercises}>
          Étape 2 — corrections validées : {c.corrections_ready}/{c.exercises}
        </Check>
        <Check ok={c.notions_curated && c.exercises_without_chapter_notion.length === 0}>
          Étape 2 — chaque exercice a au moins une notion
          {c.notions_curated && c.exercises_without_chapter_notion.length > 0 &&
            ` (${c.exercises_without_chapter_notion.length} sans)`}
        </Check>
      </ul>

      {/* ── Étape 1 : notions + cours ─────────────────────────────────── */}
      <NotionsSection
        matiere={detail.matiere_id}
        picks={picks}
        rows={notionRows}
        dirty={dirty}
        curated={detail.notions_curated}
        busy={busy}
        onAdd={addPick}
        onRemove={removePick}
        onSave={saveNotions}
        onOpenLesson={(id) => setLessonFor(lessonFor === id ? null : id)}
        lessonFor={lessonFor}
        onLessonChanged={reload}
      />

      {/* ── Étape 2 : exercices ───────────────────────────────────────── */}
      <section className="mt-10">
        <StepTitle n={2} title={`Exercices du bac (${detail.exercises.length})`} />
        <p className="mt-1 text-sm text-slate-600">
          Pour chaque exercice : vérifie l&apos;énoncé, écris la correction, coche les notions utilisées, puis
          valide. Seuls les exercices <b>validés</b> sont montrés aux élèves, sous chacune de leurs notions.
        </p>

        <div className="mt-3 flex flex-wrap gap-1.5">
          {(
            [
              ["all", "Tous"],
              ["todo", "À valider"],
              ["no_correction", "Sans correction"],
              ["no_notion", "Sans notion"],
            ] as const
          ).map(([k, label]) => (
            <button
              key={k}
              onClick={() => setFilter(k)}
              className={`rounded-full px-3 py-1 text-xs font-semibold ${
                filter === k ? "bg-slate-900 text-white" : "bg-white text-slate-700 ring-1 ring-slate-200"
              }`}
            >
              {label} ({counts[k]})
            </button>
          ))}
        </div>

        <div className="mt-3 space-y-2">
          {filtered.map((e) => (
            <ExerciseRow
              key={e.id}
              e={e}
              open={openExercise === e.id}
              onToggle={() => setOpenExercise(openExercise === e.id ? null : e.id)}
              chapterNotions={picks}
              chapterIds={pickIds}
              labelOf={labelOf}
              onSaved={reload}
            />
          ))}
          {filtered.length === 0 && (
            <p className="rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-500">Aucun exercice dans ce filtre.</p>
          )}
        </div>
      </section>
    </main>
  );
}

// ─── Étape 1 : notions ───────────────────────────────────────────────────────

function NotionsSection(props: {
  matiere: string;
  picks: NotionPick[];
  rows: Map<string, ChapterNotionRow>;
  dirty: boolean;
  curated: boolean;
  busy: boolean;
  onAdd: (p: NotionPick) => void;
  onRemove: (id: string) => void;
  onSave: () => void;
  onOpenLesson: (id: string) => void;
  lessonFor: string | null;
  onLessonChanged: () => Promise<void>;
}) {
  const { picks, rows, dirty, curated, busy, onAdd, onRemove, onSave, onOpenLesson, lessonFor } = props;
  const [adding, setAdding] = useState(false);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<NotionPick[]>([]);
  const [newLabel, setNewLabel] = useState("");
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    const term = q.trim();
    if (!adding || term.length < 2) {
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
  }, [q, props.matiere, adding]);

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

  // Notions de la liste qu'aucun exercice du chapitre n'utilise (après enregistrement)
  const unused = picks.filter((p) => rows.has(p.notion_id) && (rows.get(p.notion_id)?.exercises_in_chapter ?? 0) === 0);

  return (
    <section className="mt-8">
      <StepTitle n={1} title={`Notions du chapitre (${picks.length})`}>
        <button
          disabled={busy || !dirty}
          onClick={onSave}
          className="rounded-full bg-indigo-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-40"
        >
          {dirty ? "Enregistrer la liste" : "Liste enregistrée ✓"}
        </button>
      </StepTitle>
      <p className="mt-1 text-sm text-slate-600">
        Les notions que verront les élèves pour ce chapitre. Chaque notion a <b>un seul cours</b> : ouvre-le, corrige-le
        si besoin, puis coche « Cours validé ».
        {!curated && " Proposition de départ : à vérifier puis enregistrer."}
      </p>

      <div className="mt-3 overflow-hidden rounded-2xl bg-white ring-1 ring-slate-200">
        {picks.map((p, i) => {
          const r = rows.get(p.notion_id);
          const open = lessonFor === p.notion_id;
          const nEx = r?.exercises_in_chapter ?? 0;
          return (
            <div key={p.notion_id} className={i > 0 ? "border-t border-slate-100" : ""}>
              <div className="flex items-center gap-3 px-4 py-2.5">
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-slate-900" title={p.notion_id}>
                    {p.label}
                  </div>
                  <div className="mt-0.5 flex flex-wrap gap-1.5">
                    {r ? (
                      <Pill tone={nEx > 0 ? "muted" : "warn"}>
                        {nEx > 0 ? `${nEx} exercice${nEx > 1 ? "s" : ""} du bac` : "Aucun exercice du bac"}
                      </Pill>
                    ) : (
                      <Pill tone="muted">Nouvelle — enregistre la liste</Pill>
                    )}
                    <Pill tone={r?.course_validated ? "ok" : r?.has_course ? "warn" : "muted"}>
                      {r?.course_validated ? "Cours validé" : r?.has_course ? "Cours à valider" : "Pas de cours"}
                    </Pill>
                  </div>
                </div>
                <button
                  onClick={() => onOpenLesson(p.notion_id)}
                  className="shrink-0 rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700 hover:bg-indigo-100"
                >
                  {open ? "Fermer" : "Cours"}
                </button>
                <button
                  onClick={() => onRemove(p.notion_id)}
                  className="shrink-0 rounded-full px-2 py-1 text-xs font-semibold text-slate-400 hover:bg-red-50 hover:text-red-700"
                  title="Retirer cette notion du chapitre"
                >
                  ✕
                </button>
              </div>
              {open && <LessonEditor notionId={p.notion_id} onChanged={props.onLessonChanged} />}
            </div>
          );
        })}
        {picks.length === 0 && <p className="px-4 py-3 text-sm text-slate-500">Aucune notion retenue.</p>}
      </div>

      {unused.length > 0 && !dirty && (
        <p className="mt-2 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-800">
          {unused.length} notion{unused.length > 1 ? "s" : ""} sans exercice du bac :{" "}
          {unused.map((u) => short(u.label, 40)).join(" · ")}. Les élèves verront le cours, sans année. Si un
          exercice l&apos;utilise, coche-la dans l&apos;exercice (étape 2).
        </p>
      )}

      <div className="mt-3">
        <button
          onClick={() => setAdding((v) => !v)}
          className="text-sm font-semibold text-indigo-600 hover:underline"
        >
          {adding ? "− Fermer" : "+ Ajouter une notion au chapitre"}
        </button>
        {adding && (
          <div className="mt-2 grid gap-3 rounded-2xl bg-white p-4 ring-1 ring-slate-200 sm:grid-cols-2">
            <div>
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Chercher une notion existante
              </label>
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="ex. module, argument…"
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
                      {r.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div>
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Ou créer une nouvelle notion
              </label>
              <div className="mt-1 flex gap-2">
                <input
                  value={newLabel}
                  onChange={(e) => setNewLabel(e.target.value)}
                  placeholder="Nom de la notion"
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
            <p className="text-xs text-slate-500 sm:col-span-2">
              Pense à cliquer sur « Enregistrer la liste » après un ajout ou un retrait.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}

// ─── Étape 2 : ligne d'exercice ──────────────────────────────────────────────

function ExerciseRow({
  e,
  open,
  onToggle,
  chapterNotions,
  chapterIds,
  labelOf,
  onSaved,
}: {
  e: ChapterExerciseRow;
  open: boolean;
  onToggle: () => void;
  chapterNotions: NotionPick[];
  chapterIds: Set<string>;
  labelOf: (id: string) => string;
  onSaved: () => Promise<void>;
}) {
  // Dans l'ordre de la liste du chapitre (étape 1), pour comparer d'un coup d'œil.
  const tagged = chapterNotions.map((n) => n.notion_id).filter((id) => e.notion_ids.includes(id));
  return (
    <div className="rounded-2xl bg-white ring-1 ring-slate-200">
      <button onClick={onToggle} className="block w-full px-4 py-3 text-left">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-semibold text-slate-900">
            Bac {e.annee} · {sessionLabel(e.session)} · Exercice {e.exercice_numero}
          </span>
          <Pill tone={e.validated_by_admin ? "ok" : "muted"}>{e.validated_by_admin ? "Validé" : "À valider"}</Pill>
          <Pill tone={e.has_correction ? "ok" : "warn"}>{e.has_correction ? "Correction ✓" : "Sans correction"}</Pill>
          <span className="ml-auto text-xs font-semibold text-indigo-600">{open ? "Fermer" : "Ouvrir"}</span>
        </div>
        <div className="mt-1.5 flex flex-wrap gap-1">
          {tagged.length > 0 ? (
            tagged.map((id) => (
              <span key={id} className="rounded-full bg-indigo-50 px-2 py-0.5 text-[11px] text-indigo-700" title={labelOf(id)}>
                {short(labelOf(id), 30)}
              </span>
            ))
          ) : (
            <Pill tone="warn">Aucune notion du chapitre</Pill>
          )}
        </div>
      </button>
      {open && (
        <ExerciseEditor id={e.id} chapterNotions={chapterNotions} chapterIds={chapterIds} onSaved={onSaved} />
      )}
    </div>
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

// ─── Étape 2 : éditeur d'exercice ────────────────────────────────────────────

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
  note_admin?: string;
};

function ExerciseEditor({
  id,
  chapterNotions,
  chapterIds,
  onSaved,
}: {
  id: string;
  chapterNotions: NotionPick[];
  chapterIds: Set<string>;
  onSaved: () => Promise<void>;
}) {
  const [ex, setEx] = useState<FullExercise | null>(null);
  const [enonce, setEnonce] = useState("");
  const [correction, setCorrection] = useState("");
  // Notions du chapitre cochées. Les autres notion_ids de l'exercice (autres
  // chapitres, anciens tags) ne sont ni affichés ni modifiés.
  const [checked, setChecked] = useState<string[]>([]);
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
        setChecked((d.notion_ids ?? []).filter((n) => chapterIds.has(n)));
        setValidated(!!d.validated_by_admin);
      } catch (e) {
        if (!cancelled) setErr(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => {
      cancelled = true;
    };
    // chapterIds change à chaque rechargement : on ne recharge l'exercice que si l'id change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  function toggle(nid: string) {
    setChecked((cur) => (cur.includes(nid) ? cur.filter((x) => x !== nid) : [...cur, nid]));
  }

  async function save() {
    if (!ex) return;
    setBusy(true);
    setErr(null);
    try {
      const others = (ex.notion_ids ?? []).filter((n) => !chapterIds.has(n));
      const notion_ids = [...others, ...chapterNotions.map((n) => n.notion_id).filter((n) => checked.includes(n))];
      const saved = await jsonOrThrow<FullExercise>(
        await fetch(`/api/admin/exercices/${encodeURIComponent(id)}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ennonce_complet: enonce,
            correction,
            notion_ids,
            validated_by_admin: validated,
          }),
        }),
      );
      setEx(saved);
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
      {ex.note_admin && (
        <p className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900 ring-1 ring-amber-200">
          ⚠ À vérifier : {ex.note_admin}
        </p>
      )}

      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">a. Énoncé et correction</p>
      <div className="mb-2 mt-1 flex gap-1">
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
          rows={14}
          placeholder={tab === "correction" ? "Correction en Markdown + LaTeX ($...$)." : ""}
          className="w-full rounded-lg border border-slate-200 p-3 font-mono text-xs"
        />
        <div className="max-h-[24rem] overflow-auto rounded-lg bg-slate-50 p-3">
          {text.trim() ? <MathText text={text} /> : <p className="text-sm text-slate-400">Aperçu…</p>}
        </div>
      </div>

      <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-slate-500">
        b. Notions utilisées dans cet exercice
      </p>
      <p className="text-xs text-slate-500">
        L&apos;exercice apparaîtra chez l&apos;élève sous chaque notion cochée, avec son année.
      </p>
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {chapterNotions.map((n) => {
          const on = checked.includes(n.notion_id);
          return (
            <button
              key={n.notion_id}
              onClick={() => toggle(n.notion_id)}
              className={`rounded-full px-2.5 py-1 text-xs ring-1 ${
                on ? "bg-indigo-600 text-white ring-indigo-600" : "bg-white text-slate-700 ring-slate-200 hover:ring-indigo-300"
              }`}
            >
              {on ? "✓ " : ""}
              {n.label}
            </button>
          );
        })}
      </div>

      <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-slate-500">c. Validation</p>
      <div className="mt-1 flex flex-wrap items-center gap-3">
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
