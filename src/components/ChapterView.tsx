"use client";

/**
 * Vue élève d'un chapitre : pour chaque notion, les années où elle est tombée
 * au bac, le cours (validé par l'admin) et les exercices avec leur correction.
 *
 * Utilisée par l'aperçu admin (/admin/chapitres/apercu) et, plus tard, par
 * l'écran résultat élève. Avec `adminInfo`, affiche ce qui est caché aux élèves.
 */

import { useState } from "react";

import { MathText } from "@/components/MathText";

export type ChapterViewData = {
  filiere_id: string;
  matiere_id: string;
  chapitre: string;
  status?: "draft" | "published";
  notions: {
    notion_id: string;
    label: string;
    lesson: string | null;
    years: number[];
    occurrences: {
      id: string;
      annee: number;
      session: string;
      exercice_numero: string | number;
      chapitre: string;
      enonce: string;
      correction: string | null;
    }[];
    admin?: {
      hidden_unvalidated_exercises: number;
      lesson_exists: boolean;
      lesson_hidden_unvalidated: boolean;
    };
  }[];
};

function sessionShort(s: string): string {
  return /compl/i.test(s) ? "complémentaire" : "normale";
}

function Occurrence({ o }: { o: ChapterViewData["notions"][number]["occurrences"][number] }) {
  const [open, setOpen] = useState(false);
  const [showCorrection, setShowCorrection] = useState(false);
  return (
    <div className="rounded-xl ring-1 ring-slate-200">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm"
      >
        <span className="font-semibold text-slate-800">
          Bac {o.annee} · session {sessionShort(o.session)} · Exercice {o.exercice_numero}
        </span>
        <span className="text-xs text-slate-500">{open ? "Masquer" : "Voir"}</span>
      </button>
      {open && (
        <div className="border-t border-slate-100 px-3 py-3">
          <MathText text={o.enonce || "_Énoncé indisponible._"} />
          {o.correction ? (
            <div className="mt-3">
              <button
                onClick={() => setShowCorrection((v) => !v)}
                className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700 hover:bg-indigo-100"
              >
                {showCorrection ? "Masquer la correction" : "Voir la correction"}
              </button>
              {showCorrection && (
                <div className="mt-2 rounded-lg bg-slate-50 p-3">
                  <MathText text={o.correction} />
                </div>
              )}
            </div>
          ) : (
            <p className="mt-3 text-xs text-slate-500">Correction pas encore disponible.</p>
          )}
        </div>
      )}
    </div>
  );
}

export function ChapterView({
  view,
  adminInfo = false,
  compact = false,
}: {
  view: ChapterViewData;
  adminInfo?: boolean;
  /** Replie la liste des exercices de chaque notion derrière un bouton (écran élève mobile). */
  compact?: boolean;
}) {
  const [openLesson, setOpenLesson] = useState<string | null>(null);
  const [openList, setOpenList] = useState<Set<string>>(new Set());
  const toggleList = (id: string) =>
    setOpenList((cur) => {
      const next = new Set(cur);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  return (
    <div className="space-y-4">
      {view.notions.map((n) => (
        <section key={n.notion_id} className="rounded-2xl bg-white p-4 ring-1 ring-slate-200">
          <h3 className="text-base font-bold text-slate-900">{n.label}</h3>

          {n.years.length > 0 ? (
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <span className="text-xs text-slate-500">Tombé au bac en</span>
              {n.years.map((y) => (
                <span key={y} className="rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-semibold text-indigo-700">
                  {y}
                </span>
              ))}
            </div>
          ) : (
            <p className="mt-2 text-xs text-slate-500">Aucun exercice de bac disponible pour cette notion.</p>
          )}

          {adminInfo && n.admin && (
            <div className="mt-2 space-y-1 text-xs">
              {n.admin.hidden_unvalidated_exercises > 0 && (
                <p className="rounded bg-amber-50 px-2 py-1 text-amber-800">
                  Admin : {n.admin.hidden_unvalidated_exercises} exercice(s) lié(s) caché(s) car non validé(s).
                </p>
              )}
              {!n.admin.lesson_exists && (
                <p className="rounded bg-amber-50 px-2 py-1 text-amber-800">Admin : pas encore de cours pour cette notion.</p>
              )}
              {n.admin.lesson_hidden_unvalidated && (
                <p className="rounded bg-amber-50 px-2 py-1 text-amber-800">
                  Admin : le cours existe mais est caché tant qu&apos;il n&apos;est pas validé.
                </p>
              )}
            </div>
          )}

          {n.lesson && (
            <div className="mt-3">
              <button
                onClick={() => setOpenLesson(openLesson === n.notion_id ? null : n.notion_id)}
                className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-100"
              >
                {openLesson === n.notion_id ? "Fermer le cours" : "📖 Lire le cours"}
              </button>
              {openLesson === n.notion_id && (
                <div className="mt-2 rounded-lg bg-slate-50 p-3">
                  <MathText text={n.lesson} />
                </div>
              )}
            </div>
          )}

          {n.occurrences.length > 0 && compact && (
            <button
              onClick={() => toggleList(n.notion_id)}
              className="mt-3 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-200"
            >
              {openList.has(n.notion_id)
                ? "Masquer les exercices"
                : `Voir ${n.occurrences.length > 1 ? `les ${n.occurrences.length} exercices` : "l'exercice"}`}
            </button>
          )}
          {n.occurrences.length > 0 && (!compact || openList.has(n.notion_id)) && (
            <div className="mt-3 space-y-2">
              {n.occurrences.map((o) => (
                <Occurrence key={o.id} o={o} />
              ))}
            </div>
          )}
        </section>
      ))}
      {view.notions.length === 0 && (
        <p className="text-sm text-slate-500">Aucune notion retenue pour ce chapitre.</p>
      )}
    </div>
  );
}
