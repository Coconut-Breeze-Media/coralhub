// app/profile/credits.tsx
/**
 * Credits Screen
 * Information about the company behind the app (Coconut Breeze Media),
 * with links to Coconut Dive Manage and the Coconut Breeze Media website.
 */

import { View, Text, ScrollView, Pressable, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import BackButton from '../../components/BackButton';

const COCONUT_DIVE_MANAGE_URL = 'https://divemanage.com';
const COCONUT_BREEZE_MEDIA_URL = 'https://coconutbreezemedia.com';

const PRIMARY = '#2563eb';

function LinkButton({
  label,
  url,
  icon,
  variant = 'primary',
}: {
  label: string;
  url: string;
  icon: keyof typeof Ionicons.glyphMap;
  variant?: 'primary' | 'secondary';
}) {
  const isPrimary = variant === 'primary';
  return (
    <Pressable
      onPress={() => Linking.openURL(url)}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        height: 50,
        borderRadius: 12,
        backgroundColor: isPrimary ? PRIMARY : '#fff',
        borderWidth: isPrimary ? 0 : 1,
        borderColor: '#d1d5db',
        opacity: pressed ? 0.85 : 1,
      })}
    >
      <Ionicons name={icon} size={20} color={isPrimary ? '#fff' : PRIMARY} />
      <Text style={{ fontSize: 16, fontWeight: '700', color: isPrimary ? '#fff' : PRIMARY }}>
        {label}
      </Text>
      <Ionicons name="open-outline" size={16} color={isPrimary ? '#fff' : PRIMARY} />
    </Pressable>
  );
}

export default function CreditsScreen() {
  return (
    <View style={{ flex: 1, backgroundColor: '#f9fafb' }}>
      {/* Header */}
      <View
        style={{
          backgroundColor: '#fff',
          borderBottomWidth: 1,
          borderBottomColor: '#e5e7eb',
          paddingHorizontal: 16,
          paddingTop: 60,
          paddingBottom: 16,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <BackButton />
          <Text style={{ fontSize: 20, fontWeight: '700', color: '#1f2937', flex: 1 }}>
            Credits
          </Text>
        </View>
      </View>

      {/* Content */}
      <ScrollView contentContainerStyle={{ padding: 16 }}>
        <View
          style={{
            backgroundColor: '#fff',
            borderRadius: 12,
            padding: 20,
            borderWidth: 1,
            borderColor: '#e5e7eb',
          }}
        >
          <View
            style={{
              width: 56,
              height: 56,
              borderRadius: 28,
              backgroundColor: '#eff6ff',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 16,
            }}
          >
            <Ionicons name="heart" size={28} color={PRIMARY} />
          </View>

          <Text style={{ fontSize: 18, fontWeight: '700', color: '#1f2937', marginBottom: 8 }}>
            Built by Coconut Breeze Media
          </Text>

          <Text style={{ fontSize: 15, color: '#4b5563', lineHeight: 22, marginBottom: 12 }}>
            This app was designed and developed by Coconut Breeze Media. Supporting the
            people and partners who build the tools we rely on is important to us.
          </Text>

          <Text style={{ fontSize: 15, color: '#4b5563', lineHeight: 22, marginBottom: 20 }}>
            We also created Coconut Dive Manage — a platform built to help dive operations
            run smoothly. Explore our work below.
          </Text>

          <View style={{ gap: 12 }}>
            <LinkButton
              label="Coconut Dive Manage"
              url={COCONUT_DIVE_MANAGE_URL}
              icon="boat-outline"
              variant="primary"
            />
            <LinkButton
              label="Coconut Breeze Media"
              url={COCONUT_BREEZE_MEDIA_URL}
              icon="globe-outline"
              variant="secondary"
            />
          </View>
        </View>

        <Text
          style={{
            fontSize: 13,
            color: '#9ca3af',
            textAlign: 'center',
            marginTop: 20,
          }}
        >
          © {new Date().getFullYear()} Coconut Breeze Media
        </Text>
      </ScrollView>
    </View>
  );
}
