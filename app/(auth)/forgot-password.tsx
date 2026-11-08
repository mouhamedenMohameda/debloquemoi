import { Link, useRouter } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ApiError, authApi } from "@/lib/api";
import { useTranslation } from "@/lib/i18n";

export default function ForgotPassword() {
  const router = useRouter();
  const { t, locale } = useTranslation();
  const ar = locale === "ar";
  const [email, setEmail] = useState("");
  const [nni, setNni] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit() {
    setError(null);
    const e = email.trim();
    const n = nni.trim();
    const w = whatsapp.trim();
    if (!e || !n || !w || !newPassword) {
      setError(
        ar ? "جميع الحقول مطلوبة." : "Tous les champs sont obligatoires.",
      );
      return;
    }
    if (!e.includes("@") || !e.includes(".")) {
      setError(
        ar
          ? "بريد إلكتروني غير صالح (مثال: tu@exemple.com)."
          : "Email invalide (ex: tu@exemple.com).",
      );
      return;
    }
    if (newPassword.length < 8) {
      setError(t.auth.passwordMinLength);
      return;
    }
    setPending(true);
    try {
      await authApi.post<{ message: string }>("/api/auth/reset-password", {
        email: e.toLowerCase(),
        nni: n,
        whatsapp: w,
        new_password: newPassword,
      });
      Alert.alert(
        ar ? "تم تحديث كلمة المرور" : "Mot de passe mis à jour",
        ar
          ? "يمكنك تسجيل الدخول بالجديدة."
          : "Tu peux te connecter avec le nouveau.",
        [{ text: "OK", onPress: () => router.replace("/(auth)/login") }],
      );
    } catch (err) {
      const msg = err instanceof ApiError
        ? err.message
        : (ar ? "فشلت إعادة التعيين." : "Réinitialisation échouée.");
      setError(msg);
    } finally {
      setPending(false);
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-white">
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerClassName="flex-grow px-6 py-8"
          keyboardShouldPersistTaps="handled"
        >
          <Text className="text-3xl font-bold text-slate-900 mb-2">
            {ar ? "نسيت كلمة المرور" : "Mot de passe oublié"}
          </Text>
          <Text className="text-base text-slate-500 mb-8">
            {ar
              ? "أدخل بالضبط المعلومات المسجلة عند الإنشاء لتعيين كلمة مرور جديدة."
              : "Saisis exactement les informations enregistrées lors de l'inscription pour définir un nouveau mot de passe."}
          </Text>

          <Field
            label={t.auth.fieldEmail}
            value={email}
            onChangeText={setEmail}
            placeholder="tu@exemple.com"
            keyboardType="email-address"
            autoCapitalize="none"
          />
          <Field
            label={t.auth.fieldNni}
            value={nni}
            onChangeText={setNni}
            placeholder={t.auth.fieldNniPlaceholder}
            keyboardType="number-pad"
          />
          <Field
            label={t.auth.fieldWhatsapp}
            value={whatsapp}
            onChangeText={setWhatsapp}
            placeholder={t.auth.fieldWhatsappPlaceholder}
            keyboardType="phone-pad"
          />
          <Field
            label={ar ? "كلمة مرور جديدة (8 على الأقل)" : "Nouveau mot de passe (8 caractères min.)"}
            value={newPassword}
            onChangeText={setNewPassword}
            placeholder="••••••••"
            secureTextEntry
          />

          {error ? (
            <View className="rounded-xl border border-red-200 bg-red-50 p-3 mb-3">
              <Text className="text-sm text-red-700">⚠️ {error}</Text>
            </View>
          ) : null}

          <Pressable
            onPress={onSubmit}
            disabled={pending}
            className="bg-brand rounded-xl py-4 items-center active:bg-brand-dark disabled:opacity-60 mt-1 mb-4"
          >
            {pending ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text className="text-white font-semibold text-base">
                {ar ? "إعادة تعيين" : "Réinitialiser"}
              </Text>
            )}
          </Pressable>

          <View className="flex-row justify-center items-center">
            <Link href="/(auth)/login" asChild>
              <Pressable hitSlop={8}>
                <Text className="text-brand text-sm font-medium">
                  {ar ? "العودة لتسجيل الدخول" : "Retour à la connexion"}
                </Text>
              </Pressable>
            </Link>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

type FieldProps = {
  label: string;
  value: string;
  onChangeText: (s: string) => void;
  placeholder: string;
  keyboardType?: "default" | "email-address" | "number-pad" | "phone-pad";
  autoCapitalize?: "none" | "characters" | "words" | "sentences";
  secureTextEntry?: boolean;
};

function Field(props: FieldProps) {
  return (
    <View className="mb-4">
      <Text className="text-sm font-medium text-slate-700 mb-1">
        {props.label}
      </Text>
      <TextInput
        value={props.value}
        onChangeText={props.onChangeText}
        autoCapitalize={props.autoCapitalize ?? "none"}
        autoCorrect={false}
        keyboardType={props.keyboardType ?? "default"}
        secureTextEntry={props.secureTextEntry}
        placeholder={props.placeholder}
        placeholderTextColor="#94a3b8"
        className="border border-slate-300 rounded-xl px-4 py-3 text-base text-slate-900"
      />
    </View>
  );
}
