import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import {
  deleteSession,
  loadSessions,
  relativeTime,
  sessionTitle,
  type SavedSession,
} from "@/lib/history";
import { setPendingSession } from "@/lib/historyStore";
import { useSession } from "@/lib/useSession";
import { getSubject } from "@/lib/subjects";

export default function History() {
  const router = useRouter();
  const { user } = useSession();
  const [sessions, setSessions] = useState<SavedSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchSessions = useCallback(async () => {
    if (!user?.email) {
      setSessions([]);
      setLoading(false);
      setRefreshing(false);
      return;
    }
    const r = await loadSessions(user.email);
    setSessions(r);
    setLoading(false);
    setRefreshing(false);
  }, [user?.email]);

  useFocusEffect(
    useCallback(() => {
      void fetchSessions();
    }, [fetchSessions]),
  );

  function openSession(s: SavedSession) {
    setPendingSession(s);
    router.push("/(tabs)/home");
  }

  function confirmDelete(s: SavedSession) {
    Alert.alert(
      "Supprimer cette session ?",
      "L'historique local sera effacé. L'action est irréversible.",
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Supprimer",
          style: "destructive",
          onPress: async () => {
            if (!user?.email) return;
            const next = await deleteSession(user.email, s.id);
            setSessions(next);
          },
        },
      ],
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-slate-50" edges={["top"]}>
      <ScrollView
        contentContainerClassName="px-5 py-4 pb-12"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              void fetchSessions();
            }}
          />
        }
      >
        <Text className="text-2xl font-bold text-slate-900 mb-1">
          Mes sessions
        </Text>
        <Text className="text-sm text-slate-500 mb-5">
          Tes exercices et indices récents (stockés sur ce téléphone).
        </Text>

        {loading ? (
          <View className="py-10 items-center">
            <ActivityIndicator />
          </View>
        ) : sessions.length === 0 ? (
          <View className="bg-white border border-slate-200 rounded-xl p-5 items-center">
            <Text className="text-base text-slate-700 mb-1">
              Aucune session pour l'instant.
            </Text>
            <Text className="text-sm text-slate-500 text-center">
              Demande un premier indice depuis l'Accueil pour commencer.
            </Text>
          </View>
        ) : (
          sessions.map((s) => (
            <SessionRow
              key={s.id}
              session={s}
              onPress={() => openSession(s)}
              onLongPress={() => confirmDelete(s)}
            />
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function SessionRow({
  session,
  onPress,
  onLongPress,
}: {
  session: SavedSession;
  onPress: () => void;
  onLongPress: () => void;
}) {
  const subject = getSubject(session.subjectId);
  const lastHint = session.hints.at(-1);
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={400}
      className="bg-white border border-slate-200 rounded-xl p-4 mb-2 active:bg-slate-100"
    >
      <View className="flex-row items-center gap-2 mb-1 flex-wrap">
        {subject ? (
          <View className="bg-slate-100 rounded px-2 py-0.5 flex-row items-center gap-1">
            <Text style={{ fontSize: 12 }}>{subject.emoji}</Text>
            <Text className="text-xs text-slate-700 font-medium">
              {subject.shortName}
            </Text>
          </View>
        ) : null}
        {session.mode === "explain" ? (
          <View className="bg-indigo-50 rounded px-2 py-0.5">
            <Text className="text-xs text-indigo-700 font-medium">
              Explication
            </Text>
          </View>
        ) : null}
        {session.focusQuestion ? (
          <View className="bg-amber-50 rounded px-2 py-0.5">
            <Text className="text-xs text-amber-700 font-medium">
              {session.focusQuestion}
            </Text>
          </View>
        ) : null}
        <Text className="text-xs text-slate-400 ml-auto">
          {relativeTime(session.updatedAt)}
        </Text>
      </View>

      <Text
        className="text-sm text-slate-900 leading-5 mb-1"
        numberOfLines={2}
      >
        {sessionTitle(session)}
      </Text>

      <View className="flex-row items-center gap-2 mt-1">
        <Text className="text-xs text-slate-500">
          {session.hints.length} indice
          {session.hints.length > 1 ? "s" : ""}
        </Text>
        {lastHint ? (
          <Text className="text-xs text-slate-400">
            · dernier : niveau {lastHint.level}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}
