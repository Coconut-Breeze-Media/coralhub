// app/resources/[slug].tsx
import { useLocalSearchParams, Stack } from "expo-router";
import { SafeAreaView, View, Text } from "react-native";

export default function ResourceDetail() {
  const { slug } = useLocalSearchParams<{ slug: string }>();

  return (
    <>
      <Stack.Screen options={{ title: (slug ?? "").replace(/-/g, " ") }} />
      <SafeAreaView style={{ flex: 1, backgroundColor: "#fff" }}>
        <View style={{ padding: 16 }}>
          <Text style={{ fontSize: 18, fontWeight: "700", marginBottom: 8 }}>
            {(slug ?? "").replace(/-/g, " ")}
          </Text>
          <Text style={{ color: "#6b7280" }}>
            Placeholder page for <Text style={{ fontWeight: "700" }}>{slug}</Text>.  
            Wire this up to fetch content from WP or your API, or navigate to a specific screen later.
          </Text>
        </View>
      </SafeAreaView>
    </>
  );
}