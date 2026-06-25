import { useRouter } from "expo-router";
import {
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useState } from "react";
import { useSession } from "@/lib/useSession";

function fmtMRU(v?: number): string {
  if (v === undefined || v === null) return "—";
  return v.toLocaleString("fr-FR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function fmtDate(iso?: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

export default function Profile() {
  const router = useRouter();
  const { user, logout, refresh } = useSession();
  const [refreshing, setRefreshing] = useState(false);

  async function onRefresh() {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  }

  function confirmLogout() {
    Alert.alert("Déconnexion", "Confirmer ?", [
      { text: "Annuler", style: "cancel" },
      {
        text: "Déconnexion",
        style: "destructive",
        onPress: async () => {
          await logout();
          router.replace("/(auth)/login");
        },
      },
    ]);
  }

  return (
    <SafeAreaView className="flex-1 bg-slate-50" edges={["top"]}>
      <ScrollView
        contentContainerClassName="px-5 py-4 pb-12"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <Text className="text-2xl font-bold text-slate-900 mb-5">Profil</Text>

        <Card title="Compte">
          <Row label="Email" value={user?.email ?? "—"} />
          <Row label="NNI" value={user?.nni_masked ?? "—"} />
          <Row label="WhatsApp" value={user?.whatsapp_masked ?? "—"} />
          {user?.is_admin ? (
            <Row label="Rôle" value="Administrateur" valueClass="text-brand" />
          ) : null}
        </Card>

        <Card title="Portefeuille">
          <Row
            label="Solde"
            value={`${fmtMRU(user?.balance_mru)} MRU`}
            big
          />
          <Row
            label="Expire le"
            value={fmtDate(user?.credits_expire_at)}
          />
          {user?.credits_blocked_reason ? (
            <View className="mt-2 bg-red-50 border border-red-200 rounded-lg p-3">
              <Text className="text-sm text-red-700">
                {user.credits_blocked_reason}
              </Text>
            </View>
          ) : null}
        </Card>

        <Card title="Indices gratuits">
          <Row
            label="Restants"
            value={`${user?.free_hints_remaining ?? 0}`}
            big
          />
          <Row
            label="Expirent le"
            value={fmtDate(user?.free_hints_expires_at)}
          />
        </Card>

        <Pressable
          onPress={() => router.push("/(tabs)/referrals")}
          className="bg-white border border-slate-200 rounded-xl px-4 py-3.5 flex-row justify-between items-center mb-3 active:bg-slate-50"
        >
          <View>
            <Text className="text-base font-medium text-slate-900">
              🎁 Parrainage
            </Text>
            <Text className="text-xs text-slate-500 mt-0.5">
              Ton code, tes filleuls, tes récompenses.
            </Text>
          </View>
          <Text className="text-slate-400">›</Text>
        </Pressable>

        <Pressable
          onPress={confirmLogout}
          className="bg-white border border-red-200 rounded-xl py-3.5 items-center active:bg-red-50 mt-2"
        >
          <Text className="text-red-600 text-sm font-medium">
            Se déconnecter
          </Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

function Card({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <View className="bg-white border border-slate-200 rounded-xl p-4 mb-4">
      <Text className="text-xs uppercase tracking-wide text-slate-500 mb-3">
        {title}
      </Text>
      {children}
    </View>
  );
}

function Row({
  label,
  value,
  big = false,
  valueClass,
}: {
  label: string;
  value: string;
  big?: boolean;
  valueClass?: string;
}) {
  return (
    <View className="flex-row justify-between items-baseline py-1.5">
      <Text className="text-sm text-slate-600">{label}</Text>
      <Text
        className={`${big ? "text-lg font-semibold" : "text-sm"} text-slate-900 ${valueClass ?? ""}`}
      >
        {value}
      </Text>
    </View>
  );
}
