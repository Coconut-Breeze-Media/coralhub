// app/(tabs)/profile.tsx (or your ProfilePage component)
import React, { useEffect, useRef, useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';
import { Link, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../lib/auth';

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

export default function ProfileScreen() {
  const { clearAuth } = useAuth();
  const [signingOut, setSigningOut] = useState(false);
  const mounted = useRef(true);
  const navigated = useRef(false);

  useEffect(() => () => { mounted.current = false; }, []);

  const handleSignOut = () => {
    if (signingOut) return;

    Alert.alert('Sign out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign out',
        style: 'destructive',
        onPress: async () => {
          try {
            if (mounted.current) setSigningOut(true);
            await clearAuth();                  // clear tokens & storage
            if (!navigated.current) {           // single-shot navigation out of (tabs)
              navigated.current = true;
              router.replace('/');              // go to Welcome
            }
          } finally {
            if (mounted.current) setSigningOut(false);
          }
        },
      },
    ]);
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#fff' }}>
      {items.map((item, idx) => (
        <Link key={item.href} href={{ pathname: item.href }} asChild>
          <Pressable
            style={{
              paddingHorizontal: 16, paddingVertical: 14,
              borderTopWidth: idx === 0 ? 0 : 1, borderColor: '#e5e7eb',
              flexDirection: 'row', alignItems: 'center', gap: 12,
            }}
          >
            <Ionicons name={item.icon} size={22} color="#2563eb" />
            <Text style={{ fontSize: 16, color: '#1f2937', flex: 1 }}>{item.label}</Text>
            <Ionicons name="chevron-forward" size={18} color="#9ca3af" />
          </Pressable>
        </Link>
      ))}

      <Pressable
        onPress={handleSignOut}
        disabled={signingOut}
        style={{
          paddingHorizontal: 16, paddingVertical: 14, borderTopWidth: 1, borderColor: '#e5e7eb',
          flexDirection: 'row', alignItems: 'center', gap: 12, opacity: signingOut ? 0.6 : 1,
        }}
        accessibilityRole="button"
        accessibilityLabel="Sign out"
      >
        <Ionicons name="log-out-outline" size={22} color="#ef4444" />
        <Text style={{ fontSize: 16, color: '#ef4444', flex: 1 }}>
          {signingOut ? 'Signing out…' : 'Sign out'}
        </Text>
      </Pressable>
    </View>
  );
}