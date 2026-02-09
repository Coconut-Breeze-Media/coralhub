// app/(tabs)/profile.tsx
/**
 * Profile screen with navigation menu items
 */

import { Ionicons } from '@expo/vector-icons';
import { Link } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { PROFILE_MENU_ITEMS } from '../../constants/navigation';

export default function ProfilePage() {
  return (
    <View style={{ flex: 1, backgroundColor: '#fff' }}>
      {PROFILE_MENU_ITEMS.map((item, idx) => (
        <Link key={item.href} href={{ pathname: item.href as any }} asChild>
          <Pressable
            style={{
              paddingHorizontal: 16,
              paddingVertical: 14,
              borderTopWidth: idx === 0 ? 0 : 1,
              borderColor: '#e5e7eb',
              flexDirection: 'row',
              alignItems: 'center',
              gap: 12,
            }}
          >
            <Ionicons name={item.icon as any} size={22} color="#2563eb" />
            <Text style={{ fontSize: 16, color: '#1f2937', flex: 1 }}>{item.label}</Text>
            <Ionicons name="chevron-forward" size={18} color="#9ca3af" />
          </Pressable>
        </Link>
      ))}
    </View>
  );
}