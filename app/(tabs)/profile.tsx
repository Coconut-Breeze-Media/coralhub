// app/(tabs)/profile.tsx
/**
 * Profile screen with navigation menu items
 */

import { Ionicons } from '@expo/vector-icons';
import { Link, useRouter } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { PROFILE_MENU_ITEMS, ROUTES } from '../../constants/navigation';
import { useAuth } from '../../lib/auth';

export default function ProfilePage() {
  const { clearAuth, membership } = useAuth();
  // Basic (free) members get a prompt to upgrade to a premium level.
  const showUpgrade = membership?.tier === 'none';
  const router = useRouter();

  const handleLogout = async () => {
    await clearAuth();
    router.replace('/sign-in');
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#fff' }}>
      {showUpgrade && (
        <Pressable
          onPress={() => router.push(ROUTES.MEMBERSHIP_LEVELS)}
          accessibilityRole="button"
          accessibilityLabel="Upgrade to a premium membership"
          style={({ pressed }) => ({
            margin: 16,
            marginBottom: 8,
            padding: 14,
            borderRadius: 12,
            backgroundColor: '#eff6ff',
            borderWidth: 1,
            borderColor: '#bfdbfe',
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
            opacity: pressed ? 0.85 : 1,
          })}
        >
          <Ionicons name="star-outline" size={24} color="#2563eb" />
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 15, fontWeight: '700', color: '#1e3a8a' }}>Upgrade your membership</Text>
            <Text style={{ fontSize: 13, color: '#1e40af', marginTop: 2 }}>
              Unlock premium resources like courses, the document library and masterclasses.
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color="#2563eb" />
        </Pressable>
      )}

      {PROFILE_MENU_ITEMS.map((item, idx) => (
        <Link
          key={item.href}
          href={
            item.href === ROUTES.PROFILE_MESSAGES
              ? { pathname: item.href as any, params: { returnTo: 'profile' } }
              : { pathname: item.href as any }
          }
          asChild
        >
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

      {/* Logout Button */}
      <Pressable
        onPress={handleLogout}
        style={{
          paddingHorizontal: 16,
          paddingVertical: 14,
          borderTopWidth: 1,
          borderColor: '#e5e7eb',
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
        }}
      >
        <Ionicons name="log-out-outline" size={22} color="#dc2626" />
        <Text style={{ fontSize: 16, color: '#dc2626', flex: 1 }}>Log Out</Text>
      </Pressable>
    </View>
  );
}
