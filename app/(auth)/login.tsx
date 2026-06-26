import { Link, useRouter } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ApiError } from "@/lib/api";
import { useSession } from "@/lib/useSession";
import { useTranslation } from "@/lib/i18n";

export default function Login() {
  const router = useRouter();
  const { login } = useSession();
  const { t, locale } = useTranslation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit() {
    setError(null);
    const e = email.trim();
    if (!e || !password) {
      setError(
        locale === "ar"
          ? "البريد الإلكتروني وكلمة المرور مطلوبان."
          : "Email et mot de passe requis.",
      );
      return;
    }
    if (!e.includes("@") || !e.includes(".")) {
      setError(
        locale === "ar"
          ? "بريد إلكتروني غير صالح (مثال: tu@exemple.com)."
          : "Email invalide (ex: tu@exemple.com).",
      );
      return;
    }
    setPending(true);
    try {
      await login({ email: e.toLowerCase(), password });
      router.replace("/(tabs)/home");
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.message
          : locale === "ar"
            ? "فشل الاتصال. حاول مرة أخرى."
            : "Erreur de connexion. Réessaye.";
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
          contentContainerClassName="flex-grow justify-center px-6 py-8"
          keyboardShouldPersistTaps="handled"
        >
          <Text className="text-3xl font-bold text-slate-900 mb-2">
            Débloque-moi
          </Text>
          <Text className="text-base text-slate-500 mb-8">
            {t.auth.loginSubtitle}
          </Text>

          <Text className="text-sm font-medium text-slate-700 mb-1">
            {t.auth.fieldEmail}
          </Text>
          <TextInput
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            textContentType="emailAddress"
            className="border border-slate-300 rounded-xl px-4 py-3 text-base mb-4 text-slate-900"
            placeholder="tu@exemple.com"
            placeholderTextColor="#94a3b8"
          />

          <Text className="text-sm font-medium text-slate-700 mb-1">
            {t.auth.fieldPassword}
          </Text>
          <TextInput
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            textContentType="password"
            className="border border-slate-300 rounded-xl px-4 py-3 text-base mb-4 text-slate-900"
            placeholder="••••••••"
            placeholderTextColor="#94a3b8"
          />

          {error ? (
            <View className="rounded-xl border border-red-200 bg-red-50 p-3 mb-4">
              <Text className="text-sm text-red-700">⚠️ {error}</Text>
            </View>
          ) : null}

          <Pressable
            onPress={onSubmit}
            disabled={pending}
            className="bg-brand rounded-xl py-4 items-center active:bg-brand-dark disabled:opacity-60 mb-3"
          >
            {pending ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text className="text-white font-semibold text-base">
                {pending ? t.auth.btnConnecting : t.auth.btnConnect}
              </Text>
            )}
          </Pressable>

          <View className="items-center mb-5">
            <Link href="/(auth)/forgot-password" asChild>
              <Pressable hitSlop={8}>
                <Text className="text-slate-500 text-sm underline">
                  {locale === "ar"
                    ? "نسيت كلمة المرور؟"
                    : "Mot de passe oublié ?"}
                </Text>
              </Pressable>
            </Link>
          </View>

          <View className="flex-row justify-center items-center">
            <Text className="text-slate-600 text-sm">{t.auth.noAccount}</Text>
            <Link href="/(auth)/register" asChild>
              <Pressable hitSlop={8} className="ml-1">
                <Text className="text-brand text-sm font-medium">
                  {t.auth.registerLink}
                </Text>
              </Pressable>
            </Link>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
