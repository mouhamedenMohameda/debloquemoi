"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import { ChapterView, type ChapterViewData } from "@/components/ChapterView";

import { chapterHref, MATIERE_LABEL, scopeQuery } from "../ui";

type Scope = { filiere_id: string; matiere_id: string; chapitre: string };

export function ApercuClient({ scope }: { scope: Scope }) {
  const [view, setView] = useState<ChapterViewData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch(`/api/admin/chapters/preview?${scopeQuery(scope)}`, { cache: "no-store" });
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || r.statusText);
        if (!cancelled) setView(d);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [scope]);

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <Link href={chapterHref("/admin/chapitres/atelier", scope)} className="text-xs font-semibold text-indigo-600 hover:underline">
        ← Retour à l&apos;atelier
      </Link>
      <div className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-900 ring-1 ring-amber-200">
        Aperçu élève — les encadrés jaunes « Admin » ne sont visibles que par toi.
        {view?.status !== "published" && " Ce chapitre est en brouillon : les élèves voient « Pas encore disponible »."}
      </div>
      <h1 className="mt-4 text-2xl font-extrabold text-slate-900">{scope.chapitre}</h1>
      <p className="text-sm text-slate-600">
        Série {scope.filiere_id} · {MATIERE_LABEL[scope.matiere_id] ?? scope.matiere_id}
      </p>
      {error && <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      {!view && !error && <p className="mt-6 text-sm text-slate-500">Chargement…</p>}
      {view && (
        <div className="mt-5">
          <ChapterView view={view} adminInfo />
        </div>
      )}
    </main>
  );
}
