"use client";

/**
 * Éditeur de cours par notion.
 *
 * Layout : barre de stats + filtres en haut · liste à gauche · viewer/éditeur à droite.
 * Le contenu LaTeX/Markdown est rendu via le composant MathText partagé.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";

import { MathText } from "@/components/MathText";

type NotionListItem = {
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

type NotionListResponse = {
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

type CourseEntry = {
  content: string;
  model: string;
  generated_at: string;
  edited_at: string | null;
  validated_by_admin: boolean;
  notion_label: string;
  context_exo_ids: string[];
};

type CourseExoRef = {
  id: string;
  annee: number;
  session: string;
  filiere_id: string;
  matiere_id: string;
  exercice_numero: string | number;
  ennonce_preview: string;
};

type CourseDetail = {
  notion_id: string;
  label: string;
  matiere_id: string;
  chapitre: string | null;
  exos: CourseExoRef[];
  course: CourseEntry | null;
};

const MATIERES = ["math", "pc", "svt"] as const;
const MATIERE_LABEL: Record<string, string> = {
  math: "Math",
  pc: "Sciences Physiques",
  svt: "SVT",
};
const FILIERES = ["C", "D"] as const;

export function CoursEditor() {
  // Filtres
  const [matiere, setMatiere] = useState<string>("math");
  const [filiere, setFiliere] = useState<string>("");
  const [hasCourse, setHasCourse] = useState<"all" | "yes" | "no">("all");
  const [minExos, setMinExos] = useState(3);
  const [search, setSearch] = useState("");

  // Données
  const [list, setList] = useState<NotionListItem[]>([]);
  const [listMeta, setListMeta] = useState<NotionListResponse["stats"] | null>(null);
  const [total, setTotal] = useState(0);
  const [loadingList, setLoadingList] = useState(false);

  // Sélection
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<CourseDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Génération / édition
  const [generating, setGenerating] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [draftContent, setDraftContent] = useState("");
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ─── Fetch liste notions ────────────────────────────────────────────────
  const fetchList = useCallback(async () => {
    setLoadingList(true);
    try {
      const qs = new URLSearchParams();
      if (matiere) qs.set("matiere", matiere);
      if (filiere) qs.set("filiere", filiere);
      qs.set("min_exos", String(minExos));
      if (hasCourse !== "all") qs.set("has_course", hasCourse === "yes" ? "true" : "false");
      if (search.trim()) qs.set("q", search.trim());
      qs.set("limit", "500");
      const r = await fetch(`/api/admin/courses/notions?${qs.toString()}`, {
        cache: "no-store",
      });
      if (!r.ok) {
        console.error("listNotions failed", await r.text());
        return;
      }
      const data: NotionListResponse = await r.json();
      setList(data.items);
      setTotal(data.total);
      setListMeta(data.stats);
    } finally {
      setLoadingList(false);
    }
  }, [matiere, filiere, minExos, hasCourse, search]);

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  // ─── Fetch détail notion ────────────────────────────────────────────────
  const fetchDetail = useCallback(async (nid: string) => {
    setLoadingDetail(true);
    setEditMode(false);
    setSavedAt(null);
    try {
      const r = await fetch(`/api/admin/courses/${encodeURIComponent(nid)}`, {
        cache: "no-store",
      });
      if (!r.ok) {
        console.error("getDetail failed", await r.text());
        setDetail(null);
        return;
      }
      const data: CourseDetail = await r.json();
      setDetail(data);
      setDraftContent(data.course?.content ?? "");
    } finally {
      setLoadingDetail(false);
    }
  }, []);

  useEffect(() => {
    if (selectedId) fetchDetail(selectedId);
  }, [selectedId, fetchDetail]);

  // ─── Génération ─────────────────────────────────────────────────────────
  const handleGenerate = async (force = false) => {
    if (!selectedId) return;
    setGenerating(true);
    try {
      const r = await fetch(`/api/admin/courses/${encodeURIComponent(selectedId)}/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ force, max_context_exos: 5 }),
      });
      if (!r.ok) {
        const text = await r.text();
        alert(`Erreur génération: ${r.status} ${text}`);
        return;
      }
      // Re-fetch le détail pour récupérer le cours
      await fetchDetail(selectedId);
      // Re-fetch la liste pour mettre à jour has_course
      fetchList();
    } finally {
      setGenerating(false);
    }
  };

  // ─── Sauvegarde (debounced) ─────────────────────────────────────────────
  const saveDraft = useCallback(async () => {
    if (!selectedId || !detail?.course) return;
    if (draftContent === detail.course.content) return;
    setSaving(true);
    try {
      const r = await fetch(`/api/admin/courses/${encodeURIComponent(selectedId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: draftContent }),
      });
      if (!r.ok) {
        console.error("patchCourse failed", await r.text());
        return;
      }
      const data = await r.json();
      setDetail((d) => (d ? { ...d, course: data.course } : d));
      setSavedAt(Date.now());
    } finally {
      setSaving(false);
    }
  }, [selectedId, detail?.course, draftContent]);

  useEffect(() => {
    if (!editMode) return;
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(saveDraft, 800);
    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, [draftContent, editMode, saveDraft]);

  const toggleValidated = async () => {
    if (!selectedId || !detail?.course) return;
    const r = await fetch(`/api/admin/courses/${encodeURIComponent(selectedId)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ validated_by_admin: !detail.course.validated_by_admin }),
    });
    if (r.ok) {
      const data = await r.json();
      setDetail((d) => (d ? { ...d, course: data.course } : d));
      fetchList();
    }
  };

  // ─── UI ─────────────────────────────────────────────────────────────────
  const selectedItem = useMemo(
    () => list.find((it) => it.notion_id === selectedId),
    [list, selectedId],
  );

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-6">
      <div className="mx-auto max-w-[1600px]">
        <header className="mb-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-extrabold text-slate-900">Cours par notion</h1>
            <p className="mt-1 text-sm text-slate-600">
              Génère et édite un cours Markdown + LaTeX par notion.{" "}
              {listMeta && (
                <span className="ml-2 rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-semibold text-indigo-700">
                  {listMeta.with_course}/{listMeta.total_notions} avec cours
                </span>
              )}
            </p>
          </div>
          <Link href="/admin" className="text-sm text-indigo-600 hover:underline">
            ← Admin
          </Link>
        </header>

        {/* Filtres */}
        <div className="mb-4 flex flex-wrap items-center gap-3 rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
          <label className="text-sm">
            Matière:{" "}
            <select
              value={matiere}
              onChange={(e) => setMatiere(e.target.value)}
              className="rounded border-slate-300 text-sm"
            >
              {MATIERES.map((m) => (
                <option key={m} value={m}>
                  {MATIERE_LABEL[m]}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            Filière:{" "}
            <select
              value={filiere}
              onChange={(e) => setFiliere(e.target.value)}
              className="rounded border-slate-300 text-sm"
            >
              <option value="">Toutes</option>
              {FILIERES.map((f) => (
                <option key={f} value={f}>
                  Série {f}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            Min exos:{" "}
            <input
              type="number"
              value={minExos}
              min={1}
              max={100}
              onChange={(e) => setMinExos(Math.max(1, Number(e.target.value)))}
              className="w-16 rounded border-slate-300 text-sm"
            />
          </label>
          <label className="text-sm">
            Cours:{" "}
            <select
              value={hasCourse}
              onChange={(e) => setHasCourse(e.target.value as typeof hasCourse)}
              className="rounded border-slate-300 text-sm"
            >
              <option value="all">Tous</option>
              <option value="yes">Avec cours</option>
              <option value="no">Sans cours</option>
            </select>
          </label>
          <input
            type="search"
            placeholder="Rechercher…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="ml-auto w-72 rounded border-slate-300 px-3 py-1 text-sm"
          />
          <span className="text-xs text-slate-500">{total} notions affichées</span>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[400px_1fr]">
          {/* Liste */}
          <aside className="max-h-[80vh] overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-sm">
            {loadingList ? (
              <div className="p-4 text-sm text-slate-500">Chargement…</div>
            ) : list.length === 0 ? (
              <div className="p-4 text-sm text-slate-500">Aucune notion ne correspond aux filtres.</div>
            ) : (
              <ul className="divide-y divide-slate-100">
                {list.map((it) => {
                  const isSelected = it.notion_id === selectedId;
                  return (
                    <li
                      key={it.notion_id}
                      className={`cursor-pointer px-3 py-2 hover:bg-slate-50 ${
                        isSelected ? "bg-indigo-50" : ""
                      }`}
                      onClick={() => setSelectedId(it.notion_id)}
                    >
                      <div className="flex items-start gap-2">
                        <span className="mt-0.5 inline-flex w-9 shrink-0 items-center justify-center rounded bg-slate-100 px-1 py-0.5 text-xs font-bold text-slate-700">
                          {it.nb_exos}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-medium text-slate-900">
                            {it.label}
                          </div>
                          <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-slate-500">
                            <span>{it.notion_id}</span>
                            {it.filieres.length > 0 && (
                              <span className="rounded bg-slate-100 px-1 text-slate-600">
                                {it.filieres.join("+")}
                              </span>
                            )}
                            {it.has_course && (
                              <span
                                className={`rounded px-1 ${
                                  it.course_validated
                                    ? "bg-green-100 text-green-700"
                                    : "bg-amber-100 text-amber-700"
                                }`}
                                title={
                                  it.course_validated ? "Cours validé" : "Cours généré, non validé"
                                }
                              >
                                {it.course_validated ? "✓ validé" : "✓ généré"}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </aside>

          {/* Détail / éditeur */}
          <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            {!selectedId ? (
              <div className="py-16 text-center text-sm text-slate-500">
                Sélectionne une notion dans la liste pour voir le détail / générer un cours.
              </div>
            ) : loadingDetail || !detail ? (
              <div className="py-8 text-sm text-slate-500">Chargement…</div>
            ) : (
              <>
                <div className="mb-4 border-b border-slate-100 pb-3">
                  <h2 className="text-xl font-bold text-slate-900">{detail.label}</h2>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                    <span className="font-mono">{detail.notion_id}</span>
                    <span>•</span>
                    <span>{MATIERE_LABEL[detail.matiere_id] ?? detail.matiere_id}</span>
                    {detail.chapitre && (
                      <>
                        <span>•</span>
                        <span>{detail.chapitre}</span>
                      </>
                    )}
                    <span>•</span>
                    <span>{detail.exos.length} exos liés</span>
                  </div>
                </div>

                {!detail.course ? (
                  <div className="flex flex-col items-start gap-3">
                    <p className="text-sm text-slate-600">
                      Pas encore de cours pour cette notion.
                    </p>
                    <button
                      onClick={() => handleGenerate(false)}
                      disabled={generating}
                      className="rounded-full bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-indigo-700 disabled:opacity-50"
                    >
                      {generating ? "Génération en cours…" : "Générer le cours"}
                    </button>
                    <p className="text-xs text-slate-500">
                      Le LLM utilisera jusqu&apos;à 5 énoncés liés comme contexte
                      (~10-30s).
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="mb-3 flex flex-wrap items-center gap-2">
                      <button
                        onClick={() => setEditMode((v) => !v)}
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${
                          editMode
                            ? "bg-slate-200 text-slate-800"
                            : "bg-indigo-100 text-indigo-700 hover:bg-indigo-200"
                        }`}
                      >
                        {editMode ? "Aperçu" : "Éditer"}
                      </button>
                      <button
                        onClick={() => handleGenerate(true)}
                        disabled={generating}
                        className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800 hover:bg-amber-200 disabled:opacity-50"
                      >
                        {generating ? "Régénération…" : "Régénérer (écrase)"}
                      </button>
                      <button
                        onClick={toggleValidated}
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${
                          detail.course.validated_by_admin
                            ? "bg-green-100 text-green-700 hover:bg-green-200"
                            : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                        }`}
                      >
                        {detail.course.validated_by_admin ? "✓ Validé" : "Marquer validé"}
                      </button>
                      <span className="ml-auto text-xs text-slate-500">
                        {saving && <span>Sauvegarde…</span>}
                        {!saving && savedAt && (
                          <span>Sauvegardé {new Date(savedAt).toLocaleTimeString()}</span>
                        )}
                        {!saving && !savedAt && (
                          <>
                            Modèle: <span className="font-mono">{detail.course.model}</span>
                            {detail.course.edited_at && <span> · édité</span>}
                          </>
                        )}
                      </span>
                    </div>

                    {editMode ? (
                      <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
                        <textarea
                          value={draftContent}
                          onChange={(e) => setDraftContent(e.target.value)}
                          className="min-h-[70vh] w-full rounded border border-slate-300 p-3 font-mono text-xs leading-relaxed"
                          spellCheck={false}
                        />
                        <div className="prose-math max-h-[70vh] overflow-y-auto rounded border border-slate-200 p-4">
                          <MathText text={draftContent} />
                        </div>
                      </div>
                    ) : (
                      <div className="prose-math max-h-[75vh] overflow-y-auto rounded border border-slate-100 p-4">
                        <MathText text={detail.course.content} />
                      </div>
                    )}
                  </>
                )}

                {/* Exos liés */}
                <details className="mt-4 rounded border border-slate-100 p-3 text-xs">
                  <summary className="cursor-pointer font-semibold text-slate-700">
                    {detail.exos.length} exo(s) lié(s) à cette notion
                  </summary>
                  <ul className="mt-2 space-y-1">
                    {detail.exos.map((ex) => (
                      <li key={ex.id} className="flex gap-2 text-slate-600">
                        <span className="font-mono text-slate-500">{ex.id}</span>
                        <span>·</span>
                        <span>{ex.annee} · série {ex.filiere_id} · {ex.session}</span>
                        <span className="truncate text-slate-500">— {ex.ennonce_preview}</span>
                      </li>
                    ))}
                  </ul>
                </details>
              </>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
