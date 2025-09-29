// components/FilterBar.tsx
import { View, TouchableOpacity, Text, ScrollView } from 'react-native';

export type ScopeFilter = 'All Members' | 'My Friends' | 'My Groups' | 'My Favorites' | 'Mentions';

const filters: ScopeFilter[] = ["All Members", "My Friends", "My Groups", "My Favorites", "Mentions"];

export default function FilterBar({ active, onChange }: { active: ScopeFilter; onChange: (f: ScopeFilter) => void }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ padding: 8 }}>
      {filters.map(f => (
        <TouchableOpacity
          key={f}
          onPress={() => onChange(f)}
          style={{
            paddingVertical: 6,
            paddingHorizontal: 12,
            marginRight: 8,
            borderRadius: 20,
            backgroundColor: active === f ? "#0077b6" : "#f3f4f6",
          }}
        >
          <Text style={{ color: active === f ? "#fff" : "#111827" }}>{f}</Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}