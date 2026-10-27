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
  Alert,
  AppState,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { ApiError, getAppCheckoutLink, getMembershipLevels } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import type { MembershipLevel } from '../../types';

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


const decodeEntities = (t: string) =>
  t
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&#8217;|&rsquo;/gi, "'")
    .replace(/&quot;/gi, '"');

const BULLET_RE = /^\s*(?:[•·▪◦●✓✔☑*\-–—]|\d+[.)])\s*/;

/**
 * Split a level description into { intro, items }.
 * Server shape: intro paragraph(s), blank lines, then feature lines that are
 * indented with tab/space (PMPro list markup stripped) or bulleted.
 * Rule: a line is a feature item if it is indented (leading tab/space, when
 * the description has a non-indented first paragraph) or starts with a bullet
 * marker; "a; b; c" lines become several items. A first short un-indented,
 * un-punctuated line block with no indented lines falls back to items too.
 * Everything else (sentences) stays as intro.
 */
export function parseDescription(raw?: string): { intro: string; items: string[] } {
  if (!raw) return { intro: '', items: [] };
  const text = decodeEntities(raw.replace(/<\/?(?:p|li|ul|ol|br)[^>]*>/gi, '\n').replace(/<[^>]+>/g, ''));
  const lines = text.split(/\r\n|\r|\n/).filter((l) => l.trim() !== '');
  const intro: string[] = [];
  const items: string[] = [];
  const pushItem = (t: string) => {
    t.split(/\s*;\s*/).map((x) => x.trim()).filter(Boolean).forEach((x) => items.push(x));
  };
  let seenIntro = false;
  const isSentence = (t: string) => /[.:!?]$/.test(t.trim()) && t.trim().length > 40;
  for (const line of lines) {
    const indented = /^[\t ]/.test(line);
    const bullet = BULLET_RE.test(line);
    const t = line.replace(BULLET_RE, '').trim();
    if (!t) continue;
    if (bullet || (indented && seenIntro) || (indented && intro.length === 0 && items.length > 0)) {
      pushItem(t);
    } else if (!isSentence(t) && (seenIntro || lines.length > 1) && t.length <= 60 && intro.length > 0 && !/[.:!?]$/.test(t)) {
      pushItem(t);
    } else {
      intro.push(t);
      seenIntro = true;
    }
  }
  return { intro: intro.join('\n\n'), items };
}

const mergeUnique = (...lists: string[][]) => {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const list of lists) {
    for (const item of list) {
      const k = item.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
      if (k && !seen.has(k)) {
        seen.add(k);
        out.push(item);
      }
    }
  }
  return out;
};

// Optional: mark a plan as “featured” (adds a small badge & subtle border)
const isFeatured = (lvl: MembershipLevel) =>
  /^annual/i.test(lvl.name) || /^institutional/i.test(lvl.name);

function LevelCard({
  level,
  onSelect,
  isCurrent = false,
  opening = false,
}: {
  level: MembershipLevel;
  onSelect: (level: MembershipLevel) => void;
  isCurrent?: boolean;
  opening?: boolean;
}) {
  const parsed = parseDescription(level.description);
  const benefits = mergeUnique(
    level.benefits ?? [],
    parsed.items,
    (level.benefits?.length ?? 0) + parsed.items.length === 0 ? defaultBenefitsFor(level.name) : []
  );

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

        {isCurrent ? (
          <View
            style={{
              paddingHorizontal: 10,
              paddingVertical: 4,
              borderRadius: 999,
              backgroundColor: '#dcfce7',
            }}
          >
            <Text style={{ color: '#166534', fontWeight: '700', fontSize: 12 }}>
              Current plan
            </Text>
          </View>
        ) : featured && (
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
      {!!parsed.intro && (
        <Text style={{ color: '#374151', lineHeight: 20, marginBottom: benefits.length ? 12 : 16 }}>
          {parsed.intro}
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
        onPress={() => onSelect(level)}
        disabled={isCurrent || opening}
        style={{
          height: 48,
          borderRadius: 12,
          backgroundColor: isCurrent ? '#e5e7eb' : PRIMARY,
          alignItems: 'center',
          justifyContent: 'center',
          opacity: opening ? 0.7 : 1,
        }}
        activeOpacity={0.8}
        accessibilityRole="button"
        accessibilityLabel={isCurrent ? `${level.name} is your current plan` : `Select ${level.name}`}
      >
        {opening ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={{ color: isCurrent ? MUTED : '#fff', fontWeight: '700', fontSize: 16 }}>
            {isCurrent ? 'Current plan' : 'Select'}
          </Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

export default function MembershipLevelsScreen() {
  const [levels, setLevels] = useState<MembershipLevel[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [openingLevelId, setOpeningLevelId] = useState<number | null>(null);
  const { token, membership, refreshMembership } = useAuth();
  const currentLevelIds = useMemo(() => {
    const ids = new Set<number>();
    if (membership?.level_id) ids.add(membership.level_id);
    membership?.levels?.forEach((lvl) => ids.add(lvl.id));
    return ids;
  }, [membership]);

  // Checkout happens in the browser; re-check membership when the member
  // comes back to the app so an upgrade shows up immediately.
  useEffect(() => {
    if (!token) return;
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') refreshMembership();
    });
    return () => sub.remove();
  }, [token, refreshMembership]);

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

  const openCheckout = async (level: MembershipLevel) => {
    if (!token) {
      Linking.openURL(level.checkout_url);
      return;
    }

    // Logged-in members are upgrading/changing level: carry their session into
    // checkout so PMPro applies the level to the existing account instead of
    // asking them to register again ("That username is already taken").
    setOpeningLevelId(level.id);
    try {
      const url = await getAppCheckoutLink(token, level.id);
      await Linking.openURL(url);
    } catch (e) {
      const notDeployed = e instanceof ApiError && (e.status === 404 || e.status === 405);
      Alert.alert(
        'Sign in to continue',
        notDeployed
          ? 'We could not start a signed-in checkout. On the next page, log in with your existing CoRR Hub account before completing checkout — do not register a new account.'
          : 'We could not connect your account to checkout. On the next page, log in with your existing CoRR Hub account before completing checkout.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Continue', onPress: () => Linking.openURL(level.checkout_url) },
        ]
      );
    } finally {
      setOpeningLevelId(null);
    }
  };

  // Nice empty-state if no levels
  const empty = useMemo(
    () => !loading && !err && levels.length === 0,
    [loading, err, levels.length]
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>
      
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
            ListHeaderComponent={
              token ? (
                <Text style={{ color: MUTED, fontSize: 14, marginBottom: 12 }}>
                  Choose a new plan for your account. You will stay signed in during checkout.
                </Text>
              ) : null
            }
            renderItem={({ item }) => (
              <LevelCard
                level={item}
                onSelect={openCheckout}
                isCurrent={!!token && currentLevelIds.has(item.id)}
                opening={openingLevelId === item.id}
              />
            )}
            contentContainerStyle={{
              paddingTop: 12,
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
