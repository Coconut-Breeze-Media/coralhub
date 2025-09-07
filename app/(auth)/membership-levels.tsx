// app/(auth)/membership-levels.tsx
import React, { useEffect, useState } from 'react';
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

export const options = { headerShown: false }; // hide default stack header

const PRIMARY = '#0077b6';

// desired order by the FIRST word in the name
const ORDER = ['basic', 'monthly', 'annual', 'institutional'];
const orderIndex = (name: string) => {
  const first = name?.trim().toLowerCase().split(/\s+/)[0] || '';
  const i = ORDER.indexOf(first);
  return i === -1 ? 999 : i; // unknowns go to the end
};
function LevelCard({ level, onSelect }: { level: MembershipLevel; onSelect: (url: string) => void }) {
  return (
    <View
      style={{
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#e5e7eb',
        backgroundColor: '#fff',
        padding: 16,
        marginBottom: 16,
        shadowColor: '#000',
        shadowOpacity: 0.06,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 4 },
        elevation: 2,
      }}
    >
      <Text style={{ fontSize: 18, fontWeight: '800', marginBottom: 6 }}>{level.name}</Text>

      <Text style={{ fontSize: 28, fontWeight: '900' }}>
        {level.price}{' '}
        <Text style={{ fontSize: 14, fontWeight: '600' }}>{level.note}</Text>
      </Text>

      {!!level.description && (
        <Text style={{ color: '#374151', marginTop: 8 }}>{level.description}</Text>
      )}

      {!!level.benefits?.length && (
        <View style={{ marginTop: 12, gap: 6 }}>
          {level.benefits.map((b, i) => (
            <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Ionicons name="checkmark-circle" size={18} color="#9ca3af" />
              <Text style={{ color: '#111827' }}>{b}</Text>
            </View>
          ))}
        </View>
      )}

      <TouchableOpacity
        onPress={() => onSelect(level.checkout_url)}
        style={{
          marginTop: 14,
          height: 44,
          borderRadius: 10,
          backgroundColor: PRIMARY,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text style={{ color: '#fff', fontWeight: '700' }}>Select</Text>
      </TouchableOpacity>
    </View>
  );
}

export default function MembershipLevelsScreen() {
  const [levels, setLevels] = useState<MembershipLevel[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const data = await getMembershipLevels();
        const sorted = [...data].sort(
          (a, b) => orderIndex(a.name) - orderIndex(b.name)
        );
        setLevels(sorted);
      } catch (e: any) {
        setErr(e?.message || 'Failed to load membership levels');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const openCheckout = (url: string) => Linking.openURL(url);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>
      {/* Simple header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', padding: 16, gap: 8 }}>
        <TouchableOpacity onPress={() => router.back()} style={{ padding: 6 }}>
          <Ionicons name="chevron-back" size={26} color="#111" />
        </TouchableOpacity>
        <Text style={{ fontSize: 18, fontWeight: '800' }}>Choose a plan</Text>
      </View>

      {/* Body */}
      <View style={{ flex: 1, paddingHorizontal: 16 }}>
        {loading ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <ActivityIndicator />
            <Text style={{ marginTop: 8 }}>Loading levels…</Text>
          </View>
        ) : err ? (
          <View style={{ padding: 16 }}>
            <Text style={{ color: '#b91c1c' }}>{err}</Text>
          </View>
        ) : (
          <FlatList
            data={levels}
            keyExtractor={(item) => String(item.id)}
            renderItem={({ item }) => <LevelCard level={item} onSelect={openCheckout} />}
            contentContainerStyle={{
              paddingBottom: 16,
              maxWidth: 480,
              alignSelf: 'center',
              width: '100%',
            }}
          />
        )}
      </View>
    </SafeAreaView>
  );
}