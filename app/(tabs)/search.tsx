// app/(tabs)/search.tsx
/**
 * "Search CoRR Hub" — searches all website content (pages, posts, documents)
 * and opens results inside the app's resource viewer, which signs the member
 * in to the website automatically.
 */
import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Keyboard,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { ROUTES } from '../../constants/navigation';
import { SITE_SEARCH_MIN_CHARS, useDebouncedValue, useSiteSearch } from '../../hooks/useSearch';
import { siteSearchResultUrl } from '../../lib/siteSearch';
import type { SiteSearchResult } from '../../types';

const PRIMARY = '#0077b6';
const NAVY = '#002f6c';
const TEXT = '#111827';
const MUTED = '#6b7280';
const BORDER = '#e5e7eb';

const BADGE_COLORS: Record<string, { bg: string; fg: string }> = {
  page: { bg: '#e0f2fe', fg: '#075985' },
  post: { bg: '#dcfce7', fg: '#166534' },
  document: { bg: '#fef3c7', fg: '#92400e' },
};
const DEFAULT_BADGE = { bg: '#ede9fe', fg: '#5b21b6' };

export default function SearchScreen() {
  const [input, setInput] = useState('');
  const query = useDebouncedValue(input.trim(), 350);
  const tooShort = query.length < SITE_SEARCH_MIN_CHARS;

  const {
    data,
    error,
    isLoading,
    isFetching,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
    refetch,
  } = useSiteSearch(query);

  const results = useMemo(() => {
    const seen = new Set<string>();
    const out: SiteSearchResult[] = [];
    for (const page of data?.pages ?? []) {
      for (const item of page.results) {
        const key = `${item.type}:${item.id}`;
        if (seen.has(key)) continue;
        seen.add(key);
        out.push(item);
      }
    }
    return out;
  }, [data]);

  const total = data?.pages?.[0]?.total;

  const openResult = useCallback((item: SiteSearchResult) => {
    if (item.locked) {
      Alert.alert(
        'Members only',
        'This content is part of a higher membership level.',
        [
          { text: 'Not now', style: 'cancel' },
          { text: 'View plans', onPress: () => router.push(ROUTES.MEMBERSHIP_LEVELS) },
        ]
      );
      return;
    }
    const url = siteSearchResultUrl(item);
    if (!url) return;
    Keyboard.dismiss();
    router.push({
      pathname: ROUTES.RESOURCE_VIEWER,
      params: { url, title: item.title, returnTo: 'search' },
    });
  }, []);

  const renderItem = useCallback(
    ({ item }: { item: SiteSearchResult }) => {
      const colors = BADGE_COLORS[item.type] ?? DEFAULT_BADGE;
      return (
        <Pressable
          onPress={() => openResult(item)}
          style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
          accessibilityRole="button"
          accessibilityLabel={`${item.type_label}: ${item.title}`}
        >
          <View style={styles.rowTop}>
            <View style={[styles.badge, { backgroundColor: colors.bg }]}>
              <Text style={[styles.badgeText, { color: colors.fg }]}>{item.type_label}</Text>
            </View>
            {item.locked ? (
              <View style={styles.lockWrap}>
                <Ionicons name="lock-closed" size={12} color={MUTED} />
                <Text style={styles.lockText}>Members only</Text>
              </View>
            ) : null}
          </View>
          <Text style={styles.title} numberOfLines={2}>
            {item.title}
          </Text>
          {!!item.excerpt && (
            <Text style={styles.excerpt} numberOfLines={3}>
              {item.excerpt}
            </Text>
          )}
        </Pressable>
      );
    },
    [openResult]
  );

  let empty: React.ReactNode = null;
  if (tooShort) {
    empty = (
      <View style={styles.centered}>
        <Ionicons name="search" size={40} color="#cbd5e1" />
        <Text style={styles.emptyTitle}>Search CoRR Hub</Text>
        <Text style={styles.emptyText}>
          Find pages, articles, resources and documents from across the website.
        </Text>
      </View>
    );
  } else if (isLoading) {
    empty = (
      <View style={styles.centered}>
        <ActivityIndicator color={PRIMARY} />
      </View>
    );
  } else if (error) {
    empty = (
      <View style={styles.centered}>
        <Text style={styles.errorText}>Search isn’t available right now.</Text>
        <Pressable onPress={() => refetch()} style={styles.retryBtn} accessibilityRole="button">
          <Text style={styles.retryText}>Try again</Text>
        </Pressable>
      </View>
    );
  } else {
    empty = (
      <View style={styles.centered}>
        <Text style={styles.emptyTitle}>No results</Text>
        <Text style={styles.emptyText}>Nothing matched “{query}”. Try different words.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.searchBar}>
        <Ionicons name="search" size={18} color={MUTED} />
        <TextInput
          value={input}
          onChangeText={setInput}
          placeholder="Search CoRR Hub"
          placeholderTextColor="#9ca3af"
          style={styles.input}
          autoFocus
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
          clearButtonMode="never"
          accessibilityLabel="Search CoRR Hub"
        />
        {isFetching && !isFetchingNextPage && !tooShort ? (
          <ActivityIndicator size="small" color={PRIMARY} />
        ) : input.length > 0 ? (
          <Pressable onPress={() => setInput('')} hitSlop={10} accessibilityLabel="Clear search">
            <Ionicons name="close-circle" size={18} color="#9ca3af" />
          </Pressable>
        ) : null}
      </View>

      {!tooShort && results.length > 0 && (
        <Text style={styles.summary}>
          {typeof total === 'number' && total > 0
            ? `${total} result${total === 1 ? '' : 's'} for “${query}”`
            : `Results for “${query}”`}
        </Text>
      )}

      <FlatList
        data={tooShort ? [] : results}
        keyExtractor={(item) => `${item.type}:${item.id}`}
        renderItem={renderItem}
        ListEmptyComponent={empty}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        onEndReachedThreshold={0.4}
        onEndReached={() => {
          if (hasNextPage && !isFetchingNextPage) fetchNextPage();
        }}
        ListFooterComponent={
          isFetchingNextPage ? (
            <View style={styles.footer}>
              <ActivityIndicator color={PRIMARY} />
            </View>
          ) : null
        }
        contentContainerStyle={results.length === 0 || tooShort ? styles.emptyContent : undefined}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 8,
    paddingHorizontal: 14,
    height: 48,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 12,
    backgroundColor: '#f9fafb',
  },
  input: { flex: 1, height: '100%', fontSize: 16, color: TEXT, paddingVertical: 0 },
  summary: { marginHorizontal: 16, marginBottom: 4, color: MUTED, fontSize: 13 },
  row: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderColor: BORDER,
    gap: 6,
  },
  rowPressed: { backgroundColor: '#f3f4f6' },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  badge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 },
  badgeText: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4 },
  lockWrap: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  lockText: { fontSize: 12, color: MUTED },
  title: { fontSize: 16, fontWeight: '700', color: NAVY },
  excerpt: { fontSize: 14, lineHeight: 20, color: '#374151' },
  emptyContent: { flexGrow: 1 },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingVertical: 48,
    gap: 8,
  },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: NAVY, marginTop: 8 },
  emptyText: { fontSize: 14, color: MUTED, textAlign: 'center', lineHeight: 20 },
  errorText: { color: '#b91c1c', textAlign: 'center' },
  retryBtn: { paddingVertical: 8, paddingHorizontal: 16 },
  retryText: { color: PRIMARY, fontWeight: '700' },
  footer: { paddingVertical: 16 },
});
