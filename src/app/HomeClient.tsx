"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { SUBJECTS } from "@/lib/subjects";
import { MathText } from "@/components/MathText";
import { useTranslation } from "@/components/LanguageProvider";
import {
  MIN_HINT_BALANCE_MRU,
  OCR_FLAT_COST_MRU,
  costFor,
  formatMRU,
} from "@/lib/pricing";

type Usage = { prompt: number; completion: number; total: number; model: string };
type HintLevel = 1 | 2 | 3;
type AppMode = "correct" | "explain";
type Hint = {
  level: HintLevel;
  text: string;
  usage?: Usage;
  mode?: AppMode;
  similarExam?: string | null;
};

// Un "groupe" = toutes les aides demandées pour UNE question (focus) donnée.
// Permet de basculer entre questions sans perdre les corrections déjà obtenues.
type CorrectionGroup = {
  focusKey: string;
  focusLabel: string;
  hints: Hint[];
};

// Un "session" sauvegardée dans localStorage = un exercice traité dans une matière donnée.
type SavedSession = {
  id: string;
  createdAt: number;
  updatedAt: number;
  mode: AppMode;
  subjectId: string;
  chapterId: string;
  exercise: string;
  correction?: string;
  focusQuestion: string;
  treatAll: boolean;
  groups: CorrectionGroup[];
};

const LEVEL_LABEL: Record<HintLevel, { title: string; icon: string; color: string }> = {
  1: { title: "Petit indice", icon: "💡", color: "from-amber-400 to-yellow-500" },
  2: { title: "Indice plus précis", icon: "🔍", color: "from-sky-400 to-indigo-500" },
  3: { title: "Solution complète", icon: "✅", color: "from-emerald-400 to-teal-500" },
};

const LEVEL_BUTTON: Record<HintLevel, string> = {
  1: "Je suis bloqué — un indice",
  2: "Toujours bloqué — plus précis",
  3: "Solution complète",
};

const FOCUS_KEY_ALL = "__all__";
const HISTORY_KEY_PREFIX = "debloquemoi_sessions_v1:";
const MAX_SESSIONS = 50;

function historyKeyFor(userId: number): string {
  return `${HISTORY_KEY_PREFIX}${userId}`;
}

function makeSessionId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function sessionTitle(s: SavedSession, emptyText: string): string {
  const raw = (s.exercise || s.correction || "").trim();
  const cleaned = raw.replace(/\s+/g, " ").replace(/[#*`>]/g, "");
  return cleaned.length > 60 ? cleaned.slice(0, 60) + "…" : cleaned || emptyText;
}

function relativeTime(t: number, tHome: any, locale: string): string {
  const d = (Date.now() - t) / 1000;
  if (d < 60) return tHome.timeJustNow;
  if (d < 3600) return tHome.timeMinutesAgo.replace("{count}", String(Math.floor(d / 60)));
  if (d < 86400) return tHome.timeHoursAgo.replace("{count}", String(Math.floor(d / 3600)));
  if (d < 604800) return tHome.timeDaysAgo.replace("{count}", String(Math.floor(d / 86400)));
  return new Date(t).toLocaleDateString(locale === "ar" ? "ar-MR" : "fr-FR");
}

type HomeClientProps = {
  userId: number;
  balanceMru: number;
  freeHintsRemaining: number;
};

export default function HomeClient({
  userId,
  balanceMru,
  freeHintsRemaining,
}: HomeClientProps) {
  const router = useRouter();
  const { t, locale } = useTranslation();

  const levelLabels = useMemo(() => ({
    1: { title: locale === "ar" ? "تلميح بسيط" : "Petit indice", icon: "💡", color: "from-amber-400 to-yellow-500" },
    2: { title: locale === "ar" ? "تلميح أكثر دقة" : "Indice plus précis", icon: "🔍", color: "from-sky-400 to-indigo-500" },
    3: { title: locale === "ar" ? "الحل الكامل" : "Solution complète", icon: "✅", color: "from-emerald-400 to-teal-500" },
  }), [locale]);

  const levelButtons = useMemo(() => ({
    1: locale === "ar" ? "أنا عالق — تلميح" : "Je suis bloqué — un indice",
    2: locale === "ar" ? "ما زلت عالقاً — تلميح أكثر دقة" : "Toujours bloqué — plus précis",
    3: locale === "ar" ? "الحل الكامل" : "Solution complète",
  }), [locale]);

  const HISTORY_KEY = historyKeyFor(userId);
  // Nombre maximum d'OCR qu'on peut lancer avec le solde courant :
  // chaque photo = 1 free hint OU 1 MRU. Les photos déjà en file
  // « réservent » un crédit chacune (refus si on tente d'en queue de
  // plus). Le serveur refera la vérif à l'extraction.
  const maxOcrCalls =
    freeHintsRemaining + Math.floor(balanceMru / OCR_FLAT_COST_MRU);
  const [subjectId, setSubjectId] = useState(SUBJECTS[0].id);
  const subject = useMemo(
    () => SUBJECTS.find((s) => s.id === subjectId)!,
    [subjectId],
  );
  const [chapterId, setChapterId] = useState(subject.chapters[0].id);
  const [mode, setMode] = useState<AppMode>("correct");
  const [exercise, setExercise] = useState("");
  // Mode "explain" : la correction existante fournie par l'élève
  const [correction, setCorrection] = useState("");
  const [focusQuestion, setFocusQuestion] = useState("");
  // Par défaut on traite l'exercice EN ENTIER. L'élève focalise sur une
  // question via les chips si besoin.
  const [treatAll, setTreatAll] = useState(true);
  // Images + OCR pour l'énoncé (peuvent être plusieurs)
  // pendingImages : photos uploadées en attente de transcription (gratuites
  // tant que l'utilisateur n'appuie pas sur "Extraire"). imagePreviews :
  // photos déjà transcrites (texte ajouté au textarea).
  const [pendingImages, setPendingImages] = useState<string[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrUsage, setOcrUsage] = useState<Usage | null>(null);
  // Images + OCR pour la correction (mode explain)
  const [pendingCorrectionImages, setPendingCorrectionImages] = useState<string[]>([]);
  const [correctionImagePreviews, setCorrectionImagePreviews] = useState<string[]>([]);
  const [correctionOcrLoading, setCorrectionOcrLoading] = useState(false);
  const [correctionOcrUsage, setCorrectionOcrUsage] = useState<Usage | null>(null);
  // Historique des sessions sauvegardées
  const [savedSessions, setSavedSessions] = useState<SavedSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  // Toutes les corrections produites, organisées par question (focusKey)
  const [groups, setGroups] = useState<CorrectionGroup[]>([]);
  const [loading, setLoading] = useState(false);
  // Progression du fan-out "Tout l'exercice"
  const [fanProgress, setFanProgress] = useState<{
    current: number;
    total: number;
    label: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const lastGroupRef = useRef<HTMLElement | null>(null);

  // Détecte si l'énoncé contient plusieurs sous-questions.
  const subQuestions = useMemo(() => detectSubQuestions(exercise), [exercise]);

  // Identifie la "cible" courante : un focus explicite OU "Tout l'exercice".
  // (Plus de cas "default" séparé — on traite TOUJOURS l'exercice entier sauf
  // si l'élève focalise explicitement.)
  const { key: currentKey, label: currentLabel } = useMemo(() => {
    const fq = focusQuestion.trim();
    if (fq) return { key: fq, label: fq };
    const label =
      subQuestions.length >= 2 ? "Tout l'exercice" : "Cet exercice";
    return { key: FOCUS_KEY_ALL, label };
  }, [focusQuestion, subQuestions.length]);

  const currentGroup = useMemo(
    () => groups.find((g) => g.focusKey === currentKey),
    [groups, currentKey],
  );
  const currentHints = currentGroup?.hints ?? [];

  // Niveau "suivant" = le plus petit niveau pas encore généré pour ce groupe
  const generatedLevels = useMemo(
    () => new Set(currentHints.map((h) => h.level)),
    [currentHints],
  );
  const nextLevel = ([1, 2, 3] as HintLevel[]).find(
    (l) => !generatedLevels.has(l),
  );
  const canAskMore = nextLevel !== undefined;
  const hasSolution = generatedLevels.has(3);
  const canSubmit = exercise.trim().length >= 1;

  function fullReset() {
    setGroups([]);
    setError(null);
    setExercise("");
    setCorrection("");
    setFocusQuestion("");
    setTreatAll(true); // défaut = traiter tout l'exercice
    setPendingImages([]);
    setImagePreviews([]);
    setOcrUsage(null);
    setPendingCorrectionImages([]);
    setCorrectionImagePreviews([]);
    setCorrectionOcrUsage(null);
    setCurrentSessionId(null);
  }


  // Coût total (en MRU) sur TOUS les groupes + OCR (énoncé + correction)
  const allHints = useMemo(() => groups.flatMap((g) => g.hints), [groups]);
  const totalMRU =
    (ocrUsage ? costFor(ocrUsage.model, ocrUsage.prompt, ocrUsage.completion).mru : 0) +
    (correctionOcrUsage
      ? costFor(
          correctionOcrUsage.model,
          correctionOcrUsage.prompt,
          correctionOcrUsage.completion,
        ).mru
      : 0) +
    allHints.reduce(
      (sum, h) =>
        sum +
        (h.usage
          ? costFor(h.usage.model, h.usage.prompt, h.usage.completion).mru
          : 0),
      0,
    );

  // Upload = preview seulement. La transcription (OCR + débit) ne se déclenche
  // que lorsque l'utilisateur appuie sur « Extraire le texte ». Ça permet de
  // changer une photo mal cadrée sans avoir été débité.
  // Nombre de photos déjà en attente (toutes cibles confondues).
  const pendingCount = pendingImages.length + pendingCorrectionImages.length;
  const remainingOcrCalls = Math.max(0, maxOcrCalls - pendingCount);

  const queueImage = useCallback(
    async (
      file: File,
      target: "exercise" | "correction",
    ): Promise<{ ok: boolean }> => {
      setError(null);
      if (!file.type.startsWith("image/")) {
        setError("Merci d'envoyer une image (JPG, PNG, HEIC...).");
        return { ok: false };
      }
      if (file.size > 6 * 1024 * 1024) {
        setError("Image trop lourde (>6 MB).");
        return { ok: false };
      }
      if (remainingOcrCalls <= 0) {
        if (maxOcrCalls === 0) {
          setError(
            `Solde insuffisant pour transcrire des photos. Il te faut au moins ${OCR_FLAT_COST_MRU} MRU par photo (ou des corrections gratuites).`,
          );
        } else {
          setError(
            `Tu as déjà ${pendingCount} photo${pendingCount > 1 ? "s" : ""} en attente — c'est le maximum pour ton solde actuel (${maxOcrCalls} max). Extrais-les d'abord ou recharge.`,
          );
        }
        return { ok: false };
      }
      const dataUrl = await fileToDataUrl(file);
      const setQueue =
        target === "correction" ? setPendingCorrectionImages : setPendingImages;
      setQueue((p) => [...p, dataUrl]);
      return { ok: true };
    },
    [maxOcrCalls, pendingCount, remainingOcrCalls],
  );

  // Transcrit toutes les photos en attente d'une cible. Chaque image
  // consomme un free hint OU débite du MRU côté serveur.
  const extractPendingOcr = useCallback(
    async (target: "exercise" | "correction") => {
      setError(null);
      const pending =
        target === "correction" ? pendingCorrectionImages : pendingImages;
      if (pending.length === 0) return;

      const setQueue =
        target === "correction" ? setPendingCorrectionImages : setPendingImages;
      const setPrevs =
        target === "correction"
          ? setCorrectionImagePreviews
          : setImagePreviews;
      const setLoad =
        target === "correction" ? setCorrectionOcrLoading : setOcrLoading;
      const setUse =
        target === "correction" ? setCorrectionOcrUsage : setOcrUsage;
      const setText = target === "correction" ? setCorrection : setExercise;

      setLoad(true);
      try {
        for (const dataUrl of pending) {
          try {
            const res = await fetch("/api/ocr", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ imageDataUrl: dataUrl }),
            });
            const data = await res.json();
            if (!res.ok) {
              setError(data.error ?? "Erreur OCR");
              // On stoppe le batch — les photos restantes restent en attente
              break;
            }
            router.refresh();
            setText((prev) =>
              prev.trim().length === 0
                ? data.text
                : `${prev}\n\n${data.text}`,
            );
            setPrevs((p) => [...p, dataUrl]);
            setQueue((p) => p.filter((u) => u !== dataUrl));
            if (data.usage) {
              setUse((prev) =>
                prev
                  ? {
                      ...data.usage,
                      prompt: prev.prompt + data.usage.prompt,
                      completion: prev.completion + data.usage.completion,
                      total: prev.total + data.usage.total,
                    }
                  : data.usage,
              );
            }
          } catch (e) {
            setError(e instanceof Error ? e.message : "Erreur OCR inconnue");
            break;
          }
        }
      } finally {
        setLoad(false);
      }
    },
    [pendingCorrectionImages, pendingImages, router],
  );

  const handleFile = useCallback(
    async (file: File) => {
      await queueImage(file, "exercise");
    },
    [queueImage],
  );
  const handleCorrectionFile = useCallback(
    async (file: File) => {
      await queueImage(file, "correction");
    },
    [queueImage],
  );

  // Drag & drop global avec routing par zone (data-drop-target).
  useEffect(() => {
    function onDragOver(e: DragEvent) {
      e.preventDefault();
      if (e.dataTransfer?.types.includes("Files")) setDragOver(true);
    }
    function onDragLeave(e: DragEvent) {
      if (e.relatedTarget === null) setDragOver(false);
    }
    function onDrop(e: DragEvent) {
      e.preventDefault();
      setDragOver(false);
      const files = Array.from(e.dataTransfer?.files ?? []).filter((f) =>
        f.type.startsWith("image/"),
      );
      if (files.length === 0) return;
      // Détermine la cible selon le drop-zone le plus proche du point de chute.
      const target =
        (e.target as HTMLElement | null)?.closest?.("[data-drop-target]") ??
        null;
      const which = target?.getAttribute("data-drop-target") ?? "exercise";
      void (async () => {
        for (const f of files) {
          if (which === "correction") await queueImage(f, "correction");
          else await queueImage(f, "exercise");
        }
      })();
    }
    window.addEventListener("dragover", onDragOver);
    window.addEventListener("dragleave", onDragLeave);
    window.addEventListener("drop", onDrop);
    return () => {
      window.removeEventListener("dragover", onDragOver);
      window.removeEventListener("dragleave", onDragLeave);
      window.removeEventListener("drop", onDrop);
    };
  }, [queueImage]);

  // === Historique : hydratation au mount + sauvegarde auto ===
  const hydratedRef = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined") {
      hydratedRef.current = true;
      return;
    }
    try {
      const raw = window.localStorage.getItem(HISTORY_KEY);
      if (raw) {
        const data = JSON.parse(raw);
        if (Array.isArray(data)) {
          const valid: SavedSession[] = data.filter(
            (s: unknown): s is SavedSession =>
              !!s &&
              typeof s === "object" &&
              typeof (s as SavedSession).id === "string" &&
              typeof (s as SavedSession).exercise === "string" &&
              Array.isArray((s as SavedSession).groups),
          );
          setSavedSessions(valid);
        }
      }
    } catch {
      /* corruption — on ignore */
    }
    hydratedRef.current = true;
  }, []);

  // Auto-save de la session courante dès qu'une réponse IA existe.
  useEffect(() => {
    if (!hydratedRef.current) return;
    if (typeof window === "undefined") return;
    if (groups.length === 0) return; // pas de contenu IA → on ne persiste pas

    const now = Date.now();
    setSavedSessions((prev) => {
      const partial = {
        mode,
        subjectId,
        chapterId,
        exercise,
        correction: correction || undefined,
        focusQuestion,
        treatAll,
        groups,
        updatedAt: now,
      };
      if (currentSessionId) {
        const idx = prev.findIndex((s) => s.id === currentSessionId);
        if (idx === -1) {
          return [
            { id: currentSessionId, createdAt: now, ...partial },
            ...prev,
          ].slice(0, MAX_SESSIONS);
        }
        const copy = [...prev];
        copy[idx] = { ...copy[idx], ...partial };
        return copy;
      }
      // Pas de session active → en créer une
      const id = makeSessionId();
      // Note: on doit faire le setCurrentSessionId dans un useEffect séparé,
      // sinon ça déclenche un warning. On le fait via Promise.resolve.
      Promise.resolve().then(() => setCurrentSessionId(id));
      return [{ id, createdAt: now, ...partial }, ...prev].slice(
        0,
        MAX_SESSIONS,
      );
    });
  }, [
    groups,
    exercise,
    correction,
    focusQuestion,
    treatAll,
    mode,
    subjectId,
    chapterId,
    currentSessionId,
  ]);

  // Persiste la liste à chaque changement
  useEffect(() => {
    if (!hydratedRef.current) return;
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(HISTORY_KEY, JSON.stringify(savedSessions));
    } catch {
      /* quota / privé */
    }
  }, [savedSessions]);

  function loadSession(id: string) {
    const s = savedSessions.find((x) => x.id === id);
    if (!s) return;
    setCurrentSessionId(s.id);
    setMode(s.mode);
    setSubjectId(s.subjectId);
    setChapterId(s.chapterId);
    setExercise(s.exercise);
    setCorrection(s.correction ?? "");
    setFocusQuestion(s.focusQuestion);
    setTreatAll(s.treatAll);
    setGroups(s.groups);
    setError(null);
    setHistoryOpen(false);
    setPendingImages([]);
    setImagePreviews([]);
    setPendingCorrectionImages([]);
    setCorrectionImagePreviews([]);
    setOcrUsage(null);
    setCorrectionOcrUsage(null);
  }

  function deleteSession(id: string) {
    setSavedSessions((prev) => prev.filter((s) => s.id !== id));
    if (currentSessionId === id) fullReset();
  }

  function newSession() {
    fullReset();
    setHistoryOpen(false);
  }

  // Coller une image : on route vers le textarea actuellement focus (correction
  // si l'élève est dans le champ correction, énoncé sinon).
  useEffect(() => {
    function onPaste(e: ClipboardEvent) {
      const item = Array.from(e.clipboardData?.items ?? []).find((i) =>
        i.type.startsWith("image/"),
      );
      if (!item) return;
      const file = item.getAsFile();
      if (!file) return;
      const active = document.activeElement as HTMLElement | null;
      const target = active?.closest?.("[data-drop-target]");
      const which = target?.getAttribute("data-drop-target") ?? "exercise";
      if (which === "correction") void queueImage(file, "correction");
      else void queueImage(file, "exercise");
    }
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [queueImage]);

  // Fan-out : génère la solution complète de CHAQUE sous-question détectée,
  // chacune dans son propre groupe. Bien meilleur que de demander une mégarépoinse.
  async function askAllQuestions() {
    if (subQuestions.length === 0) return;
    setLoading(true);
    setError(null);
    for (let i = 0; i < subQuestions.length; i++) {
      const q = subQuestions[i];
      const focusLabel = locale === "ar" ? `السؤال ${q}` : `Question ${q}`;
      setFanProgress({ current: i + 1, total: subQuestions.length, label: q });

      // Si cette question a déjà une solution (niveau 3), on saute.
      const existing = groups.find((g) => g.focusKey === focusLabel);
      if (existing?.hints.some((h) => h.level === 3)) continue;

      try {
        const res = await fetch("/api/hint", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            exercise,
            subjectId,
            chapterId,
            level: 3,
            previousHints: [],
            focusQuestion: focusLabel,
            treatAll: false,
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          setError(locale === "ar" ? `خطأ في ${focusLabel} : ${data.error ?? "غير معروف"}` : `Erreur sur ${focusLabel} : ${data.error ?? "inconnue"}`);
          break;
        }
        router.refresh();
        const newHint: Hint = {
          level: 3,
          text: data.hint,
          usage: data.usage,
          similarExam: data.similar_exam ?? null,
        };
        setGroups((prev) => {
          const idx = prev.findIndex((g) => g.focusKey === focusLabel);
          if (idx === -1) {
            return [
              ...prev,
              { focusKey: focusLabel, focusLabel, hints: [newHint] },
            ];
          }
          const newHints = [
            ...prev[idx].hints.filter((h) => h.level !== 3),
            newHint,
          ].sort((a, b) => a.level - b.level);
          const copy = [...prev];
          copy[idx] = { ...copy[idx], hints: newHints };
          return copy;
        });

        // Scroll vers la dernière correction
        requestAnimationFrame(() => {
          lastGroupRef.current?.scrollIntoView({
            behavior: "smooth",
            block: "end",
          });
        });
      } catch (e) {
        setError(
          locale === "ar" ? `خطأ في ${focusLabel} : ${e instanceof Error ? e.message : "غير معروف"}` : `Erreur sur ${focusLabel} : ${e instanceof Error ? e.message : "inconnue"}`,
        );
        break;
      }
    }
    setFanProgress(null);
    setLoading(false);
  }

  async function askHint(targetLevel?: HintLevel) {
    const level = targetLevel ?? nextLevel;
    if (!level) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/hint", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          exercise,
          subjectId,
          chapterId,
          level,
          previousHints: currentHints
            .filter((h) => h.level < level)
            .map((h) => h.text),
          focusQuestion: focusQuestion.trim() || undefined,
          treatAll,
          // Mode explain : si correction fournie, l'API bascule sur le prompt d'explication.
          correction: mode === "explain" ? correction : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erreur");
      router.refresh();

      const newHint: Hint = {
        level,
        text: data.hint,
        usage: data.usage,
        mode: mode,
        similarExam: data.similar_exam ?? null,
      };
      setGroups((prev) => {
        const idx = prev.findIndex((g) => g.focusKey === currentKey);
        if (idx === -1) {
          return [
            ...prev,
            { focusKey: currentKey, focusLabel: currentLabel, hints: [newHint] },
          ];
        }
        // Remplace si le niveau existe déjà, sinon ajoute, puis tri par niveau
        const existing = prev[idx].hints.findIndex((h) => h.level === level);
        const newHints =
          existing === -1
            ? [...prev[idx].hints, newHint]
            : prev[idx].hints.map((h, i) => (i === existing ? newHint : h));
        newHints.sort((a, b) => a.level - b.level);
        const copy = [...prev];
        copy[idx] = { ...copy[idx], hints: newHints };
        return copy;
      });

      // Scroll vers le bas pour voir la nouvelle réponse
      requestAnimationFrame(() => {
        lastGroupRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "end",
        });
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur inconnue");
    } finally {
      setLoading(false);
    }
  }

  function removeGroup(key: string) {
    setGroups((prev) => prev.filter((g) => g.focusKey !== key));
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-indigo-50/40 to-emerald-50/40">
      {/* Overlay de drag global */}
      {dragOver && (
        <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center bg-indigo-600/10 backdrop-blur-sm">
          <div className="rounded-3xl border-4 border-dashed border-indigo-500 bg-white px-10 py-8 text-center shadow-2xl">
            <div className="text-5xl">📸</div>
            <div className="mt-2 text-lg font-semibold text-indigo-700">
              {t.home.dragOverOverlay}
            </div>
          </div>
        </div>
      )}

      {/* Drawer Historique */}
      {historyOpen && (
        <div className="fixed inset-0 z-40">
          <div
            className="absolute inset-0 bg-black/30 backdrop-blur-sm"
            onClick={() => setHistoryOpen(false)}
          />
          <aside className={`absolute ${locale === "ar" ? "left-0" : "right-0"} top-0 flex h-full w-full flex-col bg-white shadow-2xl sm:w-[400px]`}>
            <header className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <h2 className="flex items-center gap-2 text-sm font-bold text-slate-900">
                {t.home.historyTitle}
                <span className={`rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600 ${locale === "ar" ? "mr-1.5" : "ml-1.5"}`}>
                  {savedSessions.length}
                </span>
              </h2>
              <button
                type="button"
                onClick={() => setHistoryOpen(false)}
                className="rounded-full p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                aria-label={t.common.close}
              >
                ✕
              </button>
            </header>

            <div className="border-b border-slate-100 p-3">
              <button
                type="button"
                onClick={newSession}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow active:scale-[0.98] hover:bg-indigo-700"
              >
                {t.home.btnNewSession}
              </button>
            </div>

            <div className="flex-1 overflow-y-auto">
              {savedSessions.length === 0 ? (
                <div className="px-5 py-10 text-center text-sm text-slate-400">
                  {t.home.historyEmpty}
                  <br />
                  <span className="text-xs">
                    {t.home.historyEmptyDesc}
                  </span>
                </div>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {[...savedSessions]
                    .sort((a, b) => b.updatedAt - a.updatedAt)
                    .map((s) => {
                      const subj = SUBJECTS.find((x) => x.id === s.subjectId);
                      const subjName = subj ? (t.subjects[subj.id as keyof typeof t.subjects] || subj.name) : "•";
                      const isActive = s.id === currentSessionId;
                      return (
                        <li
                          key={s.id}
                          className={`group flex items-stretch ${
                            isActive ? "bg-indigo-50/50" : ""
                          }`}
                        >
                          <button
                            type="button"
                            onClick={() => loadSession(s.id)}
                            className="flex-1 px-4 py-3 text-left transition hover:bg-slate-50"
                          >
                            <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                              <span>{s.mode === "explain" ? "📖" : "✏️"}</span>
                              <span>{subj?.emoji ?? "•"}</span>
                              <span className="truncate">{subjName}</span>
                              <span className="ms-auto text-slate-400">
                                {relativeTime(s.updatedAt, t.home, locale)}
                              </span>
                            </div>
                            <div className="mt-1 line-clamp-2 text-[13px] text-slate-800">
                              {sessionTitle(s, locale === "ar" ? "(فارغ)" : "(vide)")}
                            </div>
                            <div className="mt-1 text-[10px] text-slate-400">
                              {t.home.historyCorrectionsCount
                                .replace("{count}", String(s.groups.length))
                                .replace("{plural}", s.groups.length > 1 ? "s" : "")}
                              {s.mode === "explain" ? ` · ${t.home.historyExplainMode}` : ""}
                            </div>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              if (
                                confirm(
                                  t.home.confirmDeleteSession,
                                )
                              ) {
                                deleteSession(s.id);
                              }
                            }}
                            className="px-3 text-slate-300 transition hover:bg-red-50 hover:text-red-600"
                            aria-label={t.home.toastDelete}
                          >
                            🗑
                          </button>
                        </li>
                      );
                    })}
                </ul>
              )}
            </div>
          </aside>
        </div>
      )}

      <main className="mx-auto max-w-7xl px-4 py-5 sm:px-6 sm:py-10">
        {/* Toolbar : compteur de coût local + bouton Historique (non-sticky, plus léger sur mobile) */}
        <div className="mb-6 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="text-2xl font-black bg-gradient-to-r from-indigo-600 to-emerald-600 bg-clip-text text-transparent">
              Débloque-moi 🎓
            </span>
          </div>
          <div className="flex items-center gap-2">
            {totalMRU > 0 && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-50 px-3 py-1 font-mono text-[11px] font-bold text-indigo-700 ring-1 ring-inset ring-indigo-200">
                💸 {formatMRU(totalMRU)} {t.common.mru}
              </span>
            )}
            <button
              type="button"
              onClick={() => setHistoryOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold text-slate-700 transition active:scale-95 hover:bg-slate-50 cursor-pointer shadow-sm"
              title={t.home.historyTitle}
            >
              📚 <span className="hidden sm:inline">{t.home.historyTitle.replace("📚 ", "")}</span>
              {savedSessions.length > 0 && (
                <span className="rounded-full bg-indigo-600 px-1.5 text-[10px] font-bold text-white">
                  {savedSessions.length}
                </span>
              )}
            </button>
          </div>
        </div>

        <section className="mb-8 text-center sm:mb-10">
          <h1 className="text-3xl font-extrabold leading-tight tracking-tight text-slate-900 sm:text-5xl">
            {t.home.heroTitle}
            <br />
            <span className="bg-gradient-to-r from-indigo-600 to-emerald-600 bg-clip-text text-transparent">
              {t.home.heroSubtitle}
            </span>
          </h1>
          <p className="mx-auto mt-3 max-w-2xl text-sm text-slate-600 sm:text-base">
            {t.home.heroDesc}
          </p>
        </section>

        {/* 2-Column Split Workspace Grid */}
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
          
          {/* Column 1: Config, Inputs & Actions (Left Side, 1/3 width) */}
          <div className="lg:col-span-1 space-y-6">
            
            <section className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-xl shadow-slate-200/50 sm:p-6">
              
              <h2 className="mb-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                {locale === "ar" ? "1. حدد وضع المساعدة" : "1. Mode d'assistance"}
              </h2>

              {/* Mode Cards Switcher */}
              <div className="mb-6 grid grid-cols-2 gap-3">
                
                {/* Mode Indices */}
                <button
                  type="button"
                  onClick={() => {
                    if (mode !== "correct") {
                      setMode("correct");
                      setGroups([]);
                      setError(null);
                    }
                  }}
                  className={`group relative flex flex-col items-center justify-center rounded-2xl border-2 p-3 text-center transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer ${
                    mode === "correct"
                      ? "border-indigo-600 bg-indigo-50/30 ring-4 ring-indigo-50"
                      : "border-slate-100 bg-slate-50/50 hover:border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-600 text-lg text-white shadow-sm group-hover:scale-105 transition-transform">
                    💡
                  </div>
                  <span className="mt-2 block text-xs font-bold text-slate-800 leading-tight">
                    {locale === "ar" ? "تلميحات متتالية" : "Indices pas-à-pas"}
                  </span>
                  {mode === "correct" && (
                    <span className="absolute top-1.5 right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-indigo-600 text-[8px] font-bold text-white">
                      ✓
                    </span>
                  )}
                </button>

                {/* Mode Explication */}
                <button
                  type="button"
                  onClick={() => {
                    if (mode !== "explain") {
                      setMode("explain");
                      setGroups([]);
                      setError(null);
                    }
                  }}
                  className={`group relative flex flex-col items-center justify-center rounded-2xl border-2 p-3 text-center transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer ${
                    mode === "explain"
                      ? "border-amber-500 bg-amber-50/30 ring-4 ring-amber-50"
                      : "border-slate-100 bg-slate-50/50 hover:border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 text-lg text-white shadow-sm group-hover:scale-105 transition-transform">
                    📖
                  </div>
                  <span className="mt-2 block text-xs font-bold text-slate-800 leading-tight">
                    {locale === "ar" ? "شرح ورقتي" : "Vérifier ma copie"}
                  </span>
                  {mode === "explain" && (
                    <span className="absolute top-1.5 right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-amber-500 text-[8px] font-bold text-white">
                      ✓
                    </span>
                  )}
                </button>
              </div>

              {/* Subject & Chapter Selects */}
              <h2 className="mb-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                {locale === "ar" ? "2. المادة والدرس" : "2. Matière & Chapitre"}
              </h2>
              <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <SelectField
                  label={t.home.fieldSubject}
                  value={subjectId}
                  onChange={(id) => {
                    setSubjectId(id);
                    const s = SUBJECTS.find((x) => x.id === id)!;
                    setChapterId(s.chapters[0].id);
                  }}
                  options={SUBJECTS.map((s) => ({
                    value: s.id,
                    label: `${s.emoji} ${t.subjects[s.id as keyof typeof t.subjects] || s.name}`,
                  }))}
                />
                <SelectField
                  label={t.home.fieldChapter}
                  value={chapterId}
                  onChange={setChapterId}
                  options={subject.chapters.map((c) => ({
                    value: c.id,
                    label: t.chapters[c.id as keyof typeof t.chapters] || c.name,
                  }))}
                />
              </div>

              {/* Statement Input Box */}
              <h2 className="mb-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                {locale === "ar" ? "3. نص التمرين" : "3. Énoncé de l'exercice"}
              </h2>
              <div
                className={`rounded-2xl transition ${
                  dragOver ? "ring-4 ring-indigo-200 ring-offset-2" : ""
                }`}
                data-drop-target="exercise"
              >
                <div className="mb-1.5 flex items-center justify-between text-xs font-semibold text-slate-500">
                  <span>{t.home.fieldExercise}</span>
                  <span className={exercise.length > 0 ? "text-emerald-600 font-mono" : "text-slate-400 font-mono"}>
                    {t.home.exerciseLength
                      .replace("{count}", String(exercise.length))
                      .replace("{plural}", exercise.length > 1 ? "s" : "")}
                  </span>
                </div>
                <textarea
                  value={exercise}
                  onChange={(e) => setExercise(e.target.value)}
                  rows={4}
                  placeholder={t.home.exercisePlaceholder}
                  className="w-full resize-y rounded-2xl border border-slate-200 bg-slate-50 p-4 font-mono text-sm leading-relaxed text-slate-800 outline-none transition focus:border-indigo-400 focus:bg-white focus:ring-4 focus:ring-indigo-100"
                />

                {/* Photo buttons (énoncé) */}
                <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                  <PhotoButton
                    variant="primary"
                    multiple
                    onChange={(file) => handleFile(file)}
                  >
                    {t.home.btnChoosePhotos}
                  </PhotoButton>
                  <PhotoButton
                    variant="secondary"
                    capture
                    onChange={(file) => handleFile(file)}
                  >
                    {t.home.btnTakePhoto}
                  </PhotoButton>
                </div>
                <p className="mt-1.5 text-[10px] text-slate-500 font-medium">
                  {maxOcrCalls === 0 ? (
                    <>{t.home.msgInsufficientBalance.replace("{cost}", String(OCR_FLAT_COST_MRU))}</>
                  ) : (
                    <>{t.home.msgPendingPhotos.replace("{count}", String(remainingOcrCalls)).replace("{plural}", remainingOcrCalls > 1 ? "s" : "")}</>
                  )}
                </p>

                {pendingImages.length > 0 && (
                  <PendingImageList
                    previews={pendingImages}
                    loading={ocrLoading}
                    freeHintsRemaining={freeHintsRemaining}
                    onRemove={(i) =>
                      setPendingImages((p) => p.filter((_, idx) => idx !== i))
                    }
                    onClearAll={() => setPendingImages([])}
                    onExtract={() => extractPendingOcr("exercise")}
                    label="énoncé"
                    locale={locale}
                  />
                )}

                {(imagePreviews.length > 0 || ocrLoading) && (
                  <div className="mt-2">
                    <ImagePreviewList
                      previews={imagePreviews}
                      ocrLoading={ocrLoading && pendingImages.length === 0}
                      ocrUsage={ocrUsage}
                      onClear={() => {
                        setImagePreviews([]);
                        setOcrUsage(null);
                      }}
                      label="énoncé"
                      locale={locale}
                    />
                  </div>
                )}
              </div>

              {/* Explain Mode Correction input */}
              {mode === "explain" && (
                <div
                  className={`mt-5 rounded-2xl border-t border-slate-100 pt-4 transition ${
                    dragOver ? "ring-4 ring-amber-200 ring-offset-2" : ""
                  }`}
                  data-drop-target="correction"
                >
                  <h2 className="mb-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    {locale === "ar" ? "4. محاولتك / الحل المتوفر" : "4. Ta tentative de correction"}
                  </h2>
                  <div className="mb-1.5 flex items-center justify-between text-xs font-semibold text-slate-500">
                    <span>{t.home.fieldCorrection}</span>
                    <span className={correction.length > 0 ? "text-emerald-600 font-mono" : "text-slate-400 font-mono"}>
                      {t.home.exerciseLength
                        .replace("{count}", String(correction.length))
                        .replace("{plural}", correction.length > 1 ? "s" : "")}
                    </span>
                  </div>
                  <textarea
                    value={correction}
                    onChange={(e) => setCorrection(e.target.value)}
                    rows={4}
                    placeholder={t.home.correctionPlaceholder}
                    className="w-full resize-y rounded-2xl border border-slate-200 bg-slate-50 p-4 font-mono text-sm leading-relaxed text-slate-800 outline-none transition focus:border-amber-400 focus:bg-white focus:ring-4 focus:ring-amber-100"
                  />

                  <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                    <PhotoButton
                      variant="primary"
                      multiple
                      onChange={(file) => handleCorrectionFile(file)}
                    >
                      {t.home.btnChoosePhotosCorrection}
                    </PhotoButton>
                    <PhotoButton
                      variant="secondary"
                      capture
                      onChange={(file) => handleCorrectionFile(file)}
                    >
                      {t.home.btnTakePhotoCorrection}
                    </PhotoButton>
                  </div>

                  {pendingCorrectionImages.length > 0 && (
                    <PendingImageList
                      previews={pendingCorrectionImages}
                      loading={correctionOcrLoading}
                      freeHintsRemaining={Math.max(
                        0,
                        freeHintsRemaining - pendingImages.length,
                      )}
                      onRemove={(i) =>
                        setPendingCorrectionImages((p) =>
                          p.filter((_, idx) => idx !== i),
                        )
                      }
                      onClearAll={() => setPendingCorrectionImages([])}
                      onExtract={() => extractPendingOcr("correction")}
                      label="correction"
                      locale={locale}
                    />
                  )}

                  {(correctionImagePreviews.length > 0 || correctionOcrLoading) && (
                    <div className="mt-2">
                      <ImagePreviewList
                        previews={correctionImagePreviews}
                        ocrLoading={
                          correctionOcrLoading && pendingCorrectionImages.length === 0
                        }
                        ocrUsage={correctionOcrUsage}
                        onClear={() => {
                          setCorrectionImagePreviews([]);
                          setCorrectionOcrUsage(null);
                        }}
                        label="correction"
                        locale={locale}
                      />
                    </div>
                  )}
                </div>
              )}

              <p className="mt-2 text-[10px] text-slate-400 leading-normal">
                {t.home.tipIphone}
              </p>

              {/* Focus Question Area */}
              {canSubmit && (
                <div className="mt-4 border-t border-slate-100 pt-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                      {t.home.fieldFocus}
                      <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[9px] font-normal normal-case text-slate-500">
                        {t.home.focusOptional}
                      </span>
                    </span>
                  </div>

                  {subQuestions.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      <Chip
                        active={!focusQuestion.trim()}
                        onClick={() => {
                          setTreatAll(true);
                          setFocusQuestion("");
                        }}
                        badge={
                          groups.find((g) => g.focusKey === FOCUS_KEY_ALL)?.hints
                            .length
                        }
                      >
                        {subQuestions.length === 1
                          ? t.home.focusSingle
                          : t.home.focusAll}
                      </Chip>
                      {subQuestions.map((q) => {
                        const label = locale === "ar" ? `السؤال ${q}` : `Question ${q}`;
                        const active = focusQuestion.trim() === label;
                        const groupHits = groups.find((g) => g.focusKey === label)
                          ?.hints.length;
                        return (
                          <Chip
                            key={q}
                            active={active}
                            onClick={() => {
                              if (active) {
                                setTreatAll(true);
                                setFocusQuestion("");
                              } else {
                                setTreatAll(false);
                                setFocusQuestion(label);
                              }
                            }}
                            badge={groupHits}
                          >
                            {q}
                          </Chip>
                        );
                      })}
                    </div>
                  )}

                  <input
                    type="text"
                    value={focusQuestion}
                    onChange={(e) => {
                      const v = e.target.value;
                      setFocusQuestion(v);
                      setTreatAll(!v.trim());
                    }}
                    placeholder={
                      subQuestions.length > 0
                        ? (locale === "ar" ? "أو اكتب تفصيلاً حراً" : "Ou tape une précision libre")
                        : t.home.focusPlaceholder
                    }
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-800 outline-none transition focus:border-indigo-400 focus:bg-white focus:ring-4 focus:ring-indigo-100"
                  />
                </div>
              )}

              {/* Action Buttons & Progression */}
              <div className="mt-5 border-t border-slate-100 pt-4 space-y-3">
                
                {canSubmit && (
                  <div className="flex items-center gap-1.5 rounded-lg bg-slate-50 px-2.5 py-1 text-[10px] text-slate-600 w-fit font-medium">
                    <span>💰</span>
                    {freeHintsRemaining > 0 ? (
                      <>{t.home.hintCostFree.replace("{count}", String(freeHintsRemaining)).replace("{plural}", freeHintsRemaining > 1 ? "s" : "")}</>
                    ) : (
                      <>{t.home.hintCostPaid.replace("{cost}", String(MIN_HINT_BALANCE_MRU))}</>
                    )}
                  </div>
                )}

                {(() => {
                  const fanOutMode =
                    mode === "correct" && treatAll && subQuestions.length >= 2;
                  const explainMode = mode === "explain";
                  const correctionReady = correction.trim().length >= 3;
                  return (
                    <div className="flex flex-wrap items-stretch gap-2">
                      {explainMode ? (
                        <button
                          onClick={() => askHint(3)}
                          disabled={
                            loading ||
                            ocrLoading ||
                            correctionOcrLoading ||
                            !canSubmit ||
                            !correctionReady
                          }
                          className="group inline-flex flex-1 items-center justify-center gap-2 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 px-4 py-3 text-sm font-semibold text-white shadow-md transition hover:scale-[1.01] active:scale-[0.99] cursor-pointer disabled:cursor-not-allowed disabled:from-slate-300 disabled:to-slate-300 disabled:shadow-none"
                        >
                          {loading ? (
                            <><Spinner /> {locale === "ar" ? "جاري قراءة التصحيح..." : "Lecture..."}</>
                          ) : (
                            <>
                              <span className="text-base">📖</span>
                              <span>{t.home.btnExplainCorrection}</span>
                            </>
                          )}
                        </button>
                      ) : fanOutMode ? (
                        <button
                          onClick={() => askAllQuestions()}
                          disabled={loading || ocrLoading || !canSubmit}
                          className="group inline-flex flex-1 items-center justify-center gap-2 rounded-2xl bg-gradient-to-br from-indigo-600 to-emerald-600 px-4 py-3 text-sm font-semibold text-white shadow-md transition hover:scale-[1.01] active:scale-[0.99] cursor-pointer disabled:cursor-not-allowed disabled:from-slate-300 disabled:to-slate-300 disabled:shadow-none"
                        >
                          {loading ? (
                            <>
                              <Spinner />
                              {fanProgress ? (
                                <span>{locale === "ar" ? "السؤال" : "Question"} {fanProgress.label} ({fanProgress.current}/{fanProgress.total})</span>
                              ) : (
                                <span>{t.common.loading}</span>
                              )}
                            </>
                          ) : (
                            <>
                              <span className="text-base">✦</span>
                              <span>{t.home.btnCorrectAll.replace("{count}", String(subQuestions.length))}</span>
                            </>
                          )}
                        </button>
                      ) : (
                        <>
                          <button
                            onClick={() => askHint()}
                            disabled={loading || ocrLoading || !canAskMore || !canSubmit}
                            className="group inline-flex flex-1 items-center justify-center gap-2 rounded-2xl bg-gradient-to-br from-indigo-600 to-emerald-600 px-4 py-3 text-sm font-semibold text-white shadow-md transition hover:scale-[1.01] active:scale-[0.99] cursor-pointer disabled:cursor-not-allowed disabled:from-slate-300 disabled:to-slate-300 disabled:shadow-none"
                          >
                            {loading ? (
                              <><Spinner /> {t.common.loading}</>
                            ) : nextLevel ? (
                              <>
                                <span className="text-base">{levelLabels[nextLevel].icon}</span>
                                <span>{levelButtons[nextLevel]}</span>
                              </>
                            ) : (
                              t.home.btnLevelCompleted
                            )}
                          </button>

                          {!hasSolution && canSubmit && nextLevel !== 3 && (
                            <button
                              onClick={() => askHint(3)}
                              disabled={loading || ocrLoading}
                              title={locale === "ar" ? "انتقل مباشرة إلى التصحيح الكامل" : "Saute directement à la correction complète"}
                              className="inline-flex items-center justify-center gap-1.5 rounded-2xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800 transition hover:bg-emerald-100 active:scale-[0.98] cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              {locale === "ar" ? "✅ الحل المباشر" : "✅ Solution directe"}
                            </button>
                          )}
                        </>
                      )}

                      {(groups.length > 0 || exercise) && (
                        <button
                          onClick={fullReset}
                          disabled={loading}
                          className="rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm font-medium text-slate-600 transition hover:bg-slate-50 active:scale-[0.98] cursor-pointer disabled:opacity-50"
                        >
                          {locale === "ar" ? "↻ جديد" : "↻ Nouveau"}
                        </button>
                      )}
                    </div>
                  );
                })()}

                {/* Progression Bar */}
                {canSubmit && mode === "correct" && (
                  <div className="mt-3 flex items-center gap-2">
                    {([1, 2, 3] as const).map((lvl) => (
                      <div
                        key={lvl}
                        className={`h-1.5 flex-1 rounded-full transition-all ${
                          generatedLevels.has(lvl)
                            ? `bg-gradient-to-r ${levelLabels[lvl].color}`
                            : "bg-slate-100"
                        }`}
                      />
                    ))}
                  </div>
                )}

              </div>

              {error && (
                <div className="mt-4 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                  <span>⚠️</span>
                  <span>{error}</span>
                </div>
              )}

            </section>

          </div>

          {/* Column 2: Resolution Space & Progressive Hints Rendering (Right Side, 2/3 width) */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* Case A: Empty Workspace -> ShowGuided Visual Onboarding */}
            {groups.length === 0 && (
              <div className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-xl shadow-slate-200/50 sm:p-10">
                {locale === "ar" ? (
                  <div className="space-y-8">
                    <div className="text-center">
                      <div className="inline-flex h-16 w-16 items-center justify-center rounded-3xl bg-indigo-50 text-3xl shadow-inner">
                        💡
                      </div>
                      <h2 className="mt-4 text-2xl font-black text-slate-800">كيف يعمل تطبيق "Débloque-moi" ؟</h2>
                      <p className="mt-2 text-sm text-slate-500 max-w-lg mx-auto leading-relaxed">
                        مساعدك الشخصي الذكي لحل تمارين الرياضيات والفيزياء والكيمياء وفقًا لبرنامج الباكالوريا الموريتاني، لمساعدتك على الفهم والتعلم الذاتي.
                      </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      
                      <div className="rounded-2xl border border-slate-100 bg-indigo-50/20 p-5 transition hover:scale-[1.01]">
                        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-500 text-white font-bold text-sm shadow-sm">
                          ١
                        </div>
                        <h3 className="mt-3 text-sm font-bold text-slate-800">اختر المادة والدرس</h3>
                        <p className="mt-1.5 text-xs leading-relaxed text-slate-500">
                          حدد تخصصك والدرس المطلوب لكي تتطابق المساعدات والتلميحات بدقة مع المنهج الدراسي للباكالوريا.
                        </p>
                      </div>

                      <div className="rounded-2xl border border-slate-100 bg-sky-50/20 p-5 transition hover:scale-[1.01]">
                        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-sky-500 text-white font-bold text-sm shadow-sm">
                          ٢
                        </div>
                        <h3 className="mt-3 text-sm font-bold text-slate-800">أدخل نص التمرين أو صورته</h3>
                        <p className="mt-1.5 text-xs leading-relaxed text-slate-500">
                          اكتب نص التمرين أو التقط صورة لورقتك. سيقوم الذكاء الاصطناعي بنسخ النص تلقائياً للبدء فوراً.
                        </p>
                      </div>

                      <div className="rounded-2xl border border-slate-100 bg-amber-50/20 p-5 transition hover:scale-[1.01]">
                        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-500 text-white font-bold text-sm shadow-sm">
                          ٣
                        </div>
                        <h3 className="mt-3 text-sm font-bold text-slate-800">حدد وضع العمل</h3>
                        <p className="mt-1.5 text-xs leading-relaxed text-slate-500 flex flex-col gap-1">
                          <span>• <strong>تلميحات متتالية</strong> : للحصول على مساعدة خطوة بخطوة.</span>
                          <span>• <strong>شرح ورقتي</strong> : لتدقيق وتصحيح محاولتك في الحل.</span>
                        </p>
                      </div>

                      <div className="rounded-2xl border border-slate-100 bg-emerald-50/20 p-5 transition hover:scale-[1.01]">
                        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500 text-white font-bold text-sm shadow-sm">
                          ٤
                        </div>
                        <h3 className="mt-3 text-sm font-bold text-slate-800">احصل على المساعدة</h3>
                        <p className="mt-1.5 text-xs leading-relaxed text-slate-500">
                          انقر على الأزرار لطلب تلميحات تدريجية. لن نعطيك الإجابة مباشرة لكي نساعدك على التفكير السليم والتطور الذاتي !
                        </p>
                      </div>

                    </div>
                  </div>
                ) : (
                  <div className="space-y-8">
                    <div className="text-center">
                      <div className="inline-flex h-16 w-16 items-center justify-center rounded-3xl bg-indigo-50 text-3xl shadow-inner">
                        💡
                      </div>
                      <h2 className="mt-4 text-2xl font-black text-slate-800">Comment fonctionne Débloque-moi ?</h2>
                      <p className="mt-2 text-sm text-slate-500 max-w-lg mx-auto">
                        Ton assistant personnel intelligent pour résoudre les exercices de Math, Physique & Chimie en Mauritanie. On t'aide à comprendre, on ne triche pas à ta place.
                      </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      
                      <div className="rounded-2xl border border-slate-100 bg-indigo-50/20 p-5 transition hover:scale-[1.01]">
                        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-500 text-white font-bold text-sm shadow-sm">
                          1
                        </div>
                        <h3 className="mt-3 text-sm font-bold text-slate-800">Matière & Chapitre</h3>
                        <p className="mt-1.5 text-xs leading-relaxed text-slate-500">
                          Configure ta matière et le cours correspondant pour aligner les indices et méthodes sur le programme officiel mauritanien.
                        </p>
                      </div>

                      <div className="rounded-2xl border border-slate-100 bg-sky-50/20 p-5 transition hover:scale-[1.01]">
                        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-sky-500 text-white font-bold text-sm shadow-sm">
                          2
                        </div>
                        <h3 className="mt-3 text-sm font-bold text-slate-800">Énoncé en photo ou texte</h3>
                        <p className="mt-1.5 text-xs leading-relaxed text-slate-500">
                          Saisis le texte ou prends une photo nette de ton cahier/feuille. Notre IA extrait l'énoncé en quelques secondes.
                        </p>
                      </div>

                      <div className="rounded-2xl border border-slate-100 bg-amber-50/20 p-5 transition hover:scale-[1.01]">
                        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-500 text-white font-bold text-sm shadow-sm">
                          3
                        </div>
                        <h3 className="mt-3 text-sm font-bold text-slate-800">Choisis ta méthode</h3>
                        <p className="mt-1.5 text-xs leading-relaxed text-slate-500 flex flex-col gap-1">
                          <span>• <strong>Indices pas-à-pas</strong> : pour réfléchir par étapes.</span>
                          <span>• <strong>Vérifier ma copie</strong> : pour analyser ton propre brouillon et repérer tes erreurs.</span>
                        </p>
                      </div>

                      <div className="rounded-2xl border border-slate-100 bg-emerald-50/20 p-5 transition hover:scale-[1.01]">
                        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500 text-white font-bold text-sm shadow-sm">
                          4
                        </div>
                        <h3 className="mt-3 text-sm font-bold text-slate-800">Progresse intelligemment</h3>
                        <p className="mt-1.5 text-xs leading-relaxed text-slate-500">
                          Débloque les indices un à un. Nous ne donnons pas la réponse finale tout de suite pour te forcer à progresser de façon autonome !
                        </p>
                      </div>

                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Case B: Render Thread of Generated Corrections / Hints */}
            {groups.length > 0 && (
              <div className="space-y-6">
                
                {/* Hints Timeline */}
                <div className="space-y-6">
                  {groups.map((group, gi) => (
                    <article
                      key={group.focusKey}
                      ref={gi === groups.length - 1 ? lastGroupRef : null}
                      className="animate-in space-y-3"
                    >
                      <header className="flex items-center justify-between gap-2 px-1">
                        <h3
                          className={`flex items-center gap-2 text-xs font-bold uppercase tracking-wider ${
                            group.focusKey === currentKey
                              ? "text-indigo-700 font-extrabold"
                              : "text-slate-500"
                          }`}
                        >
                          {group.focusKey === currentKey && (
                            <span
                              className="inline-block h-2.5 w-2.5 rounded-full bg-indigo-600 animate-pulse"
                              aria-label="actif"
                            />
                          )}
                          {group.focusLabel}
                        </h3>
                        <button
                          onClick={() => removeGroup(group.focusKey)}
                          className="rounded-full px-2 py-1 text-[10px] font-bold text-slate-400 hover:bg-slate-100 hover:text-slate-700 cursor-pointer"
                          title={locale === "ar" ? "حذف هذا التصحيح" : "Supprimer cette correction"}
                        >
                          ✕
                        </button>
                      </header>
                      
                      <div className="space-y-4">
                        {group.hints.map((h) => {
                          const isExplain = h.mode === "explain";
                          const color = isExplain
                            ? "from-amber-500 to-orange-600"
                            : levelLabels[h.level].color;
                          const icon = isExplain ? "📖" : levelLabels[h.level].icon;
                          const title = isExplain
                            ? (locale === "ar" ? "شرح وتصحيح محاولتك" : "Explication de ta correction")
                            : (locale === "ar"
                                ? `التلميح ${h.level} من 3 — ${levelLabels[h.level].title}`
                                : `Indice ${h.level} sur 3 — ${levelLabels[h.level].title}`);
                          return (
                            <div
                              key={h.level}
                              className="overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-lg shadow-slate-200/40 transition hover:shadow-xl"
                            >
                              <div
                                className={`flex items-center justify-between gap-2 bg-gradient-to-r ${color} px-5 py-3.5 text-white`}
                              >
                                <div className="flex items-center gap-2">
                                  <span className="text-xl">{icon}</span>
                                  <span className="text-xs font-black uppercase tracking-wider">
                                    {title}
                                  </span>
                                </div>
                                {h.usage && <UsageBadge usage={h.usage} variant="light" />}
                              </div>
                              <div className="px-5 py-5 text-[15px] leading-relaxed text-slate-800 sm:px-6 sm:py-6 prose max-w-none">
                                <MathText text={h.text} />
                                {h.similarExam && (
                                  <p className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-indigo-50 px-3 py-1 text-[11px] font-semibold text-indigo-700 ring-1 ring-indigo-200">
                                    <span aria-hidden>💡</span>
                                    <span>{locale === "ar" ? `مشابه لـ : ${h.similarExam}` : `Similaire à : ${h.similarExam}`}</span>
                                  </p>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </article>
                  ))}
                </div>

                {/* Session Cost Recap Box */}
                {totalMRU > 0 && (
                  <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-lg shadow-slate-200/40">
                    <div className="mb-3 flex items-center justify-between">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                        {locale === "ar" ? "💸 التكلفة الإجمالية لهذا التمرين" : "💸 Coût total de cet exercice"}
                      </h3>
                      <div className="font-mono text-base font-black text-indigo-700">
                        {formatMRU(totalMRU)} {t.common.mru}
                      </div>
                    </div>
                    <ul className="divide-y divide-slate-100 text-xs text-slate-600">
                      {ocrUsage && (
                        <UsageRow label={locale === "ar" ? "📸 قراءة الصورة (OCR)" : "📸 Lecture photo (OCR)"} usage={ocrUsage} />
                      )}
                      {groups.map((g) =>
                        g.hints.map((h) =>
                          h.usage ? (
                            <UsageRow
                              key={`${g.focusKey}-${h.level}`}
                              label={`${levelLabels[h.level].icon} ${g.focusLabel} — ${levelLabels[h.level].title}`}
                              usage={h.usage}
                            />
                          ) : null,
                        ),
                      )}
                    </ul>
                  </section>
                )}

              </div>
            )}

          </div>

        </div>

        {/* Footer info */}
        <footer className="mt-16 pb-8 text-center text-xs text-slate-400">
          {locale === "ar" ? (
            <>
              موقع مخصص للتحضير للباكالوريا في موريتانيا · تلميح: يمكنك{" "}
              <kbd className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] border border-slate-200 shadow-sm">
                سحب
              </kbd>{" "}
              أو{" "}
              <kbd className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] border border-slate-200 shadow-sm">
                لصق
              </kbd>{" "}
              صورة في أي مكان.
            </>
          ) : (
            <>
              Plateforme de préparation au Bac Mauritanie · Astuce : tu peux{" "}
              <kbd className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] border border-slate-200 shadow-sm">
                glisser
              </kbd>{" "}
              ou{" "}
              <kbd className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] border border-slate-200 shadow-sm">
                coller
              </kbd>{" "}
              une photo n&apos;importe où pour la transcrire.
            </>
          )}
        </footer>

      </main>
    </div>
  );
}

/* ---------- Sub-components ---------- */

function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <label className="flex flex-col">
      <span className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm font-medium text-slate-800 outline-none transition focus:border-indigo-400 focus:bg-white focus:ring-4 focus:ring-indigo-100"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function ModeTab({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{ touchAction: "manipulation" }}
      className={`min-h-[44px] flex-1 rounded-xl px-3 py-2 text-xs font-semibold transition sm:text-sm ${
        active
          ? "bg-white text-slate-900 shadow-sm ring-1 ring-slate-200"
          : "text-slate-500 active:bg-slate-200 hover:text-slate-900"
      }`}
    >
      {children}
    </button>
  );
}

function Chip({
  active,
  onClick,
  badge,
  children,
}: {
  active: boolean;
  onClick: () => void;
  badge?: number;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium transition active:scale-95 ${
        active
          ? "bg-indigo-600 text-white shadow shadow-indigo-200"
          : "bg-slate-100 text-slate-700 hover:bg-slate-200"
      }`}
    >
      {children}
      {badge !== undefined && badge > 0 && (
        <span
          className={`inline-flex h-4 min-w-[16px] items-center justify-center rounded-full px-1 text-[9px] font-bold mx-0.5 ${
            active ? "bg-white/30 text-white" : "bg-emerald-500 text-white"
          }`}
          title={`${badge} correction${badge > 1 ? "s" : ""} disponible${badge > 1 ? "s" : ""}`}
        >
          {badge}
        </span>
      )}
    </button>
  );
}

function PhotoButton({
  variant,
  capture,
  multiple = false,
  onChange,
  children,
}: {
  variant: "primary" | "secondary";
  capture?: boolean;
  multiple?: boolean;
  onChange: (file: File) => Promise<void> | void;
  children: React.ReactNode;
}) {
  const cls =
    variant === "primary"
      ? "bg-indigo-600 text-white shadow active:bg-indigo-700"
      : "border border-slate-300 bg-white text-slate-700 shadow-sm active:bg-slate-100";
  return (
    <label
      style={{ touchAction: "manipulation", WebkitTapHighlightColor: "transparent" }}
      className={`relative inline-flex min-h-[52px] flex-1 cursor-pointer items-center justify-center gap-2 rounded-2xl px-5 py-3 text-sm font-semibold transition active:scale-[0.98] ${cls}`}
    >
      <span className="pointer-events-none">{children}</span>
      <input
        type="file"
        accept="image/*"
        multiple={multiple && !capture}
        {...(capture ? { capture: "environment" } : {})}
        className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
        onChange={async (e) => {
          const files = Array.from(e.target.files ?? []);
          e.target.value = "";
          for (const f of files) await onChange(f);
        }}
      />
    </label>
  );
}

function PendingImageList({
  previews,
  loading,
  freeHintsRemaining,
  onRemove,
  onClearAll,
  onExtract,
  label,
  locale,
}: {
  previews: string[];
  loading: boolean;
  freeHintsRemaining: number;
  onRemove: (index: number) => void;
  onClearAll: () => void;
  onExtract: () => void;
  label: string;
  locale: string;
}) {
  const count = previews.length;
  if (count === 0) return null;
  // Combien de photos pourront utiliser un free hint vs MRU :
  const willUseFree = Math.min(count, freeHintsRemaining);
  const willUseMru = count - willUseFree;
  const mruCost = willUseMru * OCR_FLAT_COST_MRU;
  let costSummary: string;
  if (willUseFree > 0 && willUseMru > 0) {
    costSummary = locale === "ar"
      ? `${willUseFree} مجانية + ${mruCost} أوقية`
      : `${willUseFree} gratuite${willUseFree > 1 ? "s" : ""} + ${mruCost} MRU`;
  } else if (willUseFree > 0) {
    costSummary = locale === "ar"
      ? `${willUseFree} مجانية`
      : `${willUseFree} gratuite${willUseFree > 1 ? "s" : ""}`;
  } else {
    costSummary = locale === "ar"
      ? `${mruCost} أوقية`
      : `${mruCost} MRU`;
  }
  return (
    <div className="mt-3 space-y-2 rounded-2xl border border-amber-200 bg-amber-50/60 p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-amber-700">
          {locale === "ar" ? (
            `⏳ ${count} صورة في الانتظار (${label === "énoncé" ? "نص التمرين" : "التصحيح"})`
          ) : (
            `⏳ ${count} photo${count > 1 ? "s" : ""} ${label} en attente`
          )}
        </span>
        <button
          type="button"
          onClick={onClearAll}
          disabled={loading}
          className="text-[11px] font-medium text-slate-500 underline-offset-2 hover:underline disabled:opacity-50"
        >
          {locale === "ar" ? "إزالة الكل" : "tout retirer"}
        </button>
      </div>
      <div className="flex gap-1.5 overflow-x-auto py-1">
        {previews.map((src, i) => (
          <div
            key={i}
            className="relative h-20 w-20 flex-shrink-0 overflow-hidden rounded-lg border border-amber-300 bg-white"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={src}
              alt={`${label} ${i + 1}`}
              className="h-full w-full object-cover"
            />
            <button
              type="button"
              onClick={() => onRemove(i)}
              disabled={loading}
              aria-label={locale === "ar" ? `إزالة الصورة ${i + 1}` : `Retirer la photo ${i + 1}`}
              className="absolute right-0.5 top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-black/70 text-[11px] font-bold text-white hover:bg-black disabled:opacity-50"
            >
              ✕
            </button>
            <span className="absolute bottom-0.5 left-0.5 rounded bg-black/60 px-1 text-[10px] font-bold text-white">
              {i + 1}
            </span>
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={onExtract}
        disabled={loading}
        className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-amber-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-amber-700 disabled:opacity-50"
      >
        {loading ? (
          <>
            <Spinner /> {locale === "ar" ? "جاري النسخ..." : "Transcription…"}
          </>
        ) : (
          <>{locale === "ar" ? `📝 استخراج النص — ${costSummary}` : `📝 Extraire le texte — ${costSummary}`}</>
        )}
      </button>
      <p className="text-[10px] text-amber-700/80 font-medium">
        {locale === "ar" ? (
          `تقدير ${OCR_FLAT_COST_MRU} أوقية لكل صورة (الحد الأدنى المطلوب). سيتم خصم التكلفة الحقيقية للذكاء الاصطناعي فقط في النهاية.`
        ) : (
          `Estimation de ${OCR_FLAT_COST_MRU} MRU par photo (seuil requis). Seul le coût réel de l'IA (avec marge) est facturé à la fin.`
        )}
      </p>
    </div>
  );
}

function ImagePreviewList({
  previews,
  ocrLoading,
  ocrUsage,
  onClear,
  label,
  locale,
}: {
  previews: string[];
  ocrLoading: boolean;
  ocrUsage: Usage | null;
  onClear: () => void;
  label: string;
  locale: string;
}) {
  const count = previews.length;
  return (
    <div className="space-y-2">
      {count > 0 && (
        <div className="flex items-center justify-between gap-2">
          <div className="flex gap-1.5 overflow-x-auto py-1">
            {previews.map((src, i) => (
              <div
                key={i}
                className="relative h-20 w-20 flex-shrink-0 overflow-hidden rounded-lg border border-slate-200 bg-slate-50"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={src}
                  alt={`${label} ${i + 1}`}
                  className="h-full w-full object-cover"
                />
                <span className="absolute bottom-0.5 right-0.5 rounded bg-black/60 px-1 text-[10px] font-bold text-white">
                  {i + 1}
                </span>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={onClear}
            className="flex-shrink-0 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm hover:bg-slate-50"
          >
            {locale === "ar" ? "✕ إزالة الكل" : "✕ Retirer tout"}
          </button>
        </div>
      )}
      {ocrLoading && (
        <div className="flex items-center gap-2 rounded-xl bg-indigo-50 p-3 text-sm text-indigo-700">
          <Spinner /> {locale === "ar" ? "جاري القراءة..." : "Lecture en cours..."}
        </div>
      )}
      {!ocrLoading && ocrUsage && count > 0 && (
        <div className="flex items-center justify-between gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
          <span className="font-semibold uppercase tracking-wide">
            {locale === "ar" ? (
              `✓ تم نسخ ${count} صورة`
            ) : (
              `✓ ${count} photo${count > 1 ? "s" : ""} transcrite${count > 1 ? "s" : ""}`
            )}
          </span>
          <UsageBadge usage={ocrUsage} variant="dark" />
        </div>
      )}
    </div>
  );
}

function Spinner() {
  return (
    <span
      className="spinner inline-block h-4 w-4 rounded-full border-2 border-current border-r-transparent"
      aria-hidden
    />
  );
}

function UsageBadge({
  usage,
  variant,
}: {
  usage: Usage;
  variant: "light" | "dark";
}) {
  const cls =
    variant === "light"
      ? "bg-white/25 text-white ring-white/40"
      : "bg-emerald-100 text-emerald-800 ring-emerald-200";
  const cost = costFor(usage.model, usage.prompt, usage.completion);
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-mono text-[10px] font-semibold ring-1 ring-inset ${cls}`}
    >
      💸 {formatMRU(cost.mru)} MRU
    </span>
  );
}

function UsageRow({ label, usage }: { label: string; usage: Usage }) {
  const cost = costFor(usage.model, usage.prompt, usage.completion);
  return (
    <li className="flex items-center justify-between gap-3 py-2">
      <span className="truncate text-slate-700">{label}</span>
      <span className="min-w-[80px] text-right font-mono text-[12px] font-bold text-indigo-700">
        {formatMRU(cost.mru)} MRU
      </span>
    </li>
  );
}

// Détecte les marqueurs de sous-questions (1°, 2° a), b), Question 3...).
// - Normalise la sortie OCR LaTeX (^\circ, \circ, \degree) en ° littéral.
// - Évite les faux positifs comme "(1)" en exigeant le symbole °.
function detectSubQuestions(text: string): string[] {
  if (!text) return [];

  const norm = text
    .replace(/\^\s*\\?circ/g, "°")
    .replace(/\\degree/g, "°")
    .replace(/º/g, "°");

  type Hit = { type: "num" | "sub" | "q"; value: string; pos: number };
  const hits: Hit[] = [];

  // Préfixes Markdown acceptés en début de ligne avant le marqueur de question :
  // - `#` titres (## 1., ### 2., etc.)
  // - `*`/`_` gras (**1.** , __1__)
  // - `>` blockquote
  // - puces (`-`, `•`)
  // - espaces
  const MD = `[\\s#*_>\\-•]*`;

  // NB: toutes les regex utilisent le flag `u` (Unicode) pour reconnaître
  // les lettres accentuées (É, È, Œ, Ç, etc.) via la classe \p{L}.

  // Style "1°" (Bac C classique). Peut apparaître après marqueurs MD ou
  // mid-texte après un non-mot.
  for (const m of norm.matchAll(
    new RegExp(`(?:^|\\n|[^\\w])${MD}(\\d{1,2})\\s*°`, "gu"),
  )) {
    hits.push({ type: "num", value: `${m[1]}°`, pos: m.index ?? 0 });
  }
  // Style "1." en début de ligne (avec marqueurs MD optionnels), suivi d'espace
  // + n'importe quelle lettre Unicode (couvre É, È, Œ, Ç, Î, etc.) ou `(`.
  for (const m of norm.matchAll(
    new RegExp(`(?:^|\\n)${MD}(\\d{1,2})\\.\\s+(?=[\\p{L}(])`, "gu"),
  )) {
    hits.push({ type: "num", value: `${m[1]}.`, pos: m.index ?? 0 });
  }
  // Style "1)" en début de ligne (avec marqueurs MD), pas précédé de "(".
  for (const m of norm.matchAll(
    new RegExp(`(?:^|\\n)${MD}(?<!\\()(\\d{1,2})\\)\\s+(?=\\p{L})`, "gu"),
  )) {
    hits.push({ type: "num", value: `${m[1]})`, pos: m.index ?? 0 });
  }
  // Sous-lettre "a)" suivie d'une majuscule Unicode (ou guillemet français).
  for (const m of norm.matchAll(
    /(?:^|[^\w°])([a-z])\s*\)(?=\s*[\p{Lu}«])/gu,
  )) {
    hits.push({ type: "sub", value: `${m[1]})`, pos: m.index ?? 0 });
  }
  // "Question N" avec lettre optionnelle.
  for (const m of norm.matchAll(/(?:^|[^\w])Question\s+(\d+[a-z]?)/giu)) {
    hits.push({ type: "q", value: `Question ${m[1]}`, pos: m.index ?? 0 });
  }
  // Style "N-M" ou "N.M" (sous-numérotation par tiret ou point : 2-1, 3.1...).
  // Très utilisé dans les sujets de physique-chimie du Bac. On accepte aussi
  // les espaces autour du séparateur (3 - 1, 3 .1) et les démarrages mid-ligne
  // après une ponctuation de phrase.
  for (const m of norm.matchAll(
    new RegExp(
      `(?:^|\\n|(?<=[.;)])\\s+)${MD}(\\d{1,2}\\s*[-‑–.]\\s*(?:\\d{1,2}|[a-z]))\\s+(?=\\p{L})`,
      "gu",
    ),
  )) {
    // Normalise : enlève les espaces internes pour avoir "3-1" propre.
    const value = m[1].replace(/\s+/g, "");
    hits.push({ type: "q", value, pos: m.index ?? 0 });
  }
  // Style "N " (chiffre seul + espace + majuscule, sans ponctuation).
  // Pour les sujets où "1 Ecrire ...", "2 Tracer ..." apparaissent en début
  // de ligne. Plus risqué : on exige une majuscule juste après pour éviter
  // de prendre "il y a 5 espèces..." comme un marqueur.
  for (const m of norm.matchAll(
    new RegExp(`(?:^|\\n)${MD}(\\d{1,2})\\s+(?=\\p{Lu})`, "gu"),
  )) {
    // On crée des marqueurs "N°" qui s'agrègent comme les autres.
    hits.push({ type: "num", value: `${m[1]}`, pos: m.index ?? 0 });
  }

  hits.sort((a, b) => a.pos - b.pos);

  let currentSection: string | null = null;
  const results: string[] = [];
  const sectionsWithChildren = new Set<string>();

  for (const h of hits) {
    if (h.type === "num") {
      currentSection = h.value;
      results.push(currentSection);
    } else if (h.type === "sub") {
      const label = currentSection ? `${currentSection} ${h.value}` : h.value;
      if (currentSection) sectionsWithChildren.add(currentSection);
      results.push(label);
    } else {
      // type "q" — peut être "Question N", "N-M" ou "N.M".
      // Si c'est sous-numérotation, on marque le parent comme ayant des enfants.
      const parent = /^(\d{1,2})[-‑–.]/.exec(h.value);
      if (parent) {
        // Le parent peut exister sous différents formats : "3", "3.", "3°"
        sectionsWithChildren.add(parent[1]);
        sectionsWithChildren.add(`${parent[1]}.`);
        sectionsWithChildren.add(`${parent[1]}°`);
        sectionsWithChildren.add(`${parent[1]})`);
      }
      currentSection = null;
      results.push(h.value);
    }
  }

  const seen = new Set<string>();
  return results.filter((r) => {
    if (sectionsWithChildren.has(r)) return false;
    if (seen.has(r)) return false;
    seen.add(r);
    return true;
  });
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
