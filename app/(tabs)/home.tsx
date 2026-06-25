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
import { HintViewer } from "@/components/HintViewer";
import { SUBJECTS, getSubject, type Chapter, type Subject } from "@/lib/subjects";
import { takePending } from "@/lib/exerciseStore";
import { detectSubQuestions } from "@/lib/subQuestions";
import {
  makeSessionId,
  upsertSession,
  type SavedSession,
} from "@/lib/history";
import { takePendingSession } from "@/lib/historyStore";

type HintLevel = 1 | 2 | 3;

type HintResponse = {
  hint: string;
  level: HintLevel;
  balance_mru?: number;
  free_hint_used?: boolean;
  free_hints_remaining?: number;
  truncated?: boolean;
  mode?: "correct" | "explain";
  similar_exam?: { id: string; title?: string } | null;
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
};

export default function Home() {
  const { user, refresh } = useSession();
  const [exercise, setExercise] = useState("");
  const [subject, setSubject] = useState<Subject>(SUBJECTS[0]);
  const [chapter, setChapter] = useState<Chapter | null>(null);
  const [focusQuestion, setFocusQuestion] = useState("");
  const [correction, setCorrection] = useState("");
  const [mode, setMode] = useState<Mode>("hint");
  const [hints, setHints] = useState<ReceivedHint[]>([]);
  const [loading, setLoading] = useState(false);
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
        setCorrection(restored.correction ?? "");
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

  async function pickImage(source: "camera" | "library") {
    const perm =
      source === "camera"
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert(
        "Permission requise",
        source === "camera"
          ? "Accès à la caméra nécessaire."
          : "Accès à la galerie nécessaire.",
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
      setExercise((prev) => (prev ? prev + "\n" + out.text : out.text));
      await refresh();
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : "OCR échoué.";
      Alert.alert("Erreur OCR", msg);
    } finally {
      setOcrLoading(false);
    }
  }

  async function onAskHint() {
    if (exercise.trim().length < 3) {
      Alert.alert(
        "Énoncé requis",
        "Saisis ton exercice (au moins 3 caractères).",
      );
      return;
    }
    if (mode === "explain" && correction.trim().length < 3) {
      Alert.alert(
        "Correction requise",
        "En mode « Expliquer », colle ta correction.",
      );
      return;
    }
    setLoading(true);
    try {
      const body = {
        exercise,
        subjectId: subject.id,
        chapterId: chapter?.id,
        level: nextLevel,
        previousHints: hints.map((h) => h.text),
        focusQuestion: focusQuestion.trim() || undefined,
        correction: mode === "explain" ? correction.trim() : undefined,
      };
      const r = await api.post<HintResponse>("/api/hint", body);
      const newHint = {
        level: r.level,
        text: r.hint,
        mode: (r.mode === "explain" ? "explain" : "hint") as Mode,
        free_hint_used: r.free_hint_used,
        balance_mru: r.balance_mru,
        truncated: r.truncated,
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
      const msg = e instanceof ApiError ? e.message : "Erreur inconnue.";
      Alert.alert("Erreur", msg);
    } finally {
      setLoading(false);
    }
  }

  const ctaLabel =
    mode === "explain"
      ? hints.length === 0
        ? "Expliquer ma correction"
        : "Approfondir l'explication"
      : hints.length === 0
        ? "Demander un indice"
        : nextLevel === 3
          ? "Voir la solution complète"
          : `Indice plus précis (niveau ${nextLevel})`;

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
              Bonjour 👋
            </Text>
            {user ? (
              <View className="flex-row items-center mt-2 gap-2 flex-wrap">
                <Badge label={`${user.balance_mru?.toFixed(2) ?? "0.00"} MRU`} />
                {(user.free_hints_remaining ?? 0) > 0 ? (
                  <Badge
                    label={`${user.free_hints_remaining} indices gratuits`}
                    tone="emerald"
                  />
                ) : null}
              </View>
            ) : null}
          </View>

          <View className="flex-row gap-2 mb-4 bg-white border border-slate-200 rounded-xl p-1">
            <ModeBtn
              label="Indice"
              active={mode === "hint"}
              onPress={() => changeMode("hint")}
            />
            <ModeBtn
              label="Expliquer"
              active={mode === "explain"}
              onPress={() => changeMode("explain")}
            />
          </View>

          <SectionLabel>Matière</SectionLabel>
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
              {chapter ? chapter.name : "Chapitre (optionnel)"}
            </Text>
            <Text className="text-xs text-slate-400">▾</Text>
          </Pressable>

          <SectionLabel>Ton exercice</SectionLabel>
          <TextInput
            value={exercise}
            onChangeText={(v) => {
              setExercise(v);
              if (hints.length) resetThread();
            }}
            multiline
            textAlignVertical="top"
            className="border border-slate-300 rounded-xl px-4 py-3 text-base bg-white text-slate-900 min-h-[120px] mb-3"
            placeholder="Colle, tape, ou photographie ton énoncé..."
            placeholderTextColor="#94a3b8"
          />

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
                  📷 Photo
                </Text>
              )}
            </Pressable>
            <Pressable
              onPress={() => pickImage("library")}
              disabled={ocrLoading}
              className="flex-1 bg-white border border-slate-300 rounded-xl py-3 items-center active:bg-slate-100 disabled:opacity-60"
            >
              <Text className="text-slate-700 text-sm font-medium">
                🖼️ Galerie
              </Text>
            </Pressable>
          </View>

          <SectionLabel>Question ciblée (optionnel)</SectionLabel>
          {subQuestions.length > 0 ? (
            <View className="flex-row flex-wrap gap-1.5 mb-2">
              <FocusChip
                label={
                  subQuestions.length === 1
                    ? "Cet exercice"
                    : "Tout l'exercice"
                }
                active={!focusQuestion.trim()}
                onPress={() => setFocusQuestion("")}
              />
              {subQuestions.map((q) => {
                const label = `Question ${q}`;
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
                ? "Ou tape une précision libre"
                : "ex: question 2.b uniquement"
            }
            placeholderTextColor="#94a3b8"
          />

          {mode === "explain" ? (
            <>
              <SectionLabel>Ta correction (ou ce que tu as essayé)</SectionLabel>
              <TextInput
                value={correction}
                onChangeText={setCorrection}
                multiline
                textAlignVertical="top"
                className="border border-slate-300 rounded-xl px-4 py-3 text-base bg-white text-slate-900 min-h-[100px] mb-4"
                placeholder="Colle ta tentative ; l'IA dira ce qui marche et ce qui cloche."
                placeholderTextColor="#94a3b8"
              />
            </>
          ) : null}

          <Pressable
            onPress={onAskHint}
            disabled={loading}
            className="bg-brand rounded-xl py-4 items-center active:bg-brand-dark disabled:opacity-60 mb-4"
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text className="text-white font-semibold text-base">
                {ctaLabel}
              </Text>
            )}
          </Pressable>

          {hints.map((h, idx) => (
            <View
              key={idx}
              className="bg-white border border-slate-200 rounded-xl p-3 mb-3"
            >
              <View className="flex-row justify-between items-center mb-2 px-1">
                <Text className="text-xs uppercase tracking-wide text-slate-500">
                  {h.mode === "explain"
                    ? `Analyse — niveau ${h.level}`
                    : `Indice — niveau ${h.level}`}
                  {h.truncated ? " (tronqué)" : ""}
                </Text>
                {h.free_hint_used ? (
                  <Text className="text-xs text-emerald-600">gratuit</Text>
                ) : h.balance_mru !== undefined ? (
                  <Text className="text-xs text-slate-500">
                    {h.balance_mru.toFixed(2)} MRU
                  </Text>
                ) : null}
              </View>
              <HintViewer markdown={h.text} />
            </View>
          ))}

          {hints.length > 0 ? (
            <Pressable
              onPress={resetThread}
              className="items-center py-2 mt-1"
            >
              <Text className="text-sm text-slate-500 underline">
                Recommencer avec un nouvel exercice
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
            <Text className="text-brand text-sm">Fermer</Text>
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
              Aucun (toutes les questions)
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
