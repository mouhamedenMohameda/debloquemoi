import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { ApiError, api } from "@/lib/api";
import { setPending } from "@/lib/exerciseStore";

type ListItem = {
  id: string;
  titre?: string;
  matiere_id: string;
  filiere_id: string;
  annee: number;
  session: string;
  exercice_numero?: string | number;
  chapitre: string;
  ennonce_preview: string;
  has_correction: boolean;
  is_skeleton: boolean;
};

type FullExercise = {
  id: string;
  titre?: string;
  matiere_id: string;
  ennonce_complet: string;
};

const MATIERE_FILTERS = [
  { id: "", label: "Tout" },
  { id: "math", label: "Maths" },
  { id: "pc", label: "Physique-Chimie" },
  { id: "svt", label: "SVT" },
];

const FILIERE_FILTERS = [
  { id: "", label: "Toutes" },
  { id: "C", label: "C" },
  { id: "D", label: "D" },
];

const MATIERE_TO_SUBJECT: Record<string, string> = {
  math: "math",
  pc: "physique",
  svt: "svt",
};

export default function Exercises() {
  const router = useRouter();
  const [items, setItems] = useState<ListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingId, setLoadingId] = useState<string | null>(null);

  const [q, setQ] = useState("");
  const [matiere, setMatiere] = useState("");
  const [filiere, setFiliere] = useState("");
  const [annee, setAnnee] = useState("");

  const fetchList = useCallback(async () => {
    const params = new URLSearchParams({ limit: "30" });
    if (matiere) params.set("matiere", matiere);
    if (filiere) params.set("filiere", filiere);
    if (annee) params.set("annee", annee);
    if (q.trim()) params.set("q", q.trim());
    try {
      const r = await api.get<{ items: ListItem[] }>(
        `/api/exercises?${params.toString()}`,
      );
      setItems(r.items ?? []);
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : "Erreur de chargement.";
      Alert.alert("Erreur", msg);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [matiere, filiere, annee, q]);

  useEffect(() => {
    void fetchList();
  }, [fetchList]);

  async function openExercise(item: ListItem) {
    setLoadingId(item.id);
    try {
      const full = await api.get<FullExercise>(
        `/api/exercises/${encodeURIComponent(item.id)}`,
      );
      setPending({
        exercise: full.ennonce_complet,
        subjectId: MATIERE_TO_SUBJECT[full.matiere_id] ?? "math",
        exerciseRefId: full.id,
      });
      router.push("/(tabs)/home");
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : "Erreur de chargement.";
      Alert.alert("Erreur", msg);
    } finally {
      setLoadingId(null);
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-slate-50" edges={["top"]}>
      <ScrollView
        contentContainerClassName="px-5 py-4 pb-12"
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              void fetchList();
            }}
          />
        }
      >
        <Text className="text-2xl font-bold text-slate-900 mb-1">
          Banque d'exercices
        </Text>
        <Text className="text-sm text-slate-500 mb-4">
          Sujets Bac C/D 2015-2025. Touche un exercice pour le charger dans
          l'éditeur d'indices.
        </Text>

        <TextInput
          value={q}
          onChangeText={setQ}
          onSubmitEditing={fetchList}
          returnKeyType="search"
          className="border border-slate-300 rounded-xl px-4 py-3 text-base bg-white text-slate-900 mb-3"
          placeholder="Rechercher dans les énoncés..."
          placeholderTextColor="#94a3b8"
          autoCapitalize="none"
        />

        <Text className="text-xs uppercase tracking-wide text-slate-500 mb-1 px-1">
          Matière
        </Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerClassName="gap-2 mb-2 pr-2"
        >
          {MATIERE_FILTERS.map((m) => (
            <Chip
              key={m.id || "all-m"}
              label={m.label}
              active={m.id === matiere}
              onPress={() => setMatiere(m.id)}
            />
          ))}
        </ScrollView>

        <Text className="text-xs uppercase tracking-wide text-slate-500 mb-1 px-1 mt-2">
          Filière
        </Text>
        <View className="flex-row gap-2 mb-2">
          {FILIERE_FILTERS.map((f) => (
            <Chip
              key={f.id || "all-f"}
              label={f.label}
              active={f.id === filiere}
              onPress={() => setFiliere(f.id)}
            />
          ))}
        </View>

        <Text className="text-xs uppercase tracking-wide text-slate-500 mb-1 px-1 mt-2">
          Année (optionnel)
        </Text>
        <TextInput
          value={annee}
          onChangeText={setAnnee}
          onSubmitEditing={fetchList}
          keyboardType="number-pad"
          maxLength={4}
          className="border border-slate-300 rounded-xl px-4 py-2.5 text-sm bg-white text-slate-900 mb-4 w-32"
          placeholder="ex: 2023"
          placeholderTextColor="#94a3b8"
        />

        {loading ? (
          <View className="py-10 items-center">
            <ActivityIndicator />
          </View>
        ) : items.length === 0 ? (
          <View className="bg-white border border-slate-200 rounded-xl p-5 items-center">
            <Text className="text-sm text-slate-500">Aucun résultat.</Text>
          </View>
        ) : (
          items.map((it) => (
            <Pressable
              key={it.id}
              onPress={() => openExercise(it)}
              disabled={loadingId !== null}
              className="bg-white border border-slate-200 rounded-xl p-4 mb-2 active:bg-slate-100"
            >
              <View className="flex-row items-center gap-2 mb-1.5 flex-wrap">
                <MatiereBadge id={it.matiere_id} />
                <Text className="text-xs text-slate-500">
                  {it.annee}
                  {it.session ? ` · ${it.session}` : ""}
                </Text>
                {it.filiere_id ? (
                  <Text className="text-xs text-slate-500">
                    · Bac {it.filiere_id}
                  </Text>
                ) : null}
                {it.exercice_numero !== undefined ? (
                  <Text className="text-xs text-slate-500">
                    · Ex. {String(it.exercice_numero)}
                  </Text>
                ) : null}
                {loadingId === it.id ? (
                  <ActivityIndicator size="small" />
                ) : null}
              </View>
              {it.titre ? (
                <Text className="text-sm font-medium text-slate-900 mb-1">
                  {it.titre}
                </Text>
              ) : null}
              {it.chapitre ? (
                <Text className="text-xs text-slate-600 mb-1">
                  {it.chapitre}
                </Text>
              ) : null}
              <Text
                className="text-sm text-slate-700"
                numberOfLines={3}
              >
                {it.ennonce_preview}
              </Text>
            </Pressable>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function Chip({
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
      className={`px-3 py-1.5 rounded-full border ${
        active ? "bg-brand border-brand" : "bg-white border-slate-300"
      }`}
    >
      <Text
        className={`text-sm ${active ? "text-white" : "text-slate-700"}`}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const MATIERE_BADGE: Record<string, string> = {
  math: "bg-blue-100 text-blue-700",
  pc: "bg-amber-100 text-amber-700",
  svt: "bg-emerald-100 text-emerald-700",
};

function MatiereBadge({ id }: { id: string }) {
  const cls = MATIERE_BADGE[id] ?? "bg-slate-100 text-slate-700";
  return (
    <View className={`px-2 py-0.5 rounded ${cls.split(" ")[0]}`}>
      <Text className={`text-xs font-medium uppercase ${cls.split(" ")[1]}`}>
        {id}
      </Text>
    </View>
  );
}
