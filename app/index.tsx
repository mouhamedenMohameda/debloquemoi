import { Redirect } from "expo-router";
import { ActivityIndicator, View } from "react-native";
import { useSession } from "@/lib/useSession";

export default function Index() {
  const { user, loading } = useSession();

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return <Redirect href={user ? "/(tabs)/home" : "/(auth)/login"} />;
}
