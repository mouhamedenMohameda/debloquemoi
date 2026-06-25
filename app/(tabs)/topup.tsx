import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { SafeAreaView } from "react-native-safe-area-context";
import { ApiError, authApi } from "@/lib/api";
import { useSession } from "@/lib/useSession";

type TopupRequest = {
  id: number;
  status: "pending" | "approved" | "rejected";
  created_at: string | null;
  reviewed_at: string | null;
  credits_granted: number | null;
  granted_mru_approx: number | null;
  admin_note: string | null;
};

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

const STATUS_LABEL: Record<TopupRequest["status"], { text: string; cls: string }> = {
  pending: { text: "En attente", cls: "bg-amber-50 text-amber-700" },
  approved: { text: "Approuvée", cls: "bg-emerald-50 text-emerald-700" },
  rejected: { text: "Refusée", cls: "bg-red-50 text-red-700" },
};

export default function Topup() {
  const { refresh } = useSession();
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
      const msg = e instanceof ApiError ? e.message : "Erreur de chargement.";
      Alert.alert("Erreur", msg);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void fetchRequests();
  }, [fetchRequests]);

  async function pickAndUpload() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("Permission requise", "Accès à la galerie nécessaire.");
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
      Alert.alert("Permission requise", "Accès à la caméra nécessaire.");
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
      const name = asset.fileName ?? `proof_${Date.now()}.jpg`;
      const type = asset.mimeType ?? "image/jpeg";
      // React Native attend cette forme pour FormData files.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      form.append("file", { uri: asset.uri, name, type } as any);
      await authApi.postForm("/api/credits/topup-requests", form);
      Alert.alert(
        "Demande envoyée",
        "Un administrateur va vérifier ta preuve sous peu.",
      );
      await fetchRequests();
      await refresh();
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : "Envoi échoué.";
      Alert.alert("Erreur", msg);
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
          Recharger
        </Text>
        <Text className="text-sm text-slate-500 mb-5">
          Envoie une preuve de paiement (capture ou photo du reçu). Un admin
          créditera ton compte après vérification.
        </Text>

        <View className="bg-white border border-slate-200 rounded-xl p-4 mb-5">
          <Text className="text-xs uppercase tracking-wide text-slate-500 mb-3">
            Nouvelle demande
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
                  📷 Photo
                </Text>
              )}
            </Pressable>
            <Pressable
              onPress={pickAndUpload}
              disabled={uploading}
              className="flex-1 bg-brand rounded-xl py-3 items-center active:bg-brand-dark disabled:opacity-60"
            >
              <Text className="text-white text-sm font-medium">
                🖼️ Galerie
              </Text>
            </Pressable>
          </View>
        </View>

        <Text className="text-xs uppercase tracking-wide text-slate-500 mb-2 px-1">
          Tes demandes
        </Text>

        {loading ? (
          <View className="py-8 items-center">
            <ActivityIndicator />
          </View>
        ) : requests.length === 0 ? (
          <View className="bg-white border border-slate-200 rounded-xl p-4 items-center">
            <Text className="text-sm text-slate-500">
              Aucune demande pour l'instant.
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
                    Demande #{r.id}
                  </Text>
                  <View className={`px-2 py-0.5 rounded-full ${s.cls.split(" ")[0]}`}>
                    <Text className={`text-xs font-medium ${s.cls.split(" ")[1]}`}>
                      {s.text}
                    </Text>
                  </View>
                </View>
                <Text className="text-xs text-slate-500 mb-1">
                  Envoyée le {fmtDate(r.created_at)}
                </Text>
                {r.status !== "pending" ? (
                  <Text className="text-xs text-slate-500">
                    Traitée le {fmtDate(r.reviewed_at)}
                  </Text>
                ) : null}
                {r.status === "approved" && r.granted_mru_approx ? (
                  <Text className="text-sm text-emerald-700 mt-2">
                    + {r.granted_mru_approx.toFixed(2)} MRU crédités
                  </Text>
                ) : null}
                {r.admin_note ? (
                  <Text className="text-xs text-slate-600 mt-2 italic">
                    Note admin : {r.admin_note}
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
