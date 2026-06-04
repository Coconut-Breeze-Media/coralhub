// app/(tabs)/resources.tsx
import React, { useCallback, useState } from 'react';
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
import { router, useFocusEffect } from 'expo-router';
import { useAuth } from '../../lib/auth';
import { usePremiumResources } from '../../hooks/useQueries';
import { getAppLoginLink } from '../../lib/api';
import type { MembershipTier, PremiumResource } from '../../types';

const PRIMARY = '#0077b6';
const TEXT_DARK = '#0f172a';
const MUTED = '#6b7280';
const BORDER = '#e5e7eb';
const CARD_BG = '#fff';
const LOCK_BG = '#f8fafc';

const TIER_LABEL: Record<MembershipTier, string> = {
  none: 'Free',
  monthly: 'Monthly',
  annual: 'Annual',
  institutional: 'Group',
};

// Lowest tier that unlocks a resource (first in required_tiers, server-ordered).
function requiredTierLabel(resource: PremiumResource): string {
  const lowest = resource.required_tiers?.[0];
  return lowest ? TIER_LABEL[lowest] ?? lowest : 'a paid';
}

function ResourceRow({
  resource,
  onPressUnlocked,
  onPressLocked,
  opening,
}: {
  resource: PremiumResource;
  onPressUnlocked: (r: PremiumResource) => void;
  onPressLocked: (r: PremiumResource) => void;
  opening: boolean;
}) {
  const unlocked = resource.unlocked;

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={() => (unlocked ? onPressUnlocked(resource) : onPressLocked(resource))}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: unlocked ? CARD_BG : LOCK_BG,
        borderWidth: 1,
        borderColor: BORDER,
        borderRadius: 14,
        paddingVertical: 16,
        paddingHorizontal: 16,
        marginBottom: 12,
      }}
      accessibilityRole="button"
      accessibilityLabel={
        unlocked ? `Open ${resource.title}` : `${resource.title} locked — upgrade to unlock`
      }
    >
      <View
        style={{
          width: 40,
          height: 40,
          borderRadius: 20,
          backgroundColor: unlocked ? '#e0f2fe' : '#e5e7eb',
          alignItems: 'center',
          justifyContent: 'center',
          marginRight: 14,
        }}
      >
        <Ionicons
          name={unlocked ? 'document-text-outline' : 'lock-closed'}
          size={20}
          color={unlocked ? PRIMARY : MUTED}
        />
      </View>

      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 16, fontWeight: '700', color: TEXT_DARK }}>
          {resource.title}
        </Text>
        {!unlocked && (
          <Text style={{ fontSize: 13, color: MUTED, marginTop: 2 }}>
            {requiredTierLabel(resource)} membership required
          </Text>
        )}
      </View>

      {opening && unlocked ? (
        <ActivityIndicator size="small" color={PRIMARY} />
      ) : (
        <Ionicons
          name={unlocked ? 'chevron-forward' : 'arrow-up-circle-outline'}
          size={22}
          color={unlocked ? MUTED : PRIMARY}
        />
      )}
    </TouchableOpacity>
  );
}

export default function ResourcesScreen() {
  const { token, membership, refreshMembership } = useAuth();
  const { data: resources, isLoading, error, refetch, isRefetching } = usePremiumResources();
  const [openingKey, setOpeningKey] = useState<string | null>(null);

  // Refresh tier + catalog whenever the screen regains focus (e.g. returning
  // from Stripe checkout), so newly-purchased resources unlock immediately.
  useFocusEffect(
    useCallback(() => {
      refreshMembership();
      refetch();
    }, [refreshMembership, refetch])
  );

  const openUnlocked = useCallback(
    async (resource: PremiumResource) => {
      if (!resource.url || !token) return;
      setOpeningKey(resource.key);
      try {
        // Bridge the app's JWT session into a website cookie session so the
        // gated page loads authenticated.
        const { url } = await getAppLoginLink(token, resource.url);
        await Linking.openURL(url);
      } catch (e) {
        // Fall back to opening the page directly (user may need to log in once).
        console.warn('SSO login link failed, opening page directly:', e);
        try {
          await Linking.openURL(resource.url);
        } catch {
          /* no-op */
        }
      } finally {
        setOpeningKey(null);
      }
    },
    [token]
  );

  const openLocked = useCallback((_resource: PremiumResource) => {
    router.push('/(auth)/membership-levels');
  }, []);

  const tier = membership?.tier ?? 'none';

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>
      <View style={{ flex: 1, paddingHorizontal: 16 }}>
        {/* Header */}
        <View style={{ paddingTop: 12, paddingBottom: 8 }}>
          <Text style={{ fontSize: 24, fontWeight: '800', color: TEXT_DARK }}>
            Premium Resources
          </Text>
          <Text style={{ fontSize: 14, color: MUTED, marginTop: 4 }}>
            Your plan: {TIER_LABEL[tier]}
            {tier === 'none' ? ' — upgrade to unlock resources' : ''}
          </Text>
        </View>

        {isLoading ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <ActivityIndicator />
            <Text style={{ marginTop: 8, color: MUTED }}>Loading resources…</Text>
          </View>
        ) : error ? (
          <View style={{ padding: 16 }}>
            <Text style={{ color: '#b91c1c' }}>
              {(error as Error)?.message || 'Failed to load resources'}
            </Text>
            <TouchableOpacity onPress={() => refetch()} style={{ marginTop: 12 }}>
              <Text style={{ color: PRIMARY, fontWeight: '700' }}>Try again</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <FlatList
            data={resources ?? []}
            keyExtractor={(item) => item.key}
            renderItem={({ item }) => (
              <ResourceRow
                resource={item}
                onPressUnlocked={openUnlocked}
                onPressLocked={openLocked}
                opening={openingKey === item.key}
              />
            )}
            refreshing={isRefetching}
            onRefresh={refetch}
            contentContainerStyle={{ paddingTop: 8, paddingBottom: 24 }}
            ListEmptyComponent={
              <View style={{ padding: 16 }}>
                <Text style={{ color: MUTED }}>No resources available.</Text>
              </View>
            }
          />
        )}
      </View>
    </SafeAreaView>
  );
}
