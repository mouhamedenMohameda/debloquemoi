/**
 * « Mes annales » (mobile) — équivalent de la page web /bac.
 *
 *   1. Série (C / D) — demandée une seule fois, enregistrée dans le profil.
 *   2. Photo → texte (/api/ocr), modifiable ; ou texte collé.
 *   3. Résultat (/api/bac/analyze, gratuit, sans IA) :
 *        - sujet du bac reconnu → sa correction validée ;
 *        - sinon chapitre + notions, années, exercices et cours ;
 *        - chapitre non publié → « pas encore disponible ».
 *   4. « Indices pas à pas » → onglet Accueil avec l'énoncé pré-rempli.
 */
import { useState } from "react";
import { useRouter } from "expo-router";
import {
  ActivityIndicator,
  Alert,
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
import { useTranslation } from "@/lib/i18n";
import { setPending } from "@/lib/exerciseStore";
import { MathMarkdown } from "@/components/MathMarkdown";
import { ChapterView, sessionLabel, type ChapterNotion } from "@/components/ChapterView";

type Filiere = "C" | "D";

type AnalyzeResult = {
  status: "matched" | "detected" | "not_published" | "unknown";
  matiere_id?: string;
  chapitre?: string | null;
  exercise?: {
    id: string;
    annee: number;
    session: string;
    exercice_numero: string | number;
    enonce: string;
    correction: string | null;
  } | null;
  notions?: ChapterNotion[];
  other_notions?: { notion_id: string; label: string }[];
};

const MATIERE = {
  fr: { math: "Mathématiques", pc: "Sciences Physiques", svt: "Sciences Naturelles" } as Record<string, string>,
  ar: { math: "الرياضيات", pc: "العلوم الفيزيائية", svt: "العلوم الطبيعية" } as Record<string, string>,
};

const MATIERE_TO_SUBJECT: Record<string, string> = { math: "math", pc: "physique", svt: "svt" };

export default function Annales() {
  const router = useRouter();
  const { user, refresh } = useSession();
  const { locale } = useTranslation();
  const ar = locale === "ar";

  const saved = user?.bac_filiere === "C" || user?.bac_filiere === "D" ? user.bac_filiere : null;
  const [filiereLocal, setFiliereLocal] = useState<Filiere | null>(null);
  const filiere = filiereLocal ?? saved;
  const [changing, setChanging] = useState(false);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState<null | "ocr" | "analyze" | "filiere">(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AnalyzeResult | null>(null);
  const [showCorrection, setShowCorrection] = useState(false);

  async function saveFiliere(f: Filiere) {
    setBusy("filiere");
    setError(null);
    try {
      await api.post("/api/profile/filiere", { bac_filiere: f });
      setFiliereLocal(f);
      setChanging(false);
      setResult(null);
      refresh().catch(() => undefined);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : ar ? "تعذّر حفظ الشعبة." : "Impossible d'enregistrer la série.");
    } finally {
      setBusy(null);
    }
  }

  async function analyze(t: string = text) {
    if (t.trim().length < 10) {
      setError(ar ? "اكتب أو صوّر نص التمرين كاملاً." : "Écris ou photographie l'énoncé complet de l'exercice.");
      return;
    }
    setBusy("analyze");
    setError(null);
    setShowCorrection(false);
    try {
      setResult(await api.post<AnalyzeResult>("/api/bac/analyze", { text: t }));
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) {
        setFiliereLocal(null);
        setChanging(true);
        return;
      }
      setError(e instanceof ApiError ? e.message : ar ? "حدث خطأ، أعد المحاولة." : "Erreur, réessaie.");
    } finally {
      setBusy(null);
    }
  }

  async function pick(source: "camera" | "library") {
    const perm =
      source === "camera"
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert(
        ar ? "إذن مطلوب" : "Permission requise",
        source === "camera"
          ? ar ? "يلزم الوصول إلى الكاميرا." : "Accès à la caméra nécessaire."
          : ar ? "يلزم الوصول إلى المعرض." : "Accès à la galerie nécessaire.",
      );
      return;
    }
    // Recadrage proposé (un seul exercice = meilleure reconnaissance) et
    // qualité réduite : envoi plus rapide, lecture moins chère.
    const opts = { base64: true, quality: 0.6, allowsEditing: true } as const;
    const r =
      source === "camera"
        ? await ImagePicker.launchCameraAsync(opts)
        : await ImagePicker.launchImageLibraryAsync({ ...opts, mediaTypes: ["images"] });
    if (r.canceled || !r.assets?.[0]?.base64) return;
    const asset = r.assets[0];
    setBusy("ocr");
    setError(null);
    setResult(null);
    try {
      const out = await api.post<{ text: string }>("/api/ocr", {
        imageDataUrl: `data:${asset.mimeType ?? "image/jpeg"};base64,${asset.base64}`,
      });
      setText(out.text || "");
      refresh().catch(() => undefined); // solde mis à jour
      setBusy(null);
      await analyze(out.text || "");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : ar ? "تعذّرت قراءة الصورة." : "Lecture de la photo impossible.");
    } finally {
      setBusy((b) => (b === "ocr" ? null : b));
    }
  }

  function goToHints() {
    setPending({ exercise: text, subjectId: MATIERE_TO_SUBJECT[result?.matiere_id ?? ""] });
    router.push("/(tabs)/home");
  }

  // ── Étape 0 : la série ─────────────────────────────────────────────────────
  if (!filiere || changing) {
    return (
      <SafeAreaView className="flex-1 bg-slate-50">
        <ScrollView contentContainerStyle={{ padding: 20, paddingTop: 40 }}>
          <Text className="text-2xl font-extrabold text-slate-900 text-center">
            {ar ? "في أي شعبة أنت؟" : "Tu es en quelle série ?"}
          </Text>
          <Text className="mt-2 text-sm text-slate-600 text-center">
            {ar
              ? "نعرض لك مواضيع الباكالوريا الخاصة بشعبتك. يمكنك تغييرها لاحقاً."
              : "On te montre les sujets du bac de ta série. Tu pourras la changer plus tard."}
          </Text>
          <View className="flex-row mt-6" style={{ gap: 12 }}>
            {(["C", "D"] as const).map((f) => (
              <Pressable
                key={f}
                disabled={busy === "filiere"}
                onPress={() => saveFiliere(f)}
                className={`flex-1 rounded-2xl px-4 py-6 border ${
                  filiere === f ? "bg-indigo-50 border-indigo-400" : "bg-white border-slate-200"
                } active:opacity-70`}
              >
                <Text className="text-2xl font-extrabold text-slate-900">{ar ? `شعبة ${f}` : `Série ${f}`}</Text>
                <Text className="mt-1 text-xs text-slate-500">
                  {f === "C" ? (ar ? "الرياضيات" : "Mathématiques") : ar ? "العلوم الطبيعية" : "Sciences de la nature"}
                </Text>
              </Pressable>
            ))}
          </View>
          {busy === "filiere" && <ActivityIndicator className="mt-4" />}
          {changing && (
            <Pressable onPress={() => setChanging(false)} className="mt-4 self-center">
              <Text className="text-sm text-slate-500">{ar ? "إلغاء" : "Annuler"}</Text>
            </Pressable>
          )}
          {error && <Text className="mt-4 text-sm text-red-700 text-center">{error}</Text>}
        </ScrollView>
      </SafeAreaView>
    );
  }

  const known = result?.status === "matched" || result?.status === "detected";

  return (
    <SafeAreaView className="flex-1 bg-slate-50" edges={["top"]}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
        <View className="flex-row justify-between items-center">
          <Text className="text-2xl font-extrabold text-slate-900">{ar ? "📸 حولياتي" : "📸 Mes annales"}</Text>
          <Pressable onPress={() => setChanging(true)}>
            <Text className="text-xs font-semibold text-indigo-600">
              {ar ? `شعبة ${filiere} · تغيير` : `Série ${filiere} · changer`}
            </Text>
          </Pressable>
        </View>
        <Text className="mt-1 text-sm text-slate-600">
          {ar
            ? "صوّر تمرينك: نخبرك بالفصل الذي ينتمي إليه، والمفاهيم التي يستعملها، والسنوات التي جاءت فيها في الباكالوريا، مع التصحيحات والدروس."
            : "Prends ton exercice en photo : on te dit de quel chapitre il s'agit, les notions qu'il utilise et les années où elles sont tombées au bac, avec les corrections et le cours."}
        </Text>

        {/* ── Énoncé ───────────────────────────────────────────────────── */}
        <View className="mt-4 bg-white border border-slate-200 rounded-2xl p-4">
          <View className="flex-row" style={{ gap: 8 }}>
            <Pressable
              disabled={busy !== null}
              onPress={() => pick("camera")}
              className="flex-1 rounded-xl bg-indigo-600 px-3 py-3 items-center active:bg-indigo-700 disabled:opacity-50"
            >
              <Text className="text-white font-bold">
                {busy === "ocr" ? (ar ? "جارٍ القراءة…" : "Lecture…") : ar ? "📷 التقط صورة" : "📷 Photo"}
              </Text>
            </Pressable>
            <Pressable
              disabled={busy !== null}
              onPress={() => pick("library")}
              className="flex-1 rounded-xl bg-white border border-indigo-200 px-3 py-3 items-center active:bg-indigo-50"
            >
              <Text className="text-indigo-700 font-bold">{ar ? "🖼️ من المعرض" : "🖼️ Galerie"}</Text>
            </Pressable>
          </View>
          <Text className="mt-3 text-xs font-semibold text-slate-500">
            {ar ? "أو اكتب / الصق نص التمرين" : "OU ÉCRIS / COLLE L'ÉNONCÉ"}
          </Text>
          <TextInput
            value={text}
            onChangeText={setText}
            multiline
            textAlignVertical="top"
            placeholder={ar ? "مثال: نضع P(z) = z³ − (5 + 4i)z² + …" : "Ex. : On pose P(z) = z³ − (5 + 4i)z² + …"}
            className="mt-1 rounded-lg border border-slate-200 p-3 text-sm text-slate-900"
            style={{ minHeight: text ? 150 : 90, textAlign: ar ? "right" : "left" }}
          />
          <View className="mt-2 flex-row items-center flex-wrap" style={{ gap: 8 }}>
            <Pressable
              disabled={busy !== null || text.trim().length < 10}
              onPress={() => analyze()}
              className={`rounded-full bg-slate-900 px-4 py-2 ${busy !== null || text.trim().length < 10 ? "opacity-40" : ""}`}
            >
              <Text className="text-white text-sm font-semibold">
                {busy === "analyze" ? (ar ? "جارٍ البحث…" : "Recherche…") : ar ? "ابحث في الحوليات" : "Trouver dans les annales"}
              </Text>
            </Pressable>
            {busy && <ActivityIndicator size="small" />}
          </View>
          {!!text && !result && (
            <Text className="mt-2 text-xs text-slate-500">
              {ar ? "يمكنك تصحيح النص المقروء قبل البحث." : "Tu peux corriger le texte lu avant de chercher."}
            </Text>
          )}
          {error && <Text className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</Text>}
        </View>

        {/* ── Résultat ─────────────────────────────────────────────────── */}
        {result && (
          <View className="mt-5">
            {result.status === "not_published" && (
              <View className="rounded-2xl bg-amber-50 border border-amber-200 p-4">
                <Text className="text-lg font-bold text-amber-900 text-center">
                  {ar ? "الحوليات غير متوفرة بعد" : "Annales pas encore disponibles"}
                </Text>
                <Text className="mt-1 text-sm text-amber-800 text-center">
                  {ar
                    ? `يتعلق هذا التمرين بـ «${result.chapitre ?? "فصل"}». مواضيع الباكالوريا والتصحيحات والدروس المُراجَعة لهذا الفصل قيد الإعداد للشعبة ${filiere}.`
                    : `Cet exercice porte sur « ${result.chapitre ?? "un chapitre"} ». Les sujets du bac, corrections et cours vérifiés de ce chapitre sont en préparation pour la série ${filiere}.`}
                </Text>
                <Text className="mt-2 text-sm text-amber-800 text-center">
                  {ar
                    ? "يمكنك مع ذلك طلب مساعدة الذكاء الاصطناعي: جوابه لن يكون مُراجَعاً من طرف أستاذ."
                    : "Tu peux quand même te faire aider par l'IA : sa réponse ne sera pas vérifiée par un professeur."}
                </Text>
              </View>
            )}

            {result.status === "unknown" && (
              <View className="rounded-2xl bg-white border border-slate-200 p-4">
                <Text className="text-lg font-bold text-slate-900 text-center">
                  {ar ? "لم نتعرف على هذا التمرين" : "On n'a pas reconnu cet exercice"}
                </Text>
                <Text className="mt-1 text-sm text-slate-600 text-center">
                  {ar
                    ? "لا يطابق أي موضوع باكالوريا مُراجَع. تأكد من أن النص المقروء مطابق للتمرين، أو اطلب مساعدة الذكاء الاصطناعي (جواب غير مُراجَع من طرف أستاذ)."
                    : "Il ne correspond à aucun sujet du bac vérifié. Vérifie que le texte lu correspond bien à l'énoncé, ou fais-toi aider par l'IA (réponse non vérifiée par un professeur)."}
                </Text>
              </View>
            )}

            {known && (
              <>
                <View className="rounded-2xl bg-white border border-slate-200 p-4">
                  <Text className="text-xs font-semibold text-slate-500">
                    {ar ? `شعبة ${filiere}` : `SÉRIE ${filiere}`} · {MATIERE[ar ? "ar" : "fr"][result.matiere_id ?? ""] ?? result.matiere_id}
                  </Text>
                  <Text className="text-xl font-extrabold text-slate-900">{result.chapitre}</Text>
                  {(result.notions?.length ?? 0) > 0 && (
                    <View className="flex-row flex-wrap mt-2" style={{ gap: 6 }}>
                      {result.notions!.map((n) => (
                        <View key={n.notion_id} className="rounded-full bg-indigo-50 px-2.5 py-1">
                          <Text className="text-xs font-semibold text-indigo-700">{n.label}</Text>
                        </View>
                      ))}
                    </View>
                  )}
                </View>

                {result.exercise && (
                  <View className="mt-4 rounded-2xl bg-emerald-50 border border-emerald-200 p-4">
                    <Text className="text-sm font-bold text-emerald-900">
                      {ar
                        ? `✅ هذا موضوع باكالوريا: باك ${filiere} ${result.exercise.annee} · ${sessionLabel(result.exercise.session, true)} · التمرين ${result.exercise.exercice_numero}`
                        : `✅ C'est un sujet du bac : Bac ${filiere} ${result.exercise.annee} · ${sessionLabel(result.exercise.session, false)} · Exercice ${result.exercise.exercice_numero}`}
                    </Text>
                    {result.exercise.correction ? (
                      <>
                        <Pressable
                          onPress={() => setShowCorrection((v) => !v)}
                          className="mt-3 self-start rounded-full bg-emerald-600 px-4 py-1.5 active:bg-emerald-700"
                        >
                          <Text className="text-white text-sm font-semibold">
                            {showCorrection
                              ? ar ? "إخفاء التصحيح" : "Masquer la correction"
                              : ar ? "عرض التصحيح" : "Voir la correction"}
                          </Text>
                        </Pressable>
                        {showCorrection && (
                          <View className="mt-3 rounded-xl bg-white p-1">
                            <MathMarkdown markdown={result.exercise.correction} />
                          </View>
                        )}
                      </>
                    ) : (
                      <Text className="mt-1 text-xs text-emerald-800">
                        {ar ? "التصحيح قادم قريباً." : "La correction arrive bientôt."}
                      </Text>
                    )}
                  </View>
                )}

                {(result.notions?.length ?? 0) > 0 && (
                  <View className="mt-5">
                    <Text className="mb-2 text-base font-bold text-slate-900">
                      {ar ? "مفاهيم تمرينك في الباكالوريا" : "Les notions de ton exercice au bac"}
                    </Text>
                    <ChapterView notions={result.notions!} />
                  </View>
                )}

                {(result.other_notions?.length ?? 0) > 0 && (
                  <Text className="mt-2 text-xs text-slate-500">
                    {ar ? "مفاهيم أخرى من الفصل: " : "Autres notions du chapitre : "}
                    {result.other_notions!.map((n) => n.label).join(" · ")}
                  </Text>
                )}
              </>
            )}

            <View className="mt-5 rounded-2xl bg-indigo-50 border border-indigo-100 p-4 items-center">
              <Text className="text-sm text-indigo-900 text-center">
                {result.status === "matched" && result.exercise?.correction
                  ? ar ? "تفضّل البحث بنفسك؟ التلميحات تعتمد على التصحيح المُراجَع." : "Tu préfères chercher toi-même ? Les indices s'appuient sur la correction vérifiée."
                  : known
                    ? ar ? "تحتاج مساعدة لحله؟ التلميحات يكتبها الذكاء الاصطناعي (غير مُراجَعة)." : "Besoin d'aide pour le résoudre ? Les indices sont rédigés par l'IA (non vérifiés)."
                    : ar ? "مساعدة الذكاء الاصطناعي خطوة بخطوة (غير مُراجَعة من طرف أستاذ)." : "Aide de l'IA, étape par étape (non vérifiée par un professeur)."}
              </Text>
              <Pressable onPress={goToHints} className="mt-2 rounded-full bg-indigo-600 px-4 py-2 active:bg-indigo-700">
                <Text className="text-white text-sm font-semibold">{ar ? "💡 تلميحات خطوة بخطوة" : "💡 Indices pas à pas"}</Text>
              </Pressable>
            </View>
          </View>
        )}

        <Pressable onPress={() => router.push("/(tabs)/exercises")} className="mt-6 self-center">
          <Text className="text-sm text-slate-500">{ar ? "📚 تصفّح بنك التمارين" : "📚 Parcourir la banque d'exercices"}</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}
