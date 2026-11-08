"use client";

/**
 * « Mes annales » : photo (ou texte) d'un exercice → ce qui a déjà été donné au
 * bac sur les mêmes notions.
 *
 *   1. Série (C / D) — demandée une seule fois, enregistrée dans le profil.
 *   2. Photo → texte (via /api/ocr, image compressée avant l'envoi), modifiable.
 *   3. Résultat (/api/bac/analyze, gratuit) :
 *        - sujet de bac reconnu → sa correction validée ;
 *        - sinon chapitre + notions, avec les années, les exercices et les cours ;
 *        - chapitre non publié → « Pas encore disponible ».
 *   4. « Indices pas à pas » → page d'accueil avec l'énoncé déjà rempli.
 */

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { ChapterView, type ChapterViewData } from "@/components/ChapterView";
import { MathText } from "@/components/MathText";

type Filiere = "C" | "D";

type AnalyzeResult = {
  status: "matched" | "detected" | "not_published" | "unknown";
  matiere_id?: string;
  chapitre?: string | null;
  message?: string;
  exercise?: {
    id: string;
    annee: number;
    session: string;
    exercice_numero: string | number;
    enonce: string;
    correction: string | null;
  } | null;
  notions?: ChapterViewData["notions"];
  other_notions?: { notion_id: string; label: string }[];
};

const MATIERE_LABEL: Record<string, string> = {
  math: "Mathématiques",
  pc: "Sciences Physiques",
  svt: "Sciences Naturelles",
};

function sessionLabel(s: string): string {
  return /compl/i.test(s) ? "session complémentaire" : "session normale";
}

/** Réduit la photo (côté long ≤ 1600 px, JPEG) : lecture plus rapide et moins chère. */
async function compressImage(file: File): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = reject;
      i.src = url;
    });
    const max = 1600;
    const scale = Math.min(1, max / Math.max(img.width, img.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(img.width * scale);
    canvas.height = Math.round(img.height * scale);
    canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.85);
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function BacClient({ initialFiliere }: { initialFiliere: Filiere | null }) {
  const router = useRouter();
  const [filiere, setFiliere] = useState<Filiere | null>(initialFiliere);
  const [changingFiliere, setChangingFiliere] = useState(false);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState<null | "ocr" | "analyze" | "filiere">(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AnalyzeResult | null>(null);
  const [showCorrection, setShowCorrection] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function saveFiliere(f: Filiere) {
    setBusy("filiere");
    setError(null);
    try {
      const r = await fetch("/api/profile/filiere", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bac_filiere: f }),
      });
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || "Erreur");
      setFiliere(f);
      setChangingFiliere(false);
      setResult(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }

  async function onPhoto(file: File | undefined) {
    if (!file) return;
    setBusy("ocr");
    setError(null);
    setResult(null);
    try {
      const imageDataUrl = await compressImage(file);
      const r = await fetch("/api/ocr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageDataUrl }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || "Lecture de la photo impossible.");
      setText(d.text || "");
      await analyze(d.text || "");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy((b) => (b === "ocr" ? null : b));
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function analyze(t: string = text) {
    if (t.trim().length < 10) {
      setError("Écris ou photographie l'énoncé complet de l'exercice.");
      return;
    }
    setBusy("analyze");
    setError(null);
    setShowCorrection(false);
    try {
      const r = await fetch("/api/bac/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: t }),
      });
      const d = await r.json().catch(() => ({}));
      if (r.status === 409 && d.need_filiere) {
        setFiliere(null);
        return;
      }
      if (!r.ok) throw new Error(d.error || "Erreur, réessaie.");
      setResult(d as AnalyzeResult);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }

  function goToHints() {
    try {
      window.sessionStorage.setItem(
        "debloquemoi:prefill",
        JSON.stringify({ exercise: text, subjectId: result?.matiere_id === "math" ? "math" : undefined }),
      );
    } catch {
      /* stockage indisponible : l'élève recollera l'énoncé */
    }
    router.push("/");
  }

  // ── Étape 0 : la série ─────────────────────────────────────────────────────
  if (!filiere || changingFiliere) {
    return (
      <main className="mx-auto max-w-xl px-4 py-12 text-center">
        <h1 className="text-2xl font-extrabold text-slate-900">Tu es en quelle série ?</h1>
        <p className="mt-2 text-sm text-slate-600">
          On te montre les sujets du bac de ta série. Tu pourras la changer plus tard.
        </p>
        <div className="mt-6 grid grid-cols-2 gap-3">
          {(["C", "D"] as const).map((f) => (
            <button
              key={f}
              disabled={busy === "filiere"}
              onClick={() => saveFiliere(f)}
              className={`rounded-2xl px-4 py-6 text-left ring-1 transition hover:ring-indigo-400 disabled:opacity-50 ${
                filiere === f ? "bg-indigo-50 ring-indigo-400" : "bg-white ring-slate-200"
              }`}
            >
              <div className="text-2xl font-extrabold text-slate-900">Série {f}</div>
              <div className="mt-1 text-xs text-slate-500">
                {f === "C" ? "Mathématiques" : "Sciences de la nature"}
              </div>
            </button>
          ))}
        </div>
        {changingFiliere && (
          <button onClick={() => setChangingFiliere(false)} className="mt-4 text-sm text-slate-500 hover:underline">
            Annuler
          </button>
        )}
        {error && <p className="mt-4 text-sm text-red-700">{error}</p>}
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-2xl font-extrabold text-slate-900">📸 Mes annales</h1>
        <button onClick={() => setChangingFiliere(true)} className="text-xs font-semibold text-indigo-600 hover:underline">
          Série {filiere} · changer
        </button>
      </div>
      <p className="mt-1 text-sm text-slate-600">
        Prends ton exercice en photo : on te dit de quel chapitre il s&apos;agit, les notions qu&apos;il utilise et
        les années où elles sont tombées au bac, avec les corrections et le cours.
      </p>

      {/* ── Énoncé ─────────────────────────────────────────────────────── */}
      <section className="mt-5 rounded-2xl bg-white p-4 ring-1 ring-slate-200">
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => onPhoto(e.target.files?.[0])}
        />
        <button
          disabled={busy !== null}
          onClick={() => fileRef.current?.click()}
          className="w-full rounded-xl bg-indigo-600 px-4 py-3 text-base font-bold text-white shadow hover:bg-indigo-700 disabled:opacity-50"
        >
          {busy === "ocr" ? "Lecture de la photo…" : "📷 Prendre ou choisir une photo"}
        </button>
        <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
          Ou écris / colle l&apos;énoncé
        </p>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={text ? 8 : 4}
          placeholder="Ex. : On pose P(z) = z³ − (5 + 4i)z² + (1 + 16i)z + 3 − 12i…"
          className="mt-1 w-full rounded-lg border border-slate-200 p-3 text-sm"
        />
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <button
            disabled={busy !== null || text.trim().length < 10}
            onClick={() => analyze()}
            className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
          >
            {busy === "analyze" ? "Recherche…" : "Trouver dans les annales"}
          </button>
          {text && <span className="text-xs text-slate-500">Tu peux corriger le texte lu avant de chercher.</span>}
        </div>
        {error && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      </section>

      {/* ── Résultat ───────────────────────────────────────────────────── */}
      {result && (
        <section className="mt-6">
          {result.status === "not_published" && (
            <div className="rounded-2xl bg-amber-50 p-5 text-center ring-1 ring-amber-200">
              <div className="text-lg font-bold text-amber-900">Annales pas encore disponibles</div>
              <p className="mt-1 text-sm text-amber-800">
                Cet exercice porte sur <b>{result.chapitre ?? "un chapitre"}</b>. Les sujets du bac, corrections et
                cours vérifiés de ce chapitre sont en préparation pour la série {filiere}.
              </p>
              <p className="mt-2 text-sm text-amber-800">
                Tu peux quand même te faire aider par l&apos;IA : sa réponse ne sera pas vérifiée par un professeur.
              </p>
            </div>
          )}

          {result.status === "unknown" && (
            <div className="rounded-2xl bg-slate-50 p-5 text-center ring-1 ring-slate-200">
              <div className="text-lg font-bold text-slate-900">On n&apos;a pas reconnu cet exercice</div>
              <p className="mt-1 text-sm text-slate-600">
                Il ne correspond à aucun sujet du bac vérifié. Vérifie que le texte lu correspond bien à
                l&apos;énoncé, ou fais-toi aider par l&apos;IA (réponse non vérifiée par un professeur).
              </p>
            </div>
          )}

          {(result.status === "matched" || result.status === "detected") && (
            <>
              <div className="rounded-2xl bg-white p-4 ring-1 ring-slate-200">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Série {filiere} · {MATIERE_LABEL[result.matiere_id ?? ""] ?? result.matiere_id}
                </p>
                <h2 className="text-xl font-extrabold text-slate-900">{result.chapitre}</h2>
                {(result.notions?.length ?? 0) > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {result.notions!.map((n) => (
                      <span key={n.notion_id} className="rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-700">
                        {n.label}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {result.exercise && (
                <div className="mt-4 rounded-2xl bg-emerald-50 p-4 ring-1 ring-emerald-200">
                  <div className="text-sm font-bold text-emerald-900">
                    ✅ C&apos;est un sujet du bac : Bac {filiere} {result.exercise.annee} ·{" "}
                    {sessionLabel(result.exercise.session)} · Exercice {result.exercise.exercice_numero}
                  </div>
                  {result.exercise.correction ? (
                    <>
                      <button
                        onClick={() => setShowCorrection((v) => !v)}
                        className="mt-3 rounded-full bg-emerald-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-emerald-700"
                      >
                        {showCorrection ? "Masquer la correction" : "Voir la correction"}
                      </button>
                      {showCorrection && (
                        <div className="mt-3 rounded-xl bg-white p-3">
                          <MathText text={result.exercise.correction} />
                        </div>
                      )}
                    </>
                  ) : (
                    <p className="mt-1 text-xs text-emerald-800">La correction arrive bientôt.</p>
                  )}
                </div>
              )}

              {(result.notions?.length ?? 0) > 0 && (
                <div className="mt-5">
                  <h3 className="mb-2 text-base font-bold text-slate-900">Les notions de ton exercice au bac</h3>
                  <ChapterView
                    compact
                    view={{
                      filiere_id: filiere,
                      matiere_id: result.matiere_id ?? "",
                      chapitre: result.chapitre ?? "",
                      notions: result.notions!,
                    }}
                  />
                </div>
              )}

              {(result.other_notions?.length ?? 0) > 0 && (
                <p className="mt-4 text-xs text-slate-500">
                  Autres notions du chapitre : {result.other_notions!.map((n) => n.label).join(" · ")}
                </p>
              )}
            </>
          )}

          <div className="mt-6 rounded-2xl bg-indigo-50 p-4 text-center ring-1 ring-indigo-100">
            <p className="text-sm text-indigo-900">
              {result.status === "matched" && result.exercise?.correction
                ? "Tu préfères chercher toi-même ? Les indices s'appuient sur la correction vérifiée."
                : result.status === "matched" || result.status === "detected"
                  ? "Besoin d'aide pour le résoudre ? Les indices sont rédigés par l'IA (non vérifiés)."
                  : "Aide de l'IA, étape par étape (non vérifiée par un professeur)."}
            </p>
            <button
              onClick={goToHints}
              className="mt-2 rounded-full bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
            >
              💡 Indices pas à pas
            </button>
          </div>
        </section>
      )}
    </main>
  );
}
