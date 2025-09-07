// components/profilepage/ProfilePage.tsx
import { Ionicons } from '@expo/vector-icons';
import { Link } from 'expo-router';
import { Pressable, Text, View } from 'react-native';

type Item = { label: string; href: string; icon: keyof typeof Ionicons.glyphMap };

const items: Item[] = [
  { label: 'My Profile Settings', href: '/profile/profile-settings', icon: 'person-circle-outline' },
  { label: 'My Activity',         href: '/profile/activity',         icon: 'time-outline' },
  { label: 'My Messages',         href: '/profile/messages',         icon: 'chatbubble-ellipses-outline' },
  { label: 'My Groups',           href: '/profile/groups',           icon: 'people-outline' },
  { label: 'My Connections',      href: '/profile/connections',      icon: 'link-outline' },
  { label: 'My Notifications',    href: '/profile/notifications',    icon: 'notifications-outline' },
  { label: 'My Account Settings', href: '/profile/account-settings', icon: 'settings-outline' },
  { label: 'My Account',          href: '/profile/account',          icon: 'card-outline' },
];

export default function ProfilePage() {
  return (
    <View style={{ flex: 1, backgroundColor: '#fff' }}>
      {items.map((item, idx) => (
        <Link href={{ pathname: '/profile/account' }} asChild>

      
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