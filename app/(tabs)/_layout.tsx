import { Redirect, Tabs } from "expo-router";
import { ActivityIndicator, Text, View } from "react-native";
import { useSession } from "@/lib/useSession";
import { useTranslation } from "@/lib/i18n";

export default function TabsLayout() {
  const { user, loading } = useSession();
  const { t, locale } = useTranslation();
  const historyLabel = locale === "ar" ? "السجل" : "Historique";
  const bankLabel = locale === "ar" ? "الأرشيف" : "Banque";

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <ActivityIndicator size="large" />
      </View>
    );
  }
  if (!user) return <Redirect href="/(auth)/login" />;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: "#2563eb",
        tabBarInactiveTintColor: "#64748b",
        tabBarStyle: {
          borderTopColor: "#e2e8f0",
          paddingTop: 4,
        },
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: t.nav.home,
          tabBarIcon: ({ color }) => <Icon emoji="🧠" color={color} />,
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: historyLabel,
          tabBarIcon: ({ color }) => <Icon emoji="🕘" color={color} />,
        }}
      />
      <Tabs.Screen
        name="exercises"
        options={{
          title: bankLabel,
          tabBarIcon: ({ color }) => <Icon emoji="📚" color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: t.nav.profile,
          tabBarIcon: ({ color }) => <Icon emoji="👤" color={color} />,
        }}
      />
      <Tabs.Screen
        name="topup"
        options={{
          title: t.nav.topup,
          tabBarIcon: ({ color }) => <Icon emoji="💳" color={color} />,
        }}
      />
      {/* Parrainage accessible depuis Profil, pas dans la tab bar (max 5 tabs iOS). */}
      <Tabs.Screen
        name="referrals"
        options={{ href: null }}
      />
    </Tabs>
  );
}

function Icon({ emoji, color }: { emoji: string; color: string }) {
  return <Text style={{ fontSize: 22, color }}>{emoji}</Text>;
}
