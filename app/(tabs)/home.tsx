import { useCallback, useMemo, useState } from "react";
import { useFocusEffect } from "expo-router";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import { api, ApiError } from "@/lib/api";
import { useSession } from "@/lib/useSession";
import { MathMarkdown } from "@/components/MathMarkdown";
import { SUBJECTS, getSubject, type Chapter, type Subject } from "@/lib/subjects";
import { takePending } from "@/lib/exerciseStore";
import { detectSubQuestions } from "@/lib/subQuestions";
import {
  makeSessionId,
  upsertSession,
  type SavedSession,
} from "@/lib/history";
import { takePendingSession } from "@/lib/historyStore";
import { useTranslation } from "@/lib/i18n";

type HintLevel = 1 | 2 | 3;

type HintResponse = {
  hint: string;
  level: HintLevel;
  balance_mru?: number;
  free_hint_used?: boolean;
  free_hints_remaining?: number;
  truncated?: boolean;
  mode?: "correct" | "explain";
  // Le backend renvoie une string (ex. "Bac C 2023") ou null — cf. bestExamRef
  // côté web (app/src/lib/rag.ts).
  similar_exam?: string | null;
};

type OcrResponse = { text: string; balance_mru?: number };

type Mode = "hint" | "explain";

type ReceivedHint = {
  level: HintLevel;
  text: string;
  mode: Mode;
  free_hint_used?: boolean;
  balance_mru?: number;
  truncated?: boolean;
  similar_exam?: string | null;
  // Présent quand la correction provient du « fan-out » multi-questions.
  label?: string;
};

export default function Home() {
  const { user, refresh } = useSession();
  const { t, locale } = useTranslation();
  const ar = locale === "ar";
  const [exercise, setExercise] = useState("");
  // Affichage du champ énoncé : "edit" (TextInput brut, corrigeable) ou
  // "preview" (rendu LaTeX lisible via MathMarkdown). On bascule sur "preview"
  // après un OCR / un rechargement, et sur "edit" dès que l'élève tape.
  const [exerciseView, setExerciseView] = useState<"edit" | "preview">("edit");
  // Idem pour le champ correction (mode « Expliquer »).
  const [correctionView, setCorrectionView] = useState<"edit" | "preview">("edit");
  const [subject, setSubject] = useState<Subject>(SUBJECTS[0]);
  const [chapter, setChapter] = useState<Chapter | null>(null);
  const [focusQuestion, setFocusQuestion] = useState("");
  const [correction, setCorrection] = useState("");
  const [mode, setMode] = useState<Mode>("hint");
  const [hints, setHints] = useState<ReceivedHint[]>([]);
  const [loading, setLoading] = useState(false);
  // Progression du « fan-out » (une correction complète par sous-question).
  const [fanProgress, setFanProgress] = useState<{
    current: number;
    total: number;
    label: string;
  } | null>(null);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [chapterPickerOpen, setChapterPickerOpen] = useState(false);
  const [sessionId, setSessionId] = useState<string>(() => makeSessionId());

  // Prend en compte un exercice sélectionné depuis la Banque OU une session
  // historique à recharger.
  useFocusEffect(
    useCallback(() => {
      // 1) Session historique prioritaire (le user a cliqué sur l'historique)
      const restored = takePendingSession();
      if (restored) {
        setSessionId(restored.id);
        setExercise(restored.exercise);
        setExerciseView(restored.exercise.trim() ? "preview" : "edit");
        setCorrection(restored.correction ?? "");
        setCorrectionView((restored.correction ?? "").trim() ? "preview" : "edit");
        setFocusQuestion(restored.focusQuestion);
        setMode(restored.mode);
        setHints(
          restored.hints.map((h) => ({
            level: h.level,
            text: h.text,
            mode: h.mode,
            free_hint_used: h.free_hint_used,
            balance_mru: h.balance_mru,
            truncated: h.truncated,
            similar_exam: h.similar_exam ?? null,
            label: h.label,
          })),
        );
        const s = getSubject(restored.subjectId);
        if (s) {
          setSubject(s);
          setChapter(
            restored.chapterId
              ? s.chapters.find((c) => c.id === restored.chapterId) ?? null
              : null,
          );
        }
        return;
      }
      // 2) Exercice depuis la Banque
      const p = takePending();
      if (!p) return;
      setSessionId(makeSessionId());
      setExercise(p.exercise);
      setExerciseView(p.exercise.trim() ? "preview" : "edit");
      setHints([]);
      setFocusQuestion("");
      setCorrection("");
      if (p.subjectId) {
        const s = getSubject(p.subjectId);
        if (s) {
          setSubject(s);
          setChapter(null);
        }
      }
    }, []),
  );

  // Détection auto des sous-questions (1, 2.a, 3-1, Question 4, etc.)
  // Logique identique au web (cf. lib/subQuestions.ts).
  const subQuestions = useMemo(
    () => detectSubQuestions(exercise),
    [exercise],
  );

  const nextLevel: HintLevel = useMemo(() => {
    if (mode === "explain") return 1;
    const last = hints.at(-1);
    if (!last) return 1;
    return last.level >= 3 ? 3 : ((last.level + 1) as HintLevel);
  }, [hints, mode]);

  function resetThread() {
    setHints([]);
    setSessionId(makeSessionId());
  }

  function changeSubject(s: Subject) {
    setSubject(s);
    setChapter(null);
    resetThread();
  }

  function changeMode(m: Mode) {
    setMode(m);
    resetThread();
  }

  async function pickImage(
    source: "camera" | "library",
    target: "exercise" | "correction" = "exercise",
  ) {
    const perm =
      source === "camera"
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert(
        ar ? "إذن مطلوب" : "Permission requise",
        source === "camera"
          ? (ar ? "يلزم الوصول إلى الكاميرا." : "Accès à la caméra nécessaire.")
          : (ar ? "يلزم الوصول إلى المعرض." : "Accès à la galerie nécessaire."),
      );
      return;
    }
    const r =
      source === "camera"
        ? await ImagePicker.launchCameraAsync({ base64: true, quality: 0.8 })
        : await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ["images"],
            base64: true,
            quality: 0.8,
          });
    if (r.canceled || !r.assets?.[0]?.base64) return;
    const asset = r.assets[0];
    const dataUrl = `data:${asset.mimeType ?? "image/jpeg"};base64,${asset.base64}`;
    setOcrLoading(true);
    try {
      const out = await api.post<OcrResponse>("/api/ocr", {
        imageDataUrl: dataUrl,
      });
      const setText = target === "correction" ? setCorrection : setExercise;
      setText((prev) => (prev ? prev + "\n" + out.text : out.text));
      // Le texte extrait contient du LaTeX : on montre directement l'aperçu rendu.
      if (target === "exercise") setExerciseView("preview");
      else setCorrectionView("preview");
      await refresh();
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : (ar ? "فشل التعرف الضوئي" : "OCR échoué.");
      Alert.alert(ar ? "خطأ في التعرف الضوئي" : "Erreur OCR", msg);
    } finally {
      setOcrLoading(false);
    }
  }

  async function onAskHint(targetLevel?: HintLevel) {
    if (exercise.trim().length < 3) {
      Alert.alert(
        ar ? "النص مطلوب" : "Énoncé requis",
        ar
          ? "اكتب تمرينك (3 أحرف على الأقل)."
          : "Saisis ton exercice (au moins 3 caractères).",
      );
      return;
    }
    if (mode === "explain" && correction.trim().length < 3) {
      Alert.alert(
        ar ? "التصحيح مطلوب" : "Correction requise",
        ar
          ? "في وضع «الشرح»، الصق تصحيحك."
          : "En mode « Expliquer », colle ta correction.",
      );
      return;
    }
    setLoading(true);
    try {
      // treatAll : si plusieurs sous-questions détectées ET pas de focus,
      // demander au modèle de toutes les traiter. Identique au web.
      const treatAll =
        subQuestions.length > 1 && !focusQuestion.trim();
      const body = {
        exercise,
        subjectId: subject.id,
        chapterId: chapter?.id,
        level: targetLevel ?? nextLevel,
        previousHints: hints.map((h) => h.text),
        focusQuestion: focusQuestion.trim() || undefined,
        treatAll,
        correction: mode === "explain" ? correction.trim() : undefined,
      };
      const r = await api.post<HintResponse>("/api/hint", body);
      const newHint: ReceivedHint = {
        level: r.level,
        text: r.hint,
        mode: (r.mode === "explain" ? "explain" : "hint") as Mode,
        free_hint_used: r.free_hint_used,
        balance_mru: r.balance_mru,
        truncated: r.truncated,
        similar_exam: r.similar_exam ?? null,
      };
      const allHints = [...hints, newHint];
      setHints(allHints);
      await refresh();
      // Sauvegarde locale (historique). Clé par email user.
      if (user?.email) {
        const session: SavedSession = {
          id: sessionId,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          mode,
          subjectId: subject.id,
          chapterId: chapter?.id ?? null,
          exercise,
          correction: mode === "explain" ? correction : undefined,
          focusQuestion,
          hints: allHints,
        };
        void upsertSession(user.email, session);
      }
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : (ar ? "خطأ غير معروف." : "Erreur inconnue.");
      Alert.alert(t.common.error, msg);
    } finally {
      setLoading(false);
    }
  }

  // Fan-out : génère la solution complète (niveau 3) de CHAQUE sous-question
  // détectée, l'une après l'autre. Identique au web (askAllQuestions dans
  // HomeClient.tsx) : on envoie au backend exactement le libellé `Question X`
  // (`السؤال X`) pour matcher les prompts serveur. Chaque appel consomme un
  // indice gratuit OU débite le solde ; si le solde s'épuise en cours de route,
  // la boucle s'arrête et on garde ce qui a déjà été généré.
  async function onCorrectAll() {
    if (exercise.trim().length < 3) {
      Alert.alert(
        ar ? "النص مطلوب" : "Énoncé requis",
        ar
          ? "اكتب تمرينك (3 أحرف على الأقل)."
          : "Saisis ton exercice (au moins 3 caractères).",
      );
      return;
    }
    const sid = makeSessionId();
    setSessionId(sid);
    setLoading(true);
    const collected: ReceivedHint[] = [];
    try {
      for (let i = 0; i < subQuestions.length; i++) {
        const q = subQuestions[i];
        const label = ar ? `السؤال ${q}` : `Question ${q}`;
        setFanProgress({ current: i + 1, total: subQuestions.length, label: q });
        const body = {
          exercise,
          subjectId: subject.id,
          chapterId: chapter?.id,
          level: 3 as HintLevel,
          previousHints: [],
          focusQuestion: label,
          treatAll: false,
        };
        const r = await api.post<HintResponse>("/api/hint", body);
        collected.push({
          level: 3,
          text: r.hint,
          mode: "hint",
          free_hint_used: r.free_hint_used,
          balance_mru: r.balance_mru,
          truncated: r.truncated,
          similar_exam: r.similar_exam ?? null,
          label,
        });
        setHints([...collected]);
        await refresh();
      }
      if (user?.email && collected.length > 0) {
        const session: SavedSession = {
          id: sid,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          mode: "hint",
          subjectId: subject.id,
          chapterId: chapter?.id ?? null,
          exercise,
          focusQuestion: "",
          hints: collected,
        };
        void upsertSession(user.email, session);
      }
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : (ar ? "خطأ غير معروف." : "Erreur inconnue.");
      Alert.alert(t.common.error, msg);
    } finally {
      setFanProgress(null);
      setLoading(false);
    }
  }

  // Mode « fan-out » : plusieurs sous-questions détectées, aucun focus précis,
  // et on est en mode indice (pas en mode explication).
  const fanOutMode =
    mode === "hint" && !focusQuestion.trim() && subQuestions.length >= 2;

  const ctaLabel =
    mode === "explain"
      ? hints.length === 0
        ? (ar ? "اشرح تصحيحي" : "Expliquer ma correction")
        : (ar ? "تعميق الشرح" : "Approfondir l'explication")
      : hints.length === 0
        ? (ar ? "اطلب تلميحاً" : "Demander un indice")
        : nextLevel === 3
          ? (ar ? "عرض الحل الكامل" : "Voir la solution complète")
          : (ar
              ? `تلميح أدق (المستوى ${nextLevel})`
              : `Indice plus précis (niveau ${nextLevel})`);

  return (
    <SafeAreaView className="flex-1 bg-slate-50" edges={["top"]}>
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerClassName="px-5 py-4 pb-12"
          keyboardShouldPersistTaps="handled"
        >
          <View className="mb-5">
            <Text className="text-2xl font-bold text-slate-900">
              {ar ? "مرحباً 👋" : "Bonjour 👋"}
            </Text>
            {user ? (
              <View className="flex-row items-center mt-2 gap-2 flex-wrap">
                <Badge label={`${user.balance_mru?.toFixed(2) ?? "0.00"} MRU`} />
                {(user.free_hints_remaining ?? 0) > 0 ? (
                  <Badge
                    label={
                      ar
                        ? `${user.free_hints_remaining} تلميحات مجانية`
                        : `${user.free_hints_remaining} indices gratuits`
                    }
                    tone="emerald"
                  />
                ) : null}
              </View>
            ) : null}
          </View>

          <View className="flex-row gap-2 mb-4 bg-white border border-slate-200 rounded-xl p-1">
            <ModeBtn
              label={ar ? "تلميح" : "Indice"}
              active={mode === "hint"}
              onPress={() => changeMode("hint")}
            />
            <ModeBtn
              label={ar ? "شرح" : "Expliquer"}
              active={mode === "explain"}
              onPress={() => changeMode("explain")}
            />
          </View>

          <SectionLabel>{t.home.fieldSubject}</SectionLabel>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerClassName="gap-2 mb-3 pr-2"
          >
            {SUBJECTS.map((s) => {
              const active = s.id === subject.id;
              return (
                <Pressable
                  key={s.id}
                  onPress={() => changeSubject(s)}
                  className={`px-3 py-2 rounded-full border flex-row items-center gap-1 ${
                    active
                      ? "bg-brand border-brand"
                      : "bg-white border-slate-300"
                  }`}
                >
                  <Text style={{ fontSize: 14 }}>{s.emoji}</Text>
                  <Text
                    className={`text-sm ${active ? "text-white" : "text-slate-700"}`}
                  >
                    {s.shortName}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>

          <Pressable
            onPress={() => setChapterPickerOpen(true)}
            className="bg-white border border-slate-300 rounded-xl px-4 py-3 mb-4 flex-row justify-between items-center"
          >
            <Text className="text-sm text-slate-700">
              {chapter
                ? chapter.name
                : (ar ? "الفصل (اختياري)" : "Chapitre (optionnel)")}
            </Text>
            <Text className="text-xs text-slate-400">▾</Text>
          </Pressable>

          <View className="flex-row items-center justify-between mb-2">
            <Text className="text-sm font-medium text-slate-700">
              {t.home.fieldExercise}
            </Text>
            {exercise.trim().length > 0 ? (
              <View className="flex-row bg-slate-100 rounded-lg p-0.5">
                <SegBtn
                  label={ar ? "معاينة" : "Aperçu"}
                  active={exerciseView === "preview"}
                  onPress={() => setExerciseView("preview")}
                />
                <SegBtn
                  label={ar ? "تحرير" : "Éditer"}
                  active={exerciseView === "edit"}
                  onPress={() => setExerciseView("edit")}
                />
              </View>
            ) : null}
          </View>

          {exerciseView === "preview" && exercise.trim().length > 0 ? (
            // Aperçu rendu : tap n'importe où pour repasser en édition.
            <Pressable
              onPress={() => setExerciseView("edit")}
              className="border border-slate-300 rounded-xl px-3 py-1 bg-white min-h-[120px] mb-3"
            >
              <MathMarkdown markdown={exercise} />
            </Pressable>
          ) : (
            <TextInput
              value={exercise}
              onChangeText={(v) => {
                setExercise(v);
                if (hints.length) resetThread();
              }}
              multiline
              textAlignVertical="top"
              className="border border-slate-300 rounded-xl px-4 py-3 text-base bg-white text-slate-900 min-h-[120px] mb-3"
              placeholder={
                ar
                  ? "الصق، اكتب، أو صور نص التمرين..."
                  : "Colle, tape, ou photographie ton énoncé..."
              }
              placeholderTextColor="#94a3b8"
            />
          )}

          <View className="flex-row gap-2 mb-4">
            <Pressable
              onPress={() => pickImage("camera")}
              disabled={ocrLoading}
              className="flex-1 bg-white border border-slate-300 rounded-xl py-3 items-center active:bg-slate-100 disabled:opacity-60"
            >
              {ocrLoading ? (
                <ActivityIndicator color="#2563eb" />
              ) : (
                <Text className="text-slate-700 text-sm font-medium">
                  {ar ? "📷 صورة" : "📷 Photo"}
                </Text>
              )}
            </Pressable>
            <Pressable
              onPress={() => pickImage("library")}
              disabled={ocrLoading}
              className="flex-1 bg-white border border-slate-300 rounded-xl py-3 items-center active:bg-slate-100 disabled:opacity-60"
            >
              <Text className="text-slate-700 text-sm font-medium">
                {ar ? "🖼️ المعرض" : "🖼️ Galerie"}
              </Text>
            </Pressable>
          </View>

          <SectionLabel>{t.home.fieldFocus}</SectionLabel>
          {subQuestions.length > 0 ? (
            <View className="flex-row flex-wrap gap-1.5 mb-2">
              <FocusChip
                label={
                  subQuestions.length === 1
                    ? t.home.focusSingle
                    : t.home.focusAll
                }
                active={!focusQuestion.trim()}
                onPress={() => setFocusQuestion("")}
              />
              {subQuestions.map((q) => {
                // Important : on envoie au backend exactement le même format
                // que le web (`Question X` / `السؤال X`) pour matcher les
                // prompts côté serveur.
                const label = ar ? `السؤال ${q}` : `Question ${q}`;
                const active = focusQuestion.trim() === label;
                return (
                  <FocusChip
                    key={q}
                    label={q}
                    active={active}
                    onPress={() =>
                      setFocusQuestion(active ? "" : label)
                    }
                  />
                );
              })}
            </View>
          ) : null}
          <TextInput
            value={focusQuestion}
            onChangeText={setFocusQuestion}
            className="border border-slate-300 rounded-xl px-4 py-2.5 text-sm bg-white text-slate-900 mb-4"
            placeholder={
              subQuestions.length > 0
                ? (ar ? "أو اكتب تفصيلاً حراً" : "Ou tape une précision libre")
                : (ar ? "مثال: السؤال 2.b فقط" : "ex: question 2.b uniquement")
            }
            placeholderTextColor="#94a3b8"
          />

          {mode === "explain" ? (
            <>
              <View className="flex-row items-center justify-between mb-2">
                <Text className="text-sm font-medium text-slate-700">
                  {t.home.fieldCorrection}
                </Text>
                {correction.trim().length > 0 ? (
                  <View className="flex-row bg-slate-100 rounded-lg p-0.5">
                    <SegBtn
                      label={ar ? "معاينة" : "Aperçu"}
                      active={correctionView === "preview"}
                      onPress={() => setCorrectionView("preview")}
                    />
                    <SegBtn
                      label={ar ? "تحرير" : "Éditer"}
                      active={correctionView === "edit"}
                      onPress={() => setCorrectionView("edit")}
                    />
                  </View>
                ) : null}
              </View>

              {correctionView === "preview" && correction.trim().length > 0 ? (
                <Pressable
                  onPress={() => setCorrectionView("edit")}
                  className="border border-slate-300 rounded-xl px-3 py-1 bg-white min-h-[100px] mb-4"
                >
                  <MathMarkdown markdown={correction} />
                </Pressable>
              ) : (
                <TextInput
                  value={correction}
                  onChangeText={setCorrection}
                  multiline
                  textAlignVertical="top"
                  className="border border-slate-300 rounded-xl px-4 py-3 text-base bg-white text-slate-900 min-h-[100px] mb-4"
                  placeholder={
                    ar
                      ? "الصق محاولتك ؛ سيقول الذكاء الاصطناعي ما الذي يعمل وما الذي لا يعمل."
                      : "Colle ta tentative ; l'IA dira ce qui marche et ce qui cloche."
                  }
                  placeholderTextColor="#94a3b8"
                />
              )}
              <View className="flex-row gap-2 mb-4">
                <Pressable
                  onPress={() => pickImage("camera", "correction")}
                  disabled={ocrLoading}
                  className="flex-1 bg-white border border-slate-300 rounded-xl py-3 items-center active:bg-slate-100 disabled:opacity-60"
                >
                  {ocrLoading ? (
                    <ActivityIndicator color="#2563eb" />
                  ) : (
                    <Text className="text-slate-700 text-sm font-medium">
                      {t.home.btnTakePhotoCorrection}
                    </Text>
                  )}
                </Pressable>
                <Pressable
                  onPress={() => pickImage("library", "correction")}
                  disabled={ocrLoading}
                  className="flex-1 bg-white border border-slate-300 rounded-xl py-3 items-center active:bg-slate-100 disabled:opacity-60"
                >
                  <Text className="text-slate-700 text-sm font-medium">
                    {t.home.btnChoosePhotosCorrection}
                  </Text>
                </Pressable>
              </View>
            </>
          ) : null}

          {fanOutMode ? (
            <Pressable
              onPress={onCorrectAll}
              disabled={loading}
              className="bg-brand rounded-xl py-4 items-center active:bg-brand-dark disabled:opacity-60 mb-4"
            >
              {loading ? (
                <View className="flex-row items-center gap-2">
                  <ActivityIndicator color="#fff" />
                  {fanProgress ? (
                    <Text className="text-white font-semibold text-base">
                      {ar ? "السؤال" : "Question"} {fanProgress.label} (
                      {fanProgress.current}/{fanProgress.total})
                    </Text>
                  ) : null}
                </View>
              ) : (
                <Text className="text-white font-semibold text-base">
                  {t.home.btnCorrectAll.replace(
                    "{count}",
                    String(subQuestions.length),
                  )}
                </Text>
              )}
            </Pressable>
          ) : (
            <>
              <Pressable
                onPress={() => onAskHint()}
                disabled={loading}
                className={`bg-brand rounded-xl py-4 items-center active:bg-brand-dark disabled:opacity-60 ${
                  mode === "hint" && nextLevel !== 3 ? "mb-2" : "mb-4"
                }`}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text className="text-white font-semibold text-base">
                    {ctaLabel}
                  </Text>
                )}
              </Pressable>
              {mode === "hint" && nextLevel !== 3 ? (
                <Pressable
                  onPress={() => onAskHint(3)}
                  disabled={loading}
                  className="border border-emerald-300 bg-emerald-50 rounded-xl py-3 items-center active:bg-emerald-100 disabled:opacity-60 mb-4"
                >
                  <Text className="text-emerald-800 text-sm font-medium">
                    {ar ? "✅ الحل المباشر" : "✅ Solution directe"}
                  </Text>
                </Pressable>
              ) : null}
            </>
          )}

          {hints.map((h, idx) => (
            <View
              key={idx}
              className="bg-white border border-slate-200 rounded-xl p-3 mb-3"
            >
              <View className="flex-row justify-between items-center mb-2 px-1">
                <Text className="text-xs uppercase tracking-wide text-slate-500">
                  {h.label
                    ? (ar ? `${h.label} — الحل` : `${h.label} — Solution`)
                    : h.mode === "explain"
                      ? (ar ? `تحليل — مستوى ${h.level}` : `Analyse — niveau ${h.level}`)
                      : (ar ? `تلميح — مستوى ${h.level}` : `Indice — niveau ${h.level}`)}
                  {h.truncated
                    ? (ar ? " (مقتطع)" : " (tronqué)")
                    : ""}
                </Text>
                {h.free_hint_used ? (
                  <Text className="text-xs text-emerald-600">
                    {ar ? "مجاني" : "gratuit"}
                  </Text>
                ) : h.balance_mru !== undefined ? (
                  <Text className="text-xs text-slate-500">
                    {h.balance_mru.toFixed(2)} MRU
                  </Text>
                ) : null}
              </View>
              <MathMarkdown markdown={h.text} />
              {h.similar_exam ? (
                <View className="mt-2 px-1 flex-row items-center gap-1.5">
                  <Text style={{ fontSize: 11 }}>📌</Text>
                  <Text className="text-xs text-slate-500">
                    {ar
                      ? `مشابه لـ : ${h.similar_exam}`
                      : `Similaire à : ${h.similar_exam}`}
                  </Text>
                </View>
              ) : null}
            </View>
          ))}

          {hints.length > 0 ? (
            <Pressable
              onPress={resetThread}
              className="items-center py-2 mt-1"
            >
              <Text className="text-sm text-slate-500 underline">
                {ar ? "البدء بتمرين جديد" : "Recommencer avec un nouvel exercice"}
              </Text>
            </Pressable>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>

      <ChapterPicker
        visible={chapterPickerOpen}
        subject={subject}
        selected={chapter}
        onSelect={(c) => {
          setChapter(c);
          setChapterPickerOpen(false);
          if (hints.length) resetThread();
        }}
        onClose={() => setChapterPickerOpen(false)}
      />
    </SafeAreaView>
  );
}

function ChapterPicker({
  visible,
  subject,
  selected,
  onSelect,
  onClose,
}: {
  visible: boolean;
  subject: Subject;
  selected: Chapter | null;
  onSelect: (c: Chapter | null) => void;
  onClose: () => void;
}) {
  const { t, locale } = useTranslation();
  const ar = locale === "ar";
  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView className="flex-1 bg-white">
        <View className="flex-row justify-between items-center px-5 py-3 border-b border-slate-200">
          <Text className="text-lg font-semibold text-slate-900">
            {subject.emoji} {subject.name}
          </Text>
          <Pressable onPress={onClose} hitSlop={8}>
            <Text className="text-brand text-sm">{t.common.close}</Text>
          </Pressable>
        </View>
        <ScrollView className="flex-1" contentContainerClassName="px-2 py-2">
          <Pressable
            onPress={() => onSelect(null)}
            className={`px-4 py-3 rounded-xl mb-1 ${
              selected === null ? "bg-brand/10" : ""
            }`}
          >
            <Text
              className={`text-base ${
                selected === null ? "text-brand font-medium" : "text-slate-700"
              }`}
            >
              {ar ? "بدون (جميع الأسئلة)" : "Aucun (toutes les questions)"}
            </Text>
          </Pressable>
          {subject.chapters.map((c) => {
            const active = selected?.id === c.id;
            return (
              <Pressable
                key={c.id}
                onPress={() => onSelect(c)}
                className={`px-4 py-3 rounded-xl mb-1 ${
                  active ? "bg-brand/10" : ""
                }`}
              >
                <Text
                  className={`text-base ${
                    active ? "text-brand font-medium" : "text-slate-700"
                  }`}
                >
                  {c.name}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

function ModeBtn({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      className={`flex-1 py-2 rounded-lg items-center ${
        active ? "bg-brand" : ""
      }`}
    >
      <Text
        className={`text-sm font-medium ${
          active ? "text-white" : "text-slate-700"
        }`}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function SegBtn({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      className={`px-3 py-1 rounded-md ${active ? "bg-white" : ""}`}
    >
      <Text
        className={`text-xs font-medium ${
          active ? "text-brand" : "text-slate-500"
        }`}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function FocusChip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      className={`px-2.5 py-1 rounded-full border ${
        active ? "bg-brand border-brand" : "bg-white border-slate-300"
      }`}
    >
      <Text
        className={`text-xs ${active ? "text-white" : "text-slate-700"}`}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <Text className="text-sm font-medium text-slate-700 mb-2">{children}</Text>
  );
}

function Badge({
  label,
  tone = "slate",
}: {
  label: string;
  tone?: "slate" | "emerald";
}) {
  const bg = tone === "emerald" ? "bg-emerald-50" : "bg-slate-100";
  const fg = tone === "emerald" ? "text-emerald-700" : "text-slate-700";
  return (
    <View className={`px-2.5 py-1 rounded-full ${bg}`}>
      <Text className={`text-xs font-medium ${fg}`}>{label}</Text>
    </View>
  );
}
