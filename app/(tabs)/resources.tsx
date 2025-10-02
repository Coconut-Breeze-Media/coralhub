// app/tabs/resources.tsx
import { useMemo, useState } from "react";
import { SafeAreaView, View, Text, TextInput, FlatList, Pressable } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

type ResourceItem = {
  key: string;
  title: string;
  description?: string;
  icon: keyof typeof Ionicons.glyphMap;
  group: "Learn" | "Programs" | "Career" | "Community";
};

const ALL_ITEMS: ResourceItem[] = [
  { key: "resource-dashboard", title: "Resource Dashboard", description: "Your saved & recently viewed items.", icon: "grid-outline", group: "Community" },
  { key: "opportunities", title: "Opportunities", description: "Calls, funding, jobs, events.", icon: "sparkles-outline", group: "Career" },
  { key: "fundamentals-course", title: "Fundamentals Course", description: "Start here: core reef science & methods.", icon: "school-outline", group: "Learn" },
  { key: "document-library", title: "Document Library", description: "Guides, protocols, templates.", icon: "library-outline", group: "Learn" },
  { key: "mentorships", title: "Mentorships", description: "Find mentors or become one.", icon: "people-outline", group: "Community" },
  { key: "masterclasses", title: "Masterclasses", description: "Deep-dive live classes & replays.", icon: "videocam-outline", group: "Learn" },
  { key: "internships", title: "Internships", description: "Placements & practicum listings.", icon: "briefcase-outline", group: "Career",  },
  { key: "historical-archive", title: "Historical Archive", description: "Past docs, recordings, datasets.", icon: "time-outline", group: "Learn" },
  { key: "merchandise", title: "Merchandise", description: "Support the hub—shop gear.", icon: "shirt-outline", group: "Community" },
  { key: "articles", title: "Articles", description: "Editorials, explainers, field notes.", icon: "newspaper-outline", group: "Learn" },
  { key: "corr-grants", title: "CoRR Grants", description: "Small grants for coral research.", icon: "cash-outline", group: "Career" },
  { key: "institutional-area", title: "Institutional Area", description: "Partner tools & resources.", icon: "business-outline", group: "Community", },
];

// Simple pill filter UI; keep it minimal for now
const FILTERS: Array<ResourceItem["group"] | "All"> = ["All", "Learn", "Programs", "Career", "Community"];

export default function ResourcesScreen() {
  const [query, setQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<typeof FILTERS[number]>("All");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return ALL_ITEMS.filter((it) => {
      const inFilter = activeFilter === "All" ? true : it.group === activeFilter;
      const inSearch =
        !q ||
        it.title.toLowerCase().includes(q) ||
        (it.description ?? "").toLowerCase().includes(q);
      return inFilter && inSearch;
    });
  }, [query, activeFilter]);

  // Group visually with simple headers
  const dataWithHeaders = useMemo(() => {
    const groups = new Map<string, ResourceItem[]>();
    filtered.forEach((it) => {
      const arr = groups.get(it.group) ?? [];
      arr.push(it);
      groups.set(it.group, arr);
    });
    const rows: Array<{ type: "header" | "item"; group?: string; item?: ResourceItem }> = [];
    Array.from(groups.keys()).sort().forEach((g) => {
      rows.push({ type: "header", group: g });
      groups.get(g)!.forEach((item) => rows.push({ type: "item", item }));
    });
    return rows;
  }, [filtered]);

  // return (
  //   <SafeAreaView style={{ flex: 1, backgroundColor: "#fff" }}>
  //     <View style={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 6 }}>
  //       <Text style={{ fontSize: 24, fontWeight: "700", marginBottom: 6 }}>Resources</Text>
  //       <Text style={{ color: "#6b7280", marginBottom: 12 }}>
  //         Explore courses, docs, grants, internships, and more.
  //       </Text>

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#fff" }}>
      <View style={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 6 }}>
        <Text style={{ fontSize: 24, fontWeight: "700", marginBottom: 6 }}>Resources</Text>
        <Text style={{ color: "#6b7280", marginBottom: 12 }}>
          Explore courses, docs, grants, internships, and more.
        </Text>

        {/* DEV-only shortcut */}
        {__DEV__ && (
          <Pressable
            onPress={() => router.push("/resources/debug-categories")}
            style={{
              alignSelf: "flex-start",
              paddingHorizontal: 10, height: 28, borderRadius: 999,
              backgroundColor: "#eef2ff", justifyContent: "center", marginBottom: 8
            }}
          >
            <Text style={{ color: "#3730a3", fontWeight: "700" }}>Debug: Categories</Text>
          </Pressable>
        )}

        {/* Search */}
        <View style={{
          flexDirection: "row",
          alignItems: "center",
          borderWidth: 1, borderColor: "#e5e7eb", borderRadius: 12,
          paddingHorizontal: 12, height: 44
        }}>
          <Ionicons name="search-outline" size={18} color="#6b7280" />
          <TextInput
            placeholder="Search resources"
            value={query}
            onChangeText={setQuery}
            style={{ marginLeft: 8, flex: 1 }}
            returnKeyType="search"
          />
          {query ? (
            <Pressable onPress={() => setQuery("")} hitSlop={10}>
              <Ionicons name="close-circle-outline" size={18} color="#9ca3af" />
            </Pressable>
          ) : null}
        </View>

        {/* Filters */}
        <View style={{ flexDirection: "row", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
          {FILTERS.map((f) => {
            const active = activeFilter === f;
            return (
              <Pressable
                key={f}
                onPress={() => setActiveFilter(f)}
                style={{
                  paddingHorizontal: 12, height: 34, borderRadius: 999,
                  borderWidth: 1, borderColor: active ? "#2563eb" : "#e5e7eb",
                  backgroundColor: active ? "#dbeafe" : "#fff",
                  justifyContent: "center"
                }}
              >
                <Text style={{ color: active ? "#1d4ed8" : "#374151", fontWeight: "600" }}>{f}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* List */}
      <FlatList
        contentContainerStyle={{ paddingHorizontal: 8, paddingBottom: 24 }}
        data={dataWithHeaders}
        keyExtractor={(_, i) => String(i)}
        renderItem={({ item }) => {
          if (item.type === "header") {
            return (
              <Text style={{ marginTop: 12, marginBottom: 6, marginLeft: 8, fontSize: 12, color: "#6b7280" }}>
                {item.group}
              </Text>
            );
          }
          const r = item.item!;
          return (
            <Pressable
              onPress={() => router.push(`/resources/${r.key}`)}
              style={{
                flexDirection: "row",
                alignItems: "center",
                padding: 12,
                marginHorizontal: 8,
                marginVertical: 6,
                borderWidth: 1,
                borderColor: "#e5e7eb",
                borderRadius: 14,
                backgroundColor: "#fff",
                shadowColor: "#000",
                shadowOpacity: 0.03,
                shadowRadius: 6,
                shadowOffset: { width: 0, height: 2 },
                elevation: 1
              }}
            >
              <View style={{
                width: 40, height: 40, borderRadius: 10, alignItems: "center", justifyContent: "center",
                backgroundColor: "#f3f4f6", marginRight: 12
              }}>
                <Ionicons name={r.icon} size={22} color="#111827" />
              </View>

              <View style={{ flex: 1 }}>
                <Text style={{ fontWeight: "700" }}>{r.title}</Text>
                {!!r.description && (
                  <Text style={{ color: "#6b7280", marginTop: 2 }} numberOfLines={1}>{r.description}</Text>
                )}
              </View>

              <Ionicons name="chevron-forward" size={20} color="#9ca3af" />
            </Pressable>
          );
        }}
      />
    </SafeAreaView>
  );
}