// components/profilepage/ProfilePage.tsx
import { Ionicons } from '@expo/vector-icons';
import { Link } from 'expo-router';
import { Pressable, Text, View } from 'react-native';

type Item = { label: string; href: string; icon: keyof typeof Ionicons.glyphMap };

const items: Item[] = [
  { label: 'Profile Settings', href: '/profile/profile-settings', icon: 'person-circle-outline' },
  { label: 'Activity',         href: '/profile/activity',         icon: 'time-outline' },
  { label: 'Messages',         href: '/profile/messages',         icon: 'chatbubble-ellipses-outline' },
  { label: 'Groups',           href: '/profile/groups',           icon: 'people-outline' },
  { label: 'Connections',      href: '/profile/connections',      icon: 'link-outline' },
  { label: 'Account Settings', href: '/profile/account-settings', icon: 'settings-outline' },
  { label: 'Account',          href: '/profile/account',          icon: 'card-outline' },
];

export default function ProfilePage() {
  return (
    <View style={{ flex: 1, backgroundColor: '#fff' }}>
      {items.map((item, idx) => (
        <Link key={item.href} href={{ pathname: item.href }} asChild>
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
            <Ionicons name={item.icon} size={22} color="#2563eb" />
            <Text style={{ fontSize: 16, color: '#1f2937', flex: 1 }}>{item.label}</Text>
            <Ionicons name="chevron-forward" size={18} color="#9ca3af" />
          </Pressable>
        </Link>
      ))}
    </View>
  );
}