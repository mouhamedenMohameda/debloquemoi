import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { SafeAreaView } from "react-native-safe-area-context";
import { ApiError, authApi } from "@/lib/api";
import { whatsappContactUrl } from "@/lib/contact";
import { useSession } from "@/lib/useSession";
import { useTranslation } from "@/lib/i18n";

// Canaux de paiement — alignés sur le web (app/src/app/topup/page.tsx).
const PAYMENT_CHANNELS = [
  { label: "Bankily", value: "42986738", icon: "📱" },
  { label: "Sedad", value: "32164356", icon: "💳" },
];

type TopupRequest = {
  id: number;
  status: "pending" | "approved" | "rejected";
  created_at: string | null;
  reviewed_at: string | null;
  credits_granted: number | null;
  granted_mru_approx: number | null;
  admin_note: string | null;
};

function fmtDate(iso: string | null, locale: string): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString(
      locale === "ar" ? "ar-MR" : "fr-FR",
      { day: "2-digit", month: "short", year: "numeric" },
    );
  } catch {
    return iso;
  }
}

function fmtMRU(v: number | undefined | null, locale: string): string {
  if (v === undefined || v === null) return "—";
  return v.toLocaleString(locale === "ar" ? "ar-MR" : "fr-FR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export default function Topup() {
  const { user, refresh } = useSession();
  const { t, locale } = useTranslation();
  const ar = locale === "ar";
  const STATUS_LABEL: Record<TopupRequest["status"], { text: string; cls: string }> = {
    pending: { text: t.topup.statusPending, cls: "bg-amber-50 text-amber-700" },
    approved: { text: t.topup.statusApproved, cls: "bg-emerald-50 text-emerald-700" },
    rejected: { text: t.topup.statusRejected, cls: "bg-red-50 text-red-700" },
  };
  const [requests, setRequests] = useState<TopupRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [uploading, setUploading] = useState(false);

  const fetchRequests = useCallback(async () => {
    try {
      const r = await authApi.get<{ requests: TopupRequest[] }>(
        "/api/credits/topup-requests/mine",
      );
      setRequests(r.requests ?? []);
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : (ar ? "خطأ في التحميل." : "Erreur de chargement.");
      Alert.alert(t.common.error, msg);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [ar, t]);

  useEffect(() => {
    void fetchRequests();
  }, [fetchRequests]);

  async function pickAndUpload() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert(
        ar ? "إذن مطلوب" : "Permission requise",
        ar ? "يلزم الوصول إلى المعرض." : "Accès à la galerie nécessaire.",
      );
      return;
    }
    const r = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.8,
    });
    if (r.canceled || !r.assets?.[0]) return;
    await uploadProof(r.assets[0]);
  }

  async function takeAndUpload() {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert(
        ar ? "إذن مطلوب" : "Permission requise",
        ar ? "يلزم الوصول إلى الكاميرا." : "Accès à la caméra nécessaire.",
      );
      return;
    }
    const r = await ImagePicker.launchCameraAsync({ quality: 0.8 });
    if (r.canceled || !r.assets?.[0]) return;
    await uploadProof(r.assets[0]);
  }

  async function uploadProof(asset: ImagePicker.ImagePickerAsset) {
    setUploading(true);
    try {
      const form = new FormData();
      // Le backend (FastAPI) valide via Path(filename).suffix dans la liste
      // {png, jpg, webp, gif}. iOS peut renvoyer HEIC depuis la galerie : on
      // force un nom en .jpg pour passer la validation (les bytes restent
      // lus tels quels par le serveur, les navigateurs admin gèrent HEIC).
      const name = `proof_${Date.now()}.jpg`;
      const type = "image/jpeg";
      // React Native attend cette forme pour FormData files.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      form.append("file", { uri: asset.uri, name, type } as any);
      await authApi.postForm("/api/credits/topup-requests", form);
      Alert.alert(
        ar ? "تم إرسال الطلب" : "Demande envoyée",
        ar
          ? "سيتحقق المسؤول من إثباتك قريباً."
          : "Un administrateur va vérifier ta preuve sous peu.",
      );
      await fetchRequests();
      await refresh();
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : (ar ? "فشل الإرسال." : "Envoi échoué.");
      Alert.alert(t.common.error, msg);
    } finally {
      setUploading(false);
    }
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
              void fetchRequests();
            }}
          />
        }
      >
        <Text className="text-2xl font-bold text-slate-900 mb-1">
          {t.nav.topup}
        </Text>
        <Text className="text-sm text-slate-500 mb-4">
          {ar
            ? "أرسل إثبات الدفع (لقطة شاشة أو صورة الإيصال). سيقوم المسؤول بشحن حسابك بعد التحقق."
            : "Envoie une preuve de paiement (capture ou photo du reçu). Un admin créditera ton compte après vérification."}
        </Text>

        {/* Solde courant */}
        {user ? (
          <View className="bg-white border border-slate-200 rounded-xl p-4 mb-4">
            <Text className="text-xs uppercase tracking-wide text-slate-500 mb-1">
              {t.topup.subtitle}
            </Text>
            <Text className="text-2xl font-bold text-slate-900">
              {fmtMRU(user.balance_mru, locale)} {t.common.mru}
            </Text>
            {user.credits_expire_at ? (
              <Text className="text-xs text-slate-500 mt-1">
                {t.topup.validUntil} {fmtDate(user.credits_expire_at, locale)}
              </Text>
            ) : null}
            {user.credits_blocked_reason ? (
              <Text className="text-xs text-red-600 mt-1">
                {t.topup.blockedReason} {user.credits_blocked_reason}
              </Text>
            ) : null}
          </View>
        ) : null}

        {/* Comment recharger : où envoyer l'argent */}
        <View className="bg-white border border-slate-200 rounded-xl p-4 mb-4">
          <Text className="text-base font-bold text-slate-900 mb-2">
            {t.topup.howToTitle}
          </Text>
          <Text className="text-sm text-slate-700 mb-2">
            {t.topup.howToStep1}
          </Text>
          <View className="gap-1.5 mb-3">
            {PAYMENT_CHANNELS.map((c) => (
              <View
                key={c.label}
                className="flex-row items-center gap-2 bg-slate-50 rounded-lg px-3 py-2"
              >
                <Text style={{ fontSize: 14 }}>{c.icon}</Text>
                <Text className="text-xs font-semibold text-slate-500">
                  {c.label}
                </Text>
                <View className="flex-1" />
                <Text
                  selectable
                  className="text-base font-bold text-slate-800"
                  style={{ fontVariant: ["tabular-nums"] }}
                >
                  {c.value}
                </Text>
              </View>
            ))}
          </View>
          <Text className="text-sm text-slate-700 mb-1.5">
            {t.topup.howToStep2}
          </Text>
          <Text className="text-sm text-slate-700">{t.topup.howToStep3}</Text>
        </View>

        {/* Contact support WhatsApp */}
        <Pressable
          onPress={() =>
            Linking.openURL(whatsappContactUrl(t.topup.contactWhatsappMsg))
          }
          className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 mb-5 flex-row items-center justify-between active:bg-emerald-100"
        >
          <View className="flex-1 pr-3">
            <Text className="text-sm font-bold text-emerald-900">
              {t.topup.contactTitle}
            </Text>
            <Text className="text-xs text-emerald-700 mt-0.5">
              {t.topup.contactBtn}
            </Text>
          </View>
          <Text style={{ fontSize: 22 }}>💬</Text>
        </Pressable>

        <View className="bg-white border border-slate-200 rounded-xl p-4 mb-5">
          <Text className="text-xs uppercase tracking-wide text-slate-500 mb-3">
            {t.topup.sendProofTitle}
          </Text>
          <View className="flex-row gap-2">
            <Pressable
              onPress={takeAndUpload}
              disabled={uploading}
              className="flex-1 bg-white border border-slate-300 rounded-xl py-3 items-center active:bg-slate-100 disabled:opacity-60"
            >
              {uploading ? (
                <ActivityIndicator color="#2563eb" />
              ) : (
                <Text className="text-slate-700 text-sm font-medium">
                  {ar ? "📷 صورة" : "📷 Photo"}
                </Text>
              )}
            </Pressable>
            <Pressable
              onPress={pickAndUpload}
              disabled={uploading}
              className="flex-1 bg-brand rounded-xl py-3 items-center active:bg-brand-dark disabled:opacity-60"
            >
              <Text className="text-white text-sm font-medium">
                {ar ? "🖼️ المعرض" : "🖼️ Galerie"}
              </Text>
            </Pressable>
          </View>
        </View>

        <Text className="text-xs uppercase tracking-wide text-slate-500 mb-2 px-1">
          {t.topup.myRequestsTitle}
        </Text>

        {loading ? (
          <View className="py-8 items-center">
            <ActivityIndicator />
          </View>
        ) : requests.length === 0 ? (
          <View className="bg-white border border-slate-200 rounded-xl p-4 items-center">
            <Text className="text-sm text-slate-500">
              {t.topup.emptyRequests}
            </Text>
          </View>
        ) : (
          requests.map((r) => {
            const s = STATUS_LABEL[r.status];
            return (
              <View
                key={r.id}
                className="bg-white border border-slate-200 rounded-xl p-4 mb-2"
              >
                <View className="flex-row justify-between items-start mb-2">
                  <Text className="text-sm font-medium text-slate-900">
                    {t.topup.requestLabel.replace("{id}", String(r.id))}
                  </Text>
                  <View className={`px-2 py-0.5 rounded-full ${s.cls.split(" ")[0]}`}>
                    <Text className={`text-xs font-medium ${s.cls.split(" ")[1]}`}>
                      {s.text}
                    </Text>
                  </View>
                </View>
                <Text className="text-xs text-slate-500 mb-1">
                  {t.topup.requestSent.replace(
                    "{date}",
                    fmtDate(r.created_at, locale),
                  )}
                </Text>
                {r.status !== "pending" ? (
                  <Text className="text-xs text-slate-500">
                    {t.topup.requestReviewed.replace(
                      "{date}",
                      fmtDate(r.reviewed_at, locale),
                    )}
                  </Text>
                ) : null}
                {r.status === "approved" && r.granted_mru_approx ? (
                  <Text className="text-sm text-emerald-700 mt-2">
                    + {r.granted_mru_approx.toFixed(2)} MRU{" "}
                    {ar ? "تم إضافتها" : "crédités"}
                  </Text>
                ) : null}
                {r.admin_note ? (
                  <Text className="text-xs text-slate-600 mt-2 italic">
                    {ar ? "ملاحظة المسؤول: " : "Note admin : "}
                    {r.admin_note}
                  </Text>
                ) : null}
              </View>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
