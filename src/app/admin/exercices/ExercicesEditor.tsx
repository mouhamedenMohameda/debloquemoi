"use client";

/**
 * Éditeur visuel pour la collection json_bac sur le rag-service.
 *
 * Layout : barre stats en haut · filtres + liste à gauche · éditeur à droite.
 * Le champ "Énoncé" et "Notions" sont auto-sauvegardés (debounce 700 ms ou blur).
 * Navigation prev/next respecte les filtres (matière + only_unvalidated).
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type ListItem = {
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

type Full = {
  id: string;
  titre?: string;
  matiere_id: string;
  filiere_id: string;
  fichier: string;
  annee: number;
  session: string;
  matiere: string;
  filiere: string;
  exercice_numero: string | number;
  chapitre: string;
  notions_traitees: string[];
  ennonce_complet: string;
  correction?: string;
  is_skeleton?: boolean;
  validated_by_admin?: boolean;
};

type Stats = {
  total: number;
  validated: number;
  remaining: number;
  validated_pct: number;
  skeletons: number;
  filled: number;
  by_matiere: Record<string, number>;
  by_filiere: Record<string, number>;
};

type Neighbors = { prev: string | null; next: string | null; position: number | null; total: number };

// Mauritanie 2026 — 3 matières effectives. PC = sciences physiques (physique + chimie).
const MATIERES = ["math", "pc", "svt"] as const;
const MATIERE_LABEL: Record<string, string> = {
  math: "Math",
  pc: "Sciences Physiques",
  svt: "SVT",
};
// 2 filières scientifiques au Bac mauritanien
const FILIERES = ["C", "D"] as const;
const SESSIONS = ["Normale", "Complémentaire"] as const;

export function ExercicesEditor() {
  // ── Filtres
  const [matiere, setMatiere] = useState<string>("");
  const [filiere, setFiliere] = useState<string>("");
  const [onlyUnvalidated, setOnlyUnvalidated] = useState(true);
  const [skeletonFilter, setSkeletonFilter] = useState<"all" | "skeleton" | "filled">("all");
  const [search, setSearch] = useState("");

  // ── Données
  const [list, setList] = useState<ListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loadingList, setLoadingList] = useState(false);
  const [stats, setStats] = useState<Stats | null>(null);

  // ── Sélection
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [current, setCurrent] = useState<Full | null>(null);
  const [loadingCurrent, setLoadingCurrent] = useState(false);
  const [neighbors, setNeighbors] = useState<Neighbors | null>(null);

  // ── Édition locale
  const [draft, setDraft] = useState<Partial<Full>>({});
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Charge la liste (et les stats)
  const reloadList = useCallback(async () => {
    setLoadingList(true);
    const qs = new URLSearchParams({ limit: "1500" });
    if (matiere) qs.set("matiere", matiere);
    if (filiere) qs.set("filiere", filiere);
    if (onlyUnvalidated) qs.set("validated", "false");
    if (skeletonFilter === "skeleton") qs.set("skeleton", "true");
    if (skeletonFilter === "filled") qs.set("skeleton", "false");
    if (search.trim()) qs.set("q", search.trim());
    // Tri chronologique : année récente d'abord, normale avant compl., PC ensemble
    qs.set("sort", "chronological");
    try {
      const r = await fetch(`/api/admin/exercices?${qs.toString()}`, { cache: "no-store" });
      if (r.ok) {
        const d = await r.json();
        setList(d.items ?? []);
        setTotal(d.total ?? 0);
      }
    } finally {
      setLoadingList(false);
    }
  }, [matiere, filiere, onlyUnvalidated, skeletonFilter, search]);

  const reloadStats = useCallback(async () => {
    try {
      const r = await fetch(`/api/admin/exercices/stats`, { cache: "no-store" });
      if (r.ok) setStats(await r.json());
    } catch { /* silently */ }
  }, []);

  useEffect(() => { void reloadList(); void reloadStats(); }, [reloadList, reloadStats]);

  // ── Charge le détail + voisins quand on sélectionne
  useEffect(() => {
    if (!selectedId) { setCurrent(null); setNeighbors(null); return; }
    let active = true;
    void (async () => {
      setLoadingCurrent(true);
      try {
        const [d, n] = await Promise.all([
          fetch(`/api/admin/exercices/${encodeURIComponent(selectedId)}`, { cache: "no-store" }).then((r) => r.json()),
          fetch(
            `/api/admin/exercices/${encodeURIComponent(selectedId)}/neighbors?` +
              new URLSearchParams({
                ...(matiere ? { matiere } : {}),
                ...(filiere ? { filiere } : {}),
                ...(onlyUnvalidated ? { only_unvalidated: "true" } : {}),
              }).toString(),
            { cache: "no-store" },
          ).then((r) => r.json()),
        ]);
        if (!active) return;
        setCurrent(d);
        setDraft({
          ennonce_complet: d.ennonce_complet ?? "",
          correction: d.correction ?? "",
          chapitre: d.chapitre ?? "",
          notions_traitees: d.notions_traitees ?? [],
        });
        setNeighbors(n);
        setSavedAt(null);
      } finally {
        if (active) setLoadingCurrent(false);
      }
    })();
    return () => { active = false; };
  }, [selectedId, matiere, filiere, onlyUnvalidated]);

  // ── Auto-save (debounce 700 ms)
  const schedulePatch = useCallback((patch: Partial<Full>) => {
    if (!current) return;
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      void doPatch(patch);
    }, 700);
  }, [current]);

  async function doPatch(patch: Partial<Full>) {
    if (!current) return;
    setSaving(true);
    try {
      const r = await fetch(`/api/admin/exercices/${encodeURIComponent(current.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (r.ok) {
        const updated = await r.json();
        setCurrent(updated);
        setSavedAt(Date.now());
        // Mise à jour silencieuse de la ligne dans la liste
        setList((prev) => prev.map((it) => it.id === updated.id ? {
          ...it,
          chapitre: updated.chapitre ?? it.chapitre,
          notions_count: (updated.notions_traitees ?? []).length,
          ennonce_preview: (updated.ennonce_complet ?? "").slice(0, 140),
          validated_by_admin: !!updated.validated_by_admin,
          updated_at: updated.updated_at ?? it.updated_at,
        } : it));
      }
    } finally {
      setSaving(false);
    }
  }

  // ── Navigation
  const goPrev = () => neighbors?.prev && setSelectedId(neighbors.prev);
  const goNext = () => neighbors?.next && setSelectedId(neighbors.next);

  // ── Création d'un nouvel exo
  async function addNewExercise(input: {
    filiere_id: "C" | "D";
    matiere_id: "math" | "pc" | "svt";
    annee: number;
    session: "Normale" | "Complémentaire";
    exercice_numero: number;
  }) {
    const r = await fetch(`/api/admin/exercices`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    if (!r.ok) {
      const err = await r.json().catch(() => ({}));
      alert(`Création impossible : ${err.error ?? r.statusText}`);
      return;
    }
    const created = await r.json();
    await reloadList();
    await reloadStats();
    setSelectedId(created.id);
  }

  // ── Suppression
  async function deleteCurrent() {
    if (!current) return;
    if (!confirm(`Supprimer l'exercice ${current.id} ? Cette action est irréversible (mais un backup automatique est créé).`)) return;
    const r = await fetch(`/api/admin/exercices/${encodeURIComponent(current.id)}`, { method: "DELETE" });
    if (!r.ok) {
      const err = await r.json().catch(() => ({}));
      alert(`Suppression impossible : ${err.error ?? r.statusText}`);
      return;
    }
    // Bascule vers le suivant avant que current ne devienne invalide
    const nextId = neighbors?.next ?? neighbors?.prev ?? null;
    setSelectedId(nextId);
    await reloadList();
    await reloadStats();
  }

  // ── UI helpers
  const updateDraft = (patch: Partial<Full>) => {
    setDraft((d) => ({ ...d, ...patch }));
    schedulePatch(patch);
  };

  const matiereBadge = useMemo(() => ({
    math: "bg-blue-100 text-blue-700",
    pc: "bg-purple-100 text-purple-700",
    // legacy (avant migration pc)
    physique: "bg-purple-100 text-purple-700",
    chimie: "bg-amber-100 text-amber-700",
    svt: "bg-green-100 text-green-700",
  } as Record<string, string>), []);

  const [showAddDialog, setShowAddDialog] = useState(false);

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <main className="mx-auto max-w-[1500px] px-4 py-6">
      <div className="mb-4 flex flex-wrap items-baseline gap-4">
        <h1 className="text-2xl font-extrabold text-slate-900">Exercices Bac · admin</h1>
        {stats && (
          <div className="text-sm text-slate-600">
            <span className="font-semibold text-slate-900">{stats.total}</span> total ·{" "}
            <span className="font-semibold text-emerald-700">{stats.validated}</span> validés ({stats.validated_pct.toFixed(0)} %) ·{" "}
            <span className="font-semibold text-slate-500">{stats.skeletons}</span> squelettes vides ·{" "}
            <span className="font-semibold text-amber-700">{stats.remaining}</span> restants
          </div>
        )}
        {stats && (
          <div className="flex gap-2 text-xs">
            {MATIERES.map((m) => {
              // pc agrège aussi les legacy physique/chimie
              const count = m === "pc"
                ? (stats.by_matiere["pc"] ?? 0) + (stats.by_matiere["physique"] ?? 0) + (stats.by_matiere["chimie"] ?? 0)
                : stats.by_matiere[m] ?? 0;
              return (
                <span key={m} className={`rounded-full px-2 py-0.5 ${matiereBadge[m]}`}>
                  {MATIERE_LABEL[m]} · {count}
                </span>
              );
            })}
          </div>
        )}
        <button
          onClick={() => setShowAddDialog(true)}
          className="ml-auto rounded-full bg-indigo-600 px-3 py-1.5 text-sm font-semibold text-white shadow hover:bg-indigo-700"
        >
          + Ajouter un exo
        </button>
      </div>

      {/* Filtres */}
      <div className="mb-4 flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
        <select
          value={matiere}
          onChange={(e) => setMatiere(e.target.value)}
          className="rounded border border-slate-300 px-2 py-1 text-sm"
          title="Filtrer par matière"
        >
          <option value="">Toutes matières</option>
          {MATIERES.map((m) => <option key={m} value={m}>{MATIERE_LABEL[m]}</option>)}
        </select>
        <select
          value={filiere}
          onChange={(e) => setFiliere(e.target.value)}
          className="rounded border border-slate-300 px-2 py-1 text-sm"
          title="Filtrer par filière"
        >
          <option value="">Toutes filières</option>
          {FILIERES.map((f) => <option key={f} value={f}>Série {f}</option>)}
        </select>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={onlyUnvalidated}
            onChange={(e) => setOnlyUnvalidated(e.target.checked)}
          />
          Non validés seulement
        </label>
        <select
          value={skeletonFilter}
          onChange={(e) => setSkeletonFilter(e.target.value as "all" | "skeleton" | "filled")}
          className="rounded border border-slate-300 px-2 py-1 text-sm"
          title="Filtrer squelettes vides / remplis"
        >
          <option value="all">Tous</option>
          <option value="skeleton">Squelettes vides</option>
          <option value="filled">Remplis (énoncé ou correction)</option>
        </select>
        <input
          type="search"
          placeholder="Recherche dans l'énoncé, chapitre, fichier…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="min-w-[280px] flex-1 rounded border border-slate-300 px-2 py-1 text-sm"
        />
        <span className="text-xs text-slate-500">{loadingList ? "Chargement…" : `${total} résultat(s)`}</span>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(300px,1fr)_minmax(500px,2fr)]">
        {/* Liste à gauche */}
        <div className="rounded-lg border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="max-h-[75vh] overflow-y-auto">
            {list.length === 0 && !loadingList ? (
              <div className="p-6 text-center text-sm text-slate-500">Aucun exercice.</div>
            ) : list.map((it, idx) => {
              const prev = list[idx - 1];
              const showHeader =
                !prev || prev.annee !== it.annee || prev.session !== it.session;
              return (
                <div key={it.id}>
                  {showHeader && (
                    <div className="sticky top-0 z-10 bg-slate-100 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-slate-600 border-y border-slate-200">
                      {it.annee} · {it.session}
                    </div>
                  )}
                  <button
                    onClick={() => setSelectedId(it.id)}
                    className={`block w-full border-b border-slate-100 px-3 py-2 text-left text-sm hover:bg-slate-50 ${
                      selectedId === it.id ? "bg-indigo-50 ring-1 ring-indigo-300" : ""
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className={`rounded px-1.5 py-0.5 text-xs ${matiereBadge[it.matiere_id] ?? "bg-slate-100"}`}>
                        {it.matiere_id}
                      </span>
                      <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-mono text-slate-600">
                        {it.filiere_id}
                      </span>
                      {typeof it.exercice_numero !== "undefined" && (
                        <span className="text-[11px] font-mono text-slate-500">ex{it.exercice_numero}</span>
                      )}
                      {it.is_skeleton && (
                        <span className="rounded bg-slate-100 px-1 py-0.5 text-[10px] text-slate-500">vide</span>
                      )}
                      {it.has_correction && (
                        <span className="rounded bg-emerald-50 px-1 py-0.5 text-[10px] text-emerald-700">+corr</span>
                      )}
                      {it.validated_by_admin && <span className="text-emerald-600 text-xs">✓</span>}
                    </div>
                    <div className="mt-0.5 truncate font-medium text-slate-900">{it.chapitre || (it.is_skeleton ? <span className="text-slate-400 italic">(squelette vide)</span> : "(sans chapitre)")}</div>
                    <div className="truncate text-xs text-slate-500">{it.ennonce_preview || "(pas encore d'énoncé)"}…</div>
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* Dialog Ajouter */}
        {showAddDialog && (
          <AddExerciseDialog
            onClose={() => setShowAddDialog(false)}
            onCreate={async (input) => {
              await addNewExercise(input);
              setShowAddDialog(false);
            }}
          />
        )}

        {/* Éditeur à droite */}
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          {!selectedId ? (
            <div className="flex h-full min-h-[60vh] flex-col items-center justify-center text-center text-slate-500">
              <p>← Sélectionne un exercice à gauche pour le corriger.</p>
            </div>
          ) : loadingCurrent || !current ? (
            <div className="text-slate-500">Chargement…</div>
          ) : (
            <div className="space-y-4">
              {/* Header */}
              <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-3">
                <div>
                  <div className="font-mono text-xs text-slate-500">{current.id}</div>
                  <div className="mt-1 text-sm text-slate-700">
                    <span className={`mr-1 rounded px-1.5 py-0.5 text-xs ${matiereBadge[current.matiere_id] ?? "bg-slate-100"}`}>
                      {current.matiere_id}
                    </span>
                    <span className="font-semibold">{current.fichier}</span> · ex {current.exercice_numero}
                  </div>
                  <div className="mt-0.5 text-xs text-slate-500">
                    {current.annee} · {current.session} · {current.filiere_id} ({current.filiere})
                  </div>
                </div>
                <div className="text-right text-xs">
                  {saving ? (
                    <span className="text-amber-600">💾 Sauvegarde…</span>
                  ) : savedAt ? (
                    <span className="text-emerald-600">✓ Sauvegardé</span>
                  ) : (
                    <span className="text-slate-400">—</span>
                  )}
                  {neighbors?.position && (
                    <div className="text-slate-400">
                      {neighbors.position} / {neighbors.total}
                    </div>
                  )}
                </div>
              </div>

              {/* Chapitre */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">Chapitre</label>
                <input
                  type="text"
                  value={draft.chapitre ?? ""}
                  onChange={(e) => updateDraft({ chapitre: e.target.value })}
                  className="mt-1 w-full rounded border border-slate-300 px-3 py-1.5 text-sm"
                />
              </div>

              {/* Notions */}
              <NotionsEditor
                value={draft.notions_traitees ?? []}
                onChange={(v) => updateDraft({ notions_traitees: v })}
              />

              {/* Énoncé */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Énoncé complet
                  <span className="ml-2 font-normal text-slate-400">
                    {(draft.ennonce_complet ?? "").length} caractères
                  </span>
                </label>
                <textarea
                  value={draft.ennonce_complet ?? ""}
                  onChange={(e) => updateDraft({ ennonce_complet: e.target.value })}
                  className="mt-1 h-56 w-full rounded border border-slate-300 px-3 py-2 font-mono text-sm leading-relaxed"
                  placeholder="Colle ou corrige l'énoncé ici. Tu peux écrire avec des $...$ pour le LaTeX."
                />
              </div>

              {/* Correction */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Correction (solution rédigée)
                  <span className="ml-2 font-normal text-slate-400">
                    {(draft.correction ?? "").length} caractères
                  </span>
                </label>
                <textarea
                  value={draft.correction ?? ""}
                  onChange={(e) => updateDraft({ correction: e.target.value })}
                  className="mt-1 h-56 w-full rounded border border-slate-300 px-3 py-2 font-mono text-sm leading-relaxed"
                  placeholder="Colle la correction officielle (style IPN). LaTeX OK avec $...$ et $$...$$."
                />
              </div>

              {/* Validé + nav + suppression */}
              <div className="flex items-center justify-between gap-2 border-t border-slate-100 pt-3">
                <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                  <input
                    type="checkbox"
                    checked={!!current.validated_by_admin}
                    onChange={(e) => doPatch({ validated_by_admin: e.target.checked })}
                  />
                  ✓ Validé par admin
                </label>
                <button
                  onClick={deleteCurrent}
                  className="rounded-full border border-rose-300 px-3 py-1.5 text-xs text-rose-700 hover:bg-rose-50"
                  title="Supprimer cet exercice (backup automatique)"
                >
                  🗑 Supprimer
                </button>
                <div className="flex gap-2">
                  <button
                    onClick={goPrev}
                    disabled={!neighbors?.prev}
                    className="rounded-full border border-slate-300 px-3 py-1.5 text-sm disabled:opacity-40"
                  >
                    ◀ Précédent
                  </button>
                  <button
                    onClick={goNext}
                    disabled={!neighbors?.next}
                    className="rounded-full bg-indigo-600 px-4 py-1.5 text-sm font-semibold text-white shadow disabled:opacity-40"
                  >
                    Suivant ▶
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

// ─── Sous-composant : notions sous forme de tags ─────────────────────────────

// ─── Dialog : créer un nouvel exercice squelette ─────────────────────────────

function AddExerciseDialog({
  onClose,
  onCreate,
}: {
  onClose: () => void;
  onCreate: (input: {
    filiere_id: "C" | "D";
    matiere_id: "math" | "pc" | "svt";
    annee: number;
    session: "Normale" | "Complémentaire";
    exercice_numero: number;
  }) => Promise<void>;
}) {
  const currentYear = new Date().getFullYear();
  const [filiere_id, setFiliere] = useState<"C" | "D">("C");
  const [matiere_id, setMatiere] = useState<"math" | "pc" | "svt">("pc");
  const [annee, setAnnee] = useState<number>(currentYear);
  const [session, setSession] = useState<"Normale" | "Complémentaire">("Normale");
  const [exercice_numero, setExNum] = useState<number>(1);
  const [submitting, setSubmitting] = useState(false);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div className="w-full max-w-md rounded-lg bg-white p-5 shadow-xl">
        <h2 className="mb-3 text-lg font-bold text-slate-900">Ajouter un exercice</h2>
        <div className="grid grid-cols-2 gap-3">
          <label className="text-sm">
            <span className="block text-xs font-semibold text-slate-500">Filière</span>
            <select value={filiere_id} onChange={(e) => setFiliere(e.target.value as "C" | "D")}
              className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5">
              {FILIERES.map((f) => <option key={f} value={f}>Série {f}</option>)}
            </select>
          </label>
          <label className="text-sm">
            <span className="block text-xs font-semibold text-slate-500">Matière</span>
            <select value={matiere_id} onChange={(e) => setMatiere(e.target.value as "math" | "pc" | "svt")}
              className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5">
              {MATIERES.map((m) => <option key={m} value={m}>{MATIERE_LABEL[m]}</option>)}
            </select>
          </label>
          <label className="text-sm">
            <span className="block text-xs font-semibold text-slate-500">Année</span>
            <input type="number" value={annee} min={1990} max={currentYear + 1}
              onChange={(e) => setAnnee(parseInt(e.target.value) || currentYear)}
              className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5" />
          </label>
          <label className="text-sm">
            <span className="block text-xs font-semibold text-slate-500">Session</span>
            <select value={session} onChange={(e) => setSession(e.target.value as "Normale" | "Complémentaire")}
              className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5">
              {SESSIONS.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </label>
          <label className="text-sm">
            <span className="block text-xs font-semibold text-slate-500">Numéro de l'exo</span>
            <input type="number" value={exercice_numero} min={1} max={20}
              onChange={(e) => setExNum(parseInt(e.target.value) || 1)}
              className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5" />
          </label>
        </div>
        <div className="mt-5 flex items-center justify-end gap-2">
          <button onClick={onClose} className="rounded-full border border-slate-300 px-4 py-1.5 text-sm">
            Annuler
          </button>
          <button
            disabled={submitting}
            onClick={async () => {
              setSubmitting(true);
              try {
                await onCreate({ filiere_id, matiere_id, annee, session, exercice_numero });
              } finally {
                setSubmitting(false);
              }
            }}
            className="rounded-full bg-indigo-600 px-4 py-1.5 text-sm font-semibold text-white shadow disabled:opacity-50"
          >
            {submitting ? "Création…" : "Créer"}
          </button>
        </div>
      </div>
    </div>
  );
}

function NotionsEditor({
  value,
  onChange,
}: {
  value: string[];
  onChange: (v: string[]) => void;
}) {
  const [input, setInput] = useState("");
  const add = () => {
    const v = input.trim();
    if (!v) return;
    if (value.includes(v)) { setInput(""); return; }
    onChange([...value, v]);
    setInput("");
  };
  const remove = (i: number) => onChange(value.filter((_, idx) => idx !== i));
  return (
    <div>
      <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
        Notions traitées
      </label>
      <div className="mt-1 flex flex-wrap items-center gap-1.5 rounded border border-slate-300 px-2 py-1.5">
        {value.map((n, i) => (
          <span key={i} className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs">
            {n}
            <button
              onClick={() => remove(i)}
              className="text-slate-400 hover:text-rose-600"
              type="button"
              aria-label="Retirer"
            >✕</button>
          </span>
        ))}
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === ",") {
              e.preventDefault();
              add();
            } else if (e.key === "Backspace" && !input && value.length) {
              remove(value.length - 1);
            }
          }}
          onBlur={add}
          placeholder="+ ajouter une notion (Entrée)"
          className="min-w-[180px] flex-1 border-0 px-1 py-0.5 text-sm outline-none"
        />
      </div>
    </div>
  );
}
