import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  Share,
  Text,
  View,
} from "react-native";
import * as Clipboard from "expo-clipboard";
import { SafeAreaView } from "react-native-safe-area-context";
import { ApiError, authApi } from "@/lib/api";

type ReferralInfo = {
  referral_code: string | null;
  share_url: string | null;
  referred_count: number;
  paid_referred_count: number;
  bonus_signup_mru: number;
  bonus_paid_mru_referrer: number;
  bonus_paid_mru_referred: number;
};

export default function Referrals() {
  const [info, setInfo] = useState<ReferralInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchInfo = useCallback(async () => {
    try {
      const r = await authApi.get<ReferralInfo>("/api/referrals/me");
      setInfo(r);
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : "Erreur de chargement.";
      Alert.alert("Erreur", msg);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void fetchInfo();
  }, [fetchInfo]);

  async function copyCode() {
    if (!info?.referral_code) return;
    await Clipboard.setStringAsync(info.referral_code);
    Alert.alert("Copié", `Code ${info.referral_code} copié.`);
  }

  async function shareLink() {
    if (!info?.share_url && !info?.referral_code) return;
    const url = info.share_url ?? "";
    const code = info.referral_code ?? "";
    const message = `Rejoins Débloque-moi avec mon code ${code} et reçois des indices gratuits ! ${url}`;
    try {
      await Share.share({ message, url: url || undefined });
    } catch {
      // user cancelled
    }
  }

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-slate-50 items-center justify-center">
        <ActivityIndicator size="large" />
      </SafeAreaView>
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
              void fetchInfo();
            }}
          />
        }
      >
        <Text className="text-2xl font-bold text-slate-900 mb-1">
          Parrainage
        </Text>
        <Text className="text-sm text-slate-500 mb-5">
          Invite tes amis et gagne des MRU à chaque inscription / paiement.
        </Text>

        <View className="bg-white border border-slate-200 rounded-xl p-5 mb-4 items-center">
          <Text className="text-xs uppercase tracking-wide text-slate-500 mb-2">
            Ton code
          </Text>
          <Text className="text-3xl font-bold text-brand mb-3 tracking-widest">
            {info?.referral_code ?? "—"}
          </Text>
          <View className="flex-row gap-2 w-full">
            <Pressable
              onPress={copyCode}
              disabled={!info?.referral_code}
              className="flex-1 bg-white border border-slate-300 rounded-xl py-3 items-center active:bg-slate-100 disabled:opacity-60"
            >
              <Text className="text-slate-700 text-sm font-medium">
                Copier
              </Text>
            </Pressable>
            <Pressable
              onPress={shareLink}
              disabled={!info?.referral_code}
              className="flex-1 bg-brand rounded-xl py-3 items-center active:bg-brand-dark disabled:opacity-60"
            >
              <Text className="text-white text-sm font-medium">Partager</Text>
            </Pressable>
          </View>
        </View>

        <View className="flex-row gap-3 mb-4">
          <Stat label="Inscrits" value={`${info?.referred_count ?? 0}`} />
          <Stat
            label="Payants"
            value={`${info?.paid_referred_count ?? 0}`}
          />
        </View>

        <View className="bg-white border border-slate-200 rounded-xl p-4">
          <Text className="text-xs uppercase tracking-wide text-slate-500 mb-3">
            Récompenses
          </Text>
          <Row
            label="Pour chaque inscription"
            value={`${info?.bonus_signup_mru?.toFixed(2) ?? "0.00"} MRU`}
          />
          <Row
            label="Quand ton filleul recharge"
            value={`+${info?.bonus_paid_mru_referrer?.toFixed(2) ?? "0.00"} MRU pour toi`}
          />
          <Row
            label="Bonus pour ton filleul"
            value={`+${info?.bonus_paid_mru_referred?.toFixed(2) ?? "0.00"} MRU`}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-1 bg-white border border-slate-200 rounded-xl p-4">
      <Text className="text-xs uppercase tracking-wide text-slate-500 mb-1">
        {label}
      </Text>
      <Text className="text-2xl font-bold text-slate-900">{value}</Text>
    </View>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row justify-between items-baseline py-1.5">
      <Text className="text-sm text-slate-600 flex-1 pr-3">{label}</Text>
      <Text className="text-sm text-slate-900 font-medium">{value}</Text>
    </View>
  );
}
