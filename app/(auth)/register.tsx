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

export default function Register() {
  const router = useRouter();
  const { register } = useSession();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [nni, setNni] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [referralCode, setReferralCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  // Validations alignées sur registerAction côté web (Bac/app/src/app/(auth)/actions.ts).
  async function onSubmit() {
    setError(null);
    const e = email.trim();
    const n = nni.trim();
    const w = whatsapp.trim();
    if (!e || !password || !n || !w) {
      setError("Tous les champs sont requis.");
      return;
    }
    if (!e.includes("@") || !e.includes(".")) {
      setError("Email invalide (ex: tu@exemple.com).");
      return;
    }
    if (password.length < 8) {
      setError("Mot de passe : 8 caractères minimum.");
      return;
    }
    setPending(true);
    try {
      await register({
        email: e.toLowerCase(),
        password,
        nni: n,
        whatsapp: w,
        referral_code: referralCode.trim() || undefined,
      });
      router.replace("/(tabs)/home");
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Erreur d'inscription. Réessaye.";
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
            Créer un compte
          </Text>
          <Text className="text-base text-slate-500 mb-8">
            10 indices gratuits offerts à l'inscription.
          </Text>

          <Field
            label="Email"
            value={email}
            onChangeText={setEmail}
            placeholder="tu@exemple.com"
            keyboardType="email-address"
            autoCapitalize="none"
            textContentType="emailAddress"
          />
          <Field
            label="Mot de passe (8 caractères min.)"
            value={password}
            onChangeText={setPassword}
            placeholder="••••••••"
            secureTextEntry
            textContentType="newPassword"
          />
          <Field
            label="NNI"
            value={nni}
            onChangeText={setNni}
            placeholder="Numéro national d'identification"
            keyboardType="number-pad"
          />
          <Field
            label="WhatsApp"
            value={whatsapp}
            onChangeText={setWhatsapp}
            placeholder="+222 ..."
            keyboardType="phone-pad"
          />
          <Field
            label="Code de parrainage (optionnel)"
            value={referralCode}
            onChangeText={setReferralCode}
            placeholder="ABC123"
            autoCapitalize="characters"
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
                Créer mon compte
              </Text>
            )}
          </Pressable>

          <View className="flex-row justify-center items-center">
            <Text className="text-slate-600 text-sm">Déjà un compte ?</Text>
            <Link href="/(auth)/login" asChild>
              <Pressable hitSlop={8} className="ml-1">
                <Text className="text-brand text-sm font-medium">
                  Se connecter
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
  textContentType?: "emailAddress" | "newPassword" | "password";
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
        textContentType={props.textContentType}
        placeholder={props.placeholder}
        placeholderTextColor="#94a3b8"
        className="border border-slate-300 rounded-xl px-4 py-3 text-base text-slate-900"
      />
    </View>
  );
}
