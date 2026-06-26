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
import { useTranslation } from "@/lib/i18n";

function fmtMRU(v: number | undefined, locale: string): string {
  if (v === undefined || v === null) return "—";
  return v.toLocaleString(locale === "ar" ? "ar-MR" : "fr-FR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function fmtDate(iso: string | undefined | null, locale: string): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString(
      locale === "ar" ? "ar-MR" : "fr-FR",
      { day: "2-digit", month: "long", year: "numeric" },
    );
  } catch {
    return iso;
  }
}

export default function Profile() {
  const router = useRouter();
  const { user, logout, refresh } = useSession();
  const { t, locale, setLocale } = useTranslation();
  const [refreshing, setRefreshing] = useState(false);

  async function onRefresh() {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  }

  function confirmLogout() {
    Alert.alert(
      t.nav.logout,
      t.nav.confirmLogout,
      [
        { text: t.common.cancel, style: "cancel" },
        {
          text: t.nav.logout,
          style: "destructive",
          onPress: async () => {
            await logout();
            router.replace("/(auth)/login");
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
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <Text className="text-2xl font-bold text-slate-900 mb-5">
          {t.nav.profile}
        </Text>

        <Card title={locale === "ar" ? "الحساب" : "Compte"}>
          <Row label="Email" value={user?.email ?? "—"} />
          <Row label="NNI" value={user?.nni_masked ?? "—"} />
          <Row label="WhatsApp" value={user?.whatsapp_masked ?? "—"} />
          {user?.is_admin ? (
            <Row
              label={locale === "ar" ? "الدور" : "Rôle"}
              value={locale === "ar" ? "مدير" : "Administrateur"}
              valueClass="text-brand"
            />
          ) : null}
        </Card>

        <Card title={locale === "ar" ? "المحفظة" : "Portefeuille"}>
          <Row
            label={locale === "ar" ? "الرصيد" : "Solde"}
            value={`${fmtMRU(user?.balance_mru, locale)} MRU`}
            big
          />
          <Row
            label={locale === "ar" ? "تنتهي في" : "Expire le"}
            value={fmtDate(user?.credits_expire_at, locale)}
          />
          {user?.credits_blocked_reason ? (
            <View className="mt-2 bg-red-50 border border-red-200 rounded-lg p-3">
              <Text className="text-sm text-red-700">
                {user.credits_blocked_reason}
              </Text>
            </View>
          ) : null}
        </Card>

        <Card title={locale === "ar" ? "تلميحات مجانية" : "Indices gratuits"}>
          <Row
            label={locale === "ar" ? "المتبقي" : "Restants"}
            value={`${user?.free_hints_remaining ?? 0}`}
            big
          />
          <Row
            label={locale === "ar" ? "تنتهي في" : "Expirent le"}
            value={fmtDate(user?.free_hints_expires_at, locale)}
          />
        </Card>

        <Card title={locale === "ar" ? "اللغة" : "Langue"}>
          <View className="flex-row gap-2">
            <LangBtn
              label="Français"
              active={locale === "fr"}
              onPress={() => setLocale("fr")}
            />
            <LangBtn
              label="العربية"
              active={locale === "ar"}
              onPress={() => setLocale("ar")}
            />
          </View>
        </Card>

        <Pressable
          onPress={() => router.push("/(tabs)/referrals")}
          className="bg-white border border-slate-200 rounded-xl px-4 py-3.5 flex-row justify-between items-center mb-3 active:bg-slate-50"
        >
          <View>
            <Text className="text-base font-medium text-slate-900">
              🎁 {t.nav.referrals}
            </Text>
            <Text className="text-xs text-slate-500 mt-0.5">
              {locale === "ar"
                ? "رمزك، إحالاتك، مكافآتك."
                : "Ton code, tes filleuls, tes récompenses."}
            </Text>
          </View>
          <Text className="text-slate-400">›</Text>
        </Pressable>

        <Pressable
          onPress={confirmLogout}
          className="bg-white border border-red-200 rounded-xl py-3.5 items-center active:bg-red-50 mt-2"
        >
          <Text className="text-red-600 text-sm font-medium">
            {t.nav.logout}
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

function LangBtn({
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
      className={`flex-1 py-2.5 rounded-xl border items-center ${
        active ? "bg-brand border-brand" : "bg-white border-slate-300"
      }`}
    >
      <Text
        className={`text-sm font-medium ${active ? "text-white" : "text-slate-700"}`}
      >
        {label}
      </Text>
    </Pressable>
  );
}
