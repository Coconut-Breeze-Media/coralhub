import { useCallback, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useAuth } from '../../lib/auth';
import { ROUTES } from '../../constants/navigation';
import { PREMIUM_RESOURCE_CATALOG } from '../../constants/premiumResources';
import AccessRestrictedModal from '../../components/AccessRestrictedModal';

/**
 * Bespoke Resources menu. Order, labels and icons are the client's spec.
 * Dashboard, CoRR Grants, Institutional Area and Contact Us are web-only and
 * intentionally never listed here.
 */
const MENU: ReadonlyArray<{ key: string; label: string; icon: string }> = [
  { key: 'opportunities',          label: 'Opportunities',              icon: 'briefcase-outline' },
  { key: 'courses',                label: 'Training Courses',           icon: 'school-outline' },
  { key: 'mentorships',            label: 'Mentorships',                icon: 'people-outline' },
  { key: 'document_library',       label: 'Document Library',           icon: 'folder-open-outline' },
  { key: 'coral_matters',          label: 'Coral Matters',              icon: 'newspaper-outline' },
  { key: 'essays_articles',        label: 'Essays and Articles',        icon: 'document-text-outline' },
  { key: 'masterclasses',          label: 'Masterclasses',              icon: 'videocam-outline' },
  { key: 'internships',            label: 'Internships',                icon: 'rocket-outline' },
  { key: 'partnerships_discounts', label: 'Partnerships and Discounts', icon: 'pricetag-outline' },
  { key: 'historical_archive',     label: 'Historical Archive',         icon: 'archive-outline' },
];

const TIER_LABEL: Record<string, string> = {
  none: 'Basic',
  monthly: 'Monthly',
  annual: 'Annual',
  institutional: 'Institutional',
};

export default function ResourcesScreen() {
  const { membership, canAccess, refreshMembership } = useAuth();
  const [restricted, setRestricted] = useState(false);

  // Re-check the tier when this screen regains focus (e.g. returning from
  // checkout) so newly purchased resources unlock immediately.
  useFocusEffect(
    useCallback(() => {
      refreshMembership();
    }, [refreshMembership])
  );

  const tierText =
    membership?.level_name || (membership ? `${TIER_LABEL[membership.tier] ?? 'Basic'} membership` : '');

  const onPressItem = (key: string, label: string) => {
    if (!canAccess(key)) {
      setRestricted(true);
      return;
    }
    const resource = PREMIUM_RESOURCE_CATALOG.find((r) => r.key === key);
    if (!resource) return;
    router.push({
      pathname: ROUTES.RESOURCE_VIEWER,
      params: { url: resource.url, title: label },
    });
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#fff' }}>
      <ScrollView>
        <View style={{ paddingHorizontal: 16, paddingTop: 20, paddingBottom: 14 }}>
          <Text style={{ fontSize: 22, fontWeight: '800', color: '#0f172a' }}>Premium Resources</Text>
          {!!tierText && (
            <Text style={{ fontSize: 14, color: '#6b7280', marginTop: 4 }}>
              Your plan: {tierText}
            </Text>
          )}
        </View>

        {MENU.map((item) => {
          const locked = !canAccess(item.key);
          return (
            <Pressable
              key={item.key}
              onPress={() => onPressItem(item.key, item.label)}
              accessibilityRole="button"
              accessibilityLabel={locked ? `${item.label}, locked` : item.label}
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
              <Ionicons name={item.icon as any} size={22} color="#2563eb" />
              <Text style={{ fontSize: 16, color: locked ? '#9ca3af' : '#1f2937', flex: 1 }}>
                {item.label}
              </Text>
              <Ionicons
                name={locked ? 'lock-closed' : 'chevron-forward'}
                size={18}
                color="#9ca3af"
              />
            </Pressable>
          );
        })}
      </ScrollView>

      <AccessRestrictedModal
        visible={restricted}
        onClose={() => setRestricted(false)}
        onUpgrade={() => {
          setRestricted(false);
          router.push(ROUTES.MEMBERSHIP_LEVELS);
        }}
      />
    </View>
  );
}
