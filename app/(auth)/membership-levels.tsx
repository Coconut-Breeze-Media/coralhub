// app/(auth)/membership-levels.tsx
import React, { useEffect, useMemo, useState } from 'react';
import {
  SafeAreaView,
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  FlatList,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { getMembershipLevels, MembershipLevel } from '../../lib/api';

export const options = { headerShown: false };

const PRIMARY = '#0077b6';
const TEXT_DARK = '#0f172a';
const TEXT = '#111827';
const MUTED = '#6b7280';
const BORDER = '#e5e7eb';
const CARD_BG = '#fff';

// Desired order by first word in name
const ORDER = ['basic', 'monthly', 'annual', 'institutional'];
const orderIndex = (name: string) => {
  const first = name?.trim().toLowerCase().split(/\s+/)[0] || '';
  const i = ORDER.indexOf(first);
  return i === -1 ? 999 : i;
};

// If your endpoint doesn’t yet send benefits, you can map defaults here.
// Remove this once you return `benefits` from the plugin.
const defaultBenefitsFor = (levelName: string): string[] => {
  const name = levelName.toLowerCase();
  if (name.startsWith('basic')) {
    return [
      'View members directory',
      'View members profile',
      'Access group directory',
      'Access to groups',
      'View site activity',
      'Send private messages',
      'Add media to your profile',
    ];
  }
  if (name.startsWith('monthly')) {
    return [
      'Full access to community pages',
      'Most premium features',
      'Flexible monthly billing',
    ];
  }
  if (name.startsWith('annual')) {
    return [
      'All premium features',
      'Full access to community pages',
      'Eligible for Small Research Grant Program',
      'Best value over monthly',
    ];
  }
  if (name.startsWith('institutional')) {
    return [
      'Full access for your team',
      'Additional logins on request',
      'Run regular promotions',
      'Feature your services',
    ];
  }
  return [];
};

// Optional: mark a plan as “featured” (adds a small badge & subtle border)
const isFeatured = (lvl: MembershipLevel) =>
  /^annual/i.test(lvl.name) || /^institutional/i.test(lvl.name);

function LevelCard({
  level,
  onSelect,
}: {
  level: MembershipLevel;
  onSelect: (url: string) => void;
}) {
  const benefits =
    (level.benefits && level.benefits.length > 0
      ? level.benefits
      : defaultBenefitsFor(level.name));

  const featured = isFeatured(level);

  return (
    <View
      style={{
        borderRadius: 16,
        borderWidth: 1,
        borderColor: featured ? '#c7d2fe' : BORDER,
        backgroundColor: CARD_BG,
        padding: 20,
        marginBottom: 16,
        shadowColor: '#000',
        shadowOpacity: 0.06,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 4 },
        elevation: 2,
      }}
    >
      {/* Header row */}
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
        <Text style={{ fontSize: 20, fontWeight: '800', color: TEXT_DARK, flex: 1 }}>
          {level.name}
        </Text>

        {featured && (
          <View
            style={{
              paddingHorizontal: 10,
              paddingVertical: 4,
              borderRadius: 999,
              backgroundColor: '#e0e7ff',
            }}
          >
            <Text style={{ color: '#3730a3', fontWeight: '700', fontSize: 12 }}>
              Featured
            </Text>
          </View>
        )}
      </View>

      {/* Price row */}
      <View style={{ flexDirection: 'row', alignItems: 'baseline', marginBottom: 8 }}>
        <Text style={{ fontSize: 28, fontWeight: '900', color: TEXT }}>${level.price.replace(/^\$/, '')}</Text>
        {!!level.note && (
          <Text style={{ fontSize: 14, fontWeight: '600', color: TEXT, marginLeft: 8 }}>
            {level.note}
          </Text>
        )}
      </View>

      {/* Description */}
      {!!level.description && (
        <Text style={{ color: '#374151', lineHeight: 20, marginBottom: benefits.length ? 12 : 16 }}>
          {level.description}
        </Text>
      )}

      {/* Benefits list */}
      {!!benefits.length && (
        <View style={{ marginBottom: 16 }}>
          {benefits.map((b, i) => (
            <View
              key={`${level.id}-benefit-${i}`}
              style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}
            >
              <Ionicons name="checkmark-circle" size={18} color="#16a34a" style={{ marginRight: 8 }} />
              <Text style={{ color: '#111827' }}>{b}</Text>
            </View>
          ))}
        </View>
      )}

      {/* CTA */}
      <TouchableOpacity
        onPress={() => onSelect(level.checkout_url)}
        style={{
          height: 48,
          borderRadius: 12,
          backgroundColor: PRIMARY,
          alignItems: 'center',
          justifyContent: 'center',
        }}
        activeOpacity={0.8}
        accessibilityRole="button"
        accessibilityLabel={`Select ${level.name}`}
      >
        <Text style={{ color: '#fff', fontWeight: '700', fontSize: 16 }}>Select</Text>
      </TouchableOpacity>
    </View>
  );
}

export default function MembershipLevelsScreen() {
  const [levels, setLevels] = useState<MembershipLevel[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  // Fetch & sort
  useEffect(() => {
    (async () => {
      try {
        const data = await getMembershipLevels();
        const sorted = [...data].sort((a, b) => orderIndex(a.name) - orderIndex(b.name));
        setLevels(sorted);
      } catch (e: any) {
        setErr(e?.message || 'Failed to load membership levels');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const openCheckout = (url: string) => Linking.openURL(url);

  // Nice empty-state if no levels
  const empty = useMemo(
    () => !loading && !err && levels.length === 0,
    [loading, err, levels.length]
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>
      {/* Header */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: 16,
          paddingVertical: 10,
          gap: 8,
        }}
      >
        <TouchableOpacity
          onPress={() => router.back()}
          style={{ padding: 6 }}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Ionicons name="chevron-back" size={26} color="#111" />
        </TouchableOpacity>
        <Text style={{ fontSize: 20, fontWeight: '800', color: TEXT_DARK }}>Choose a plan</Text>
      </View>

      {/* Body */}
      <View style={{ flex: 1, paddingHorizontal: 16 }}>
        {loading ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <ActivityIndicator />
            <Text style={{ marginTop: 8, color: MUTED }}>Loading levels…</Text>
          </View>
        ) : err ? (
          <View style={{ padding: 16 }}>
            <Text style={{ color: '#b91c1c' }}>{err}</Text>
          </View>
        ) : empty ? (
          <View style={{ padding: 16 }}>
            <Text style={{ color: MUTED }}>No membership levels found.</Text>
          </View>
        ) : (
          <FlatList
            data={levels}
            keyExtractor={(item) => String(item.id)}
            renderItem={({ item }) => <LevelCard level={item} onSelect={openCheckout} />}
            contentContainerStyle={{
              paddingBottom: 16,
              maxWidth: 520,
              alignSelf: 'center',
              width: '100%',
            }}
          />
        )}
      </View>
    </SafeAreaView>
  );
}