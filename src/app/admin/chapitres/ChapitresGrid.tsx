"use client";

/**
 * Grille des chapitres par série. Chaque ligne = (série, matière, chapitre)
 * avec son statut (brouillon / publié) et l'état de préparation.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";

import type { ChapterGrid, ChapterGridRow } from "@/lib/rag-admin";

import { chapterHref, MATIERE_LABEL } from "./ui";

const FILIERES = ["D", "C"] as const;
const MATIERES = ["math", "pc", "svt"] as const;

function Ratio({ n, d, label }: { n: number; d: number; label: string }) {
  const full = d > 0 && n === d;
  return (
    <span
      className={`whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-semibold ${
        full ? "bg-emerald-50 text-emerald-700" : n === 0 ? "bg-slate-100 text-slate-500" : "bg-amber-50 text-amber-700"
      }`}
      title={label}
    >
      {label} {n}/{d}
    </span>
  );
}

function StatusBadge({ row }: { row: ChapterGridRow }) {
  if (row.status === "published") {
    return (
      <span className="rounded-full bg-emerald-600 px-2.5 py-0.5 text-xs font-bold text-white">
        Publié
      </span>
    );
  }
  return (
    <span className="rounded-full bg-slate-200 px-2.5 py-0.5 text-xs font-bold text-slate-700">
      Brouillon
    </span>
  );
}

export function ChapitresGrid() {
  const [filiere, setFiliere] = useState<string>("D");
  const [matiere, setMatiere] = useState<string>("math");
  const [data, setData] = useState<ChapterGrid | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams();
      if (filiere) qs.set("filiere", filiere);
      if (matiere) qs.set("matiere", matiere);
      const r = await fetch(`/api/admin/chapters?${qs.toString()}`, { cache: "no-store" });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || r.statusText);
      setData(d);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [filiere, matiere]);

  useEffect(() => {
    void load();
  }, [load]);

  const published = useMemo(
    () => (data?.items ?? []).filter((r) => r.status === "published").length,
    [data],
  );

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-2xl font-extrabold text-slate-900">📚 Chapitres publiés</h1>
        <div className="flex items-center gap-3 text-xs font-semibold">
          <Link href="/admin" className="text-indigo-600 hover:underline">← Admin</Link>
          <Link href="/admin/exercices" className="text-indigo-600 hover:underline">Exercices →</Link>
          <Link href="/admin/cours" className="text-indigo-600 hover:underline">Cours →</Link>
        </div>
      </div>
      <p className="mt-1 text-sm text-slate-600">
        Un chapitre en <b>brouillon</b> n&apos;est jamais montré aux élèves : ils voient
        « Pas encore disponible ». Remplis-le dans l&apos;atelier, vérifie l&apos;aperçu, puis publie.
      </p>

      <div className="mt-5 flex flex-wrap items-center gap-2">
        {FILIERES.map((f) => (
          <button
            key={f}
            onClick={() => setFiliere(f)}
            className={`rounded-full px-3 py-1 text-sm font-semibold ${
              filiere === f ? "bg-indigo-600 text-white" : "bg-white text-slate-700 ring-1 ring-slate-200"
            }`}
          >
            Série {f}
          </button>
        ))}
        <span className="mx-1 h-5 w-px bg-slate-200" />
        {MATIERES.map((m) => (
          <button
            key={m}
            onClick={() => setMatiere(m)}
            className={`rounded-full px-3 py-1 text-sm font-semibold ${
              matiere === m ? "bg-indigo-600 text-white" : "bg-white text-slate-700 ring-1 ring-slate-200"
            }`}
          >
            {MATIERE_LABEL[m]}
          </button>
        ))}
        {data && (
          <span className="ml-auto text-xs text-slate-500">
            {published} publié{published > 1 ? "s" : ""} sur {data.items.length}
          </span>
        )}
      </div>

      {error && (
        <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}
      {loading && !data && <p className="mt-6 text-sm text-slate-500">Chargement…</p>}

      {data && (
        <div className="mt-4 overflow-hidden rounded-2xl bg-white ring-1 ring-slate-200">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-2">Chapitre</th>
                <th className="px-4 py-2">Statut</th>
                <th className="px-4 py-2">Préparation</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.items.map((r) => (
                <tr key={`${r.filiere_id}|${r.matiere_id}|${r.chapitre}`} className="align-top">
                  <td className="px-4 py-3">
                    <div className="font-semibold text-slate-900">{r.chapitre}</div>
                    <div className="text-xs text-slate-500">
                      {r.checks.exercises} exercice{r.checks.exercises > 1 ? "s" : ""}
                      {r.years ? ` · ${r.years[0]}–${r.years[1]}` : ""}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge row={r} />
                    {r.checks.ready && r.status === "draft" && (
                      <div className="mt-1 text-xs font-semibold text-emerald-700">Prêt à publier</div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1.5">
                      <Ratio n={r.checks.exercises_validated} d={r.checks.exercises} label="Validés" />
                      <Ratio n={r.checks.corrections_ready} d={r.checks.exercises} label="Corrections" />
                      {r.checks.notions_curated ? (
                        <Ratio n={r.checks.lessons_validated} d={r.checks.notions} label="Cours" />
                      ) : (
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-500">
                          Notions à fixer
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={chapterHref("/admin/chapitres/atelier", r)}
                      className="rounded-full bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700"
                    >
                      Ouvrir
                    </Link>
                  </td>
                </tr>
              ))}
              {data.items.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-sm text-slate-500">
                    Aucun chapitre pour cette série et cette matière.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {data && data.unassigned.length > 0 && (
        <p className="mt-3 text-xs text-slate-500">
          {data.unassigned.map((u) => (
            <span key={`${u.filiere_id}${u.matiere_id}`}>
              ⚠️ {u.exercises} exercices de {MATIERE_LABEL[u.matiere_id] ?? u.matiere_id} série{" "}
              {u.filiere_id} n&apos;ont pas de chapitre : ils n&apos;apparaîtront dans aucun chapitre
              tant qu&apos;on ne leur en donne pas un (éditeur d&apos;exercices).{" "}
            </span>
          ))}
        </p>
      )}
    </main>
  );
}
