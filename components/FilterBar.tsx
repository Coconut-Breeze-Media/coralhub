import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
export type ScopeFilter = 'All Members' | 'My Friends' | 'My Groups' | 'My Favorites' | 'Mentions';

const filters: ScopeFilter[] = ['All Members', 'My Friends', 'My Groups', 'My Favorites', 'Mentions'];

export default function FilterBar({ active, onChange }: { active: ScopeFilter; onChange: (f: ScopeFilter) => void }) {
  return (
    <View style={{ paddingVertical: 8 }}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 8 }}>
        {filters.map((f) => {
          const isActive = f === active;
          return (
            <TouchableOpacity key={f} onPress={() => onChange(f)} style={{ paddingHorizontal: 12, paddingVertical: 6 }}>
              <Text style={{ fontWeight: isActive ? '700' : '500', color: isActive ? '#0f172a' : '#6b7280' }}>
                {f}
              </Text>
              {isActive && <View style={{ height: 2, backgroundColor: '#0077b6', marginTop: 6, borderRadius: 2 }} />}
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}