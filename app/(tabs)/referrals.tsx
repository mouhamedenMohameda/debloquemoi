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
import { useTranslation } from "@/lib/i18n";

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
  const { t, locale } = useTranslation();
  const ar = locale === "ar";
  const [info, setInfo] = useState<ReferralInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchInfo = useCallback(async () => {
    try {
      const r = await authApi.get<ReferralInfo>("/api/referrals/me");
      setInfo(r);
    } catch (e) {
      const msg = e instanceof ApiError
        ? e.message
        : (ar ? "خطأ في التحميل." : "Erreur de chargement.");
      Alert.alert(t.common.error, msg);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [ar, t]);

  useEffect(() => {
    void fetchInfo();
  }, [fetchInfo]);

  async function copyCode() {
    if (!info?.referral_code) return;
    await Clipboard.setStringAsync(info.referral_code);
    Alert.alert(
      t.common.copied,
      ar
        ? `تم نسخ الرمز ${info.referral_code}.`
        : `Code ${info.referral_code} copié.`,
    );
  }

  async function shareLink() {
    if (!info?.share_url && !info?.referral_code) return;
    const url = info.share_url ?? "";
    const code = info.referral_code ?? "";
    const message = t.referrals.shareMessage.replace("{code}", code) +
      (url ? ` ${url}` : "");
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
          {t.referrals.title}
        </Text>
        <Text className="text-sm text-slate-500 mb-5">
          {t.referrals.subtitle}
        </Text>

        <View className="bg-white border border-slate-200 rounded-xl p-5 mb-4 items-center">
          <Text className="text-xs uppercase tracking-wide text-slate-500 mb-2">
            {t.referrals.yourCode}
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
                {t.common.copy}
              </Text>
            </Pressable>
            <Pressable
              onPress={shareLink}
              disabled={!info?.referral_code}
              className="flex-1 bg-brand rounded-xl py-3 items-center active:bg-brand-dark disabled:opacity-60"
            >
              <Text className="text-white text-sm font-medium">
                {ar ? "مشاركة" : "Partager"}
              </Text>
            </Pressable>
          </View>
        </View>

        <View className="flex-row gap-3 mb-4">
          <Stat
            label={t.referrals.statReferredCount}
            value={`${info?.referred_count ?? 0}`}
          />
          <Stat
            label={t.referrals.statPaidCount}
            value={`${info?.paid_referred_count ?? 0}`}
          />
        </View>

        <View className="bg-white border border-slate-200 rounded-xl p-4">
          <Text className="text-xs uppercase tracking-wide text-slate-500 mb-3">
            {t.referrals.howItWorksTitle}
          </Text>
          <Row
            label={
              ar ? "لكل تسجيل" : "Pour chaque inscription"
            }
            value={`${info?.bonus_signup_mru?.toFixed(2) ?? "0.00"} MRU`}
          />
          <Row
            label={
              ar
                ? "عندما يشحن صديقك"
                : "Quand ton filleul recharge"
            }
            value={t.referrals.howItWorksBonusReferrer.replace(
              "{amount}",
              info?.bonus_paid_mru_referrer?.toFixed(2) ?? "0.00",
            )}
          />
          <Row
            label={
              ar ? "مكافأة لصديقك" : "Bonus pour ton filleul"
            }
            value={t.referrals.howItWorksBonusReferred.replace(
              "{amount}",
              info?.bonus_paid_mru_referred?.toFixed(2) ?? "0.00",
            )}
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
