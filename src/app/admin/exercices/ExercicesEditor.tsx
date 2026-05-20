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

type Full = {
  id: string;
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
  validated_by_admin?: boolean;
};

type Stats = {
  total: number;
  validated: number;
  remaining: number;
  validated_pct: number;
  by_matiere: Record<string, number>;
};

type Neighbors = { prev: string | null; next: string | null; position: number | null; total: number };

const MATIERES = ["math", "physique", "chimie", "svt"] as const;
const FILIERES = ["C", "D", "TM", "M"] as const;

export function ExercicesEditor() {
  // ── Filtres
  const [matiere, setMatiere] = useState<string>("");
  const [filiere, setFiliere] = useState<string>("");
  const [onlyUnvalidated, setOnlyUnvalidated] = useState(true);
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
    const qs = new URLSearchParams({ limit: "500" });
    if (matiere) qs.set("matiere", matiere);
    if (filiere) qs.set("filiere", filiere);
    if (onlyUnvalidated) qs.set("validated", "false");
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
  }, [matiere, filiere, onlyUnvalidated, search]);

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

  // ── UI helpers
  const updateDraft = (patch: Partial<Full>) => {
    setDraft((d) => ({ ...d, ...patch }));
    schedulePatch(patch);
  };

  const matiereBadge = useMemo(() => ({
    math: "bg-blue-100 text-blue-700",
    physique: "bg-purple-100 text-purple-700",
    chimie: "bg-amber-100 text-amber-700",
    svt: "bg-green-100 text-green-700",
  } as Record<string, string>), []);

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <main className="mx-auto max-w-[1500px] px-4 py-6">
      <div className="mb-4 flex flex-wrap items-baseline gap-4">
        <h1 className="text-2xl font-extrabold text-slate-900">Exercices Bac · admin</h1>
        {stats && (
          <div className="text-sm text-slate-600">
            <span className="font-semibold text-slate-900">{stats.total}</span> total ·{" "}
            <span className="font-semibold text-emerald-700">{stats.validated}</span> validés ({stats.validated_pct.toFixed(0)} %) ·{" "}
            <span className="font-semibold text-amber-700">{stats.remaining}</span> restants
          </div>
        )}
        {stats && (
          <div className="flex gap-2 text-xs">
            {MATIERES.map((m) => (
              <span key={m} className={`rounded-full px-2 py-0.5 ${matiereBadge[m]}`}>
                {m} · {stats.by_matiere[m] ?? 0}
              </span>
            ))}
          </div>
        )}
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
          {MATIERES.map((m) => <option key={m} value={m}>{m}</option>)}
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
                      {it.validated_by_admin && <span className="text-emerald-600 text-xs">✓</span>}
                    </div>
                    <div className="mt-0.5 truncate font-medium text-slate-900">{it.chapitre || "(sans chapitre)"}</div>
                    <div className="truncate text-xs text-slate-500">{it.ennonce_preview}…</div>
                  </button>
                </div>
              );
            })}
          </div>
        </div>

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
                  className="mt-1 h-64 w-full rounded border border-slate-300 px-3 py-2 font-mono text-sm leading-relaxed"
                  placeholder="Colle ou corrige l'énoncé ici. Tu peux écrire avec des $...$ pour le LaTeX."
                />
              </div>

              {/* Validé + nav */}
              <div className="flex items-center justify-between border-t border-slate-100 pt-3">
                <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                  <input
                    type="checkbox"
                    checked={!!current.validated_by_admin}
                    onChange={(e) => doPatch({ validated_by_admin: e.target.checked })}
                  />
                  ✓ Validé par admin
                </label>
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
