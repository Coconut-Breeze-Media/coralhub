// app/tabs/index.tsx
// import { Text, View } from 'react-native';

// export default function PlaceholderScreen() {
//   return (
//     <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
//       <Text>News Feed (placeholder)</Text>
//     </View>
//   );
// }

// app/(tabs)/index.tsx
import React, { useEffect, useState, useCallback } from 'react';
import {
  SafeAreaView, View, Text, TextInput, TouchableOpacity,
  FlatList, RefreshControl, ActivityIndicator, Image,
} from 'react-native';
import { useAuth } from '../../lib/auth';
import {
  getActivity, getMembersByIds, postActivity,
  favoriteActivity, unfavoriteActivity,
  type BPMember, type ActivityItem,
} from '../../lib/api';

const PRIMARY = '#0077b6';
const BORDER  = '#e5e7eb';
const MUTED   = '#6b7280';

// very small helper for plain-text preview
const stripHtml = (raw?: string) =>
  (raw || '').replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').trim();

// we take ActivityItem (has id, user_id, date, html) and add the resolved member
type HydratedActivity = ActivityItem & { member?: BPMember };

// ---------- Row ----------
function ActivityRow({
  item,
  onLike,
  onReplyPress,
}: {
  item: HydratedActivity;
  onLike: (id: number, liked: boolean) => void;
  onReplyPress: (item: HydratedActivity) => void;
}) {
  const avatar =
    item.member?.avatar_urls?.thumb ||
    item.member?.avatar_urls?.full ||
    undefined;

  const name = item.member?.name || 'Member';
  const text = stripHtml(item.html); // ← render html as text for now

  return (
    <View style={{ paddingVertical: 12, borderBottomWidth: 1, borderColor: BORDER }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 6 }}>
        {avatar ? (
          <Image
            source={{ uri: avatar }}
            style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: '#ddd' }}
          />
        ) : (
          <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: '#e5e7eb' }} />
        )}

        <View style={{ flex: 1 }}>
          <Text style={{ fontWeight: '700' }} numberOfLines={1}>{name}</Text>
          <Text style={{ color: MUTED, fontSize: 12 }}>
            {new Date(item.date).toLocaleString()}
          </Text>
        </View>
      </View>

      {!!text && <Text style={{ lineHeight: 20 }}>{text}</Text>}

      <View style={{ flexDirection: 'row', gap: 16, marginTop: 10 }}>
        <TouchableOpacity onPress={() => onLike(item.id, !!(item as any).favorited)}>
          <Text style={{ color: PRIMARY }}>
            {(item as any).favorited ? '♥ Liked' : '♡ Like'} {(item as any).favorite_count ?? ''}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => onReplyPress(item)}>
          <Text style={{ color: PRIMARY }}>Comment {(item as any).comment_count ?? ''}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ---------- Screen ----------
export default function ActivityTab() {
  const { token } = useAuth();

  const [composer, setComposer] = useState('');
  const [items, setItems] = useState<HydratedActivity[]>([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  // fetch + hydrate members + sort by date desc
  const load = useCallback(
    async (nextPage: number, replace = false) => {
      if (loading) return;
      setLoading(true);
      try {
        const acts = await getActivity(nextPage, 20); // ActivityItem[] (has html)

        // collect unique user ids and fetch member profiles
        const ids = Array.from(new Set(acts.map(a => a.user_id).filter(Boolean))) as number[];
        const members = await getMembersByIds(ids);

        // hydrate + sort newest first
        const hydrated: HydratedActivity[] = acts
          .map(a => ({ ...a, member: members[a.user_id] }))
          .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

        setHasMore(hydrated.length > 0);
        setItems(prev => (replace ? hydrated : [...prev, ...hydrated]));
        setPage(nextPage);
      } catch (e) {
        console.warn('load feed failed:', e);
      } finally {
        setLoading(false);
      }
    },
    [loading]
  );

  useEffect(() => {
    load(1, true);
  }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load(1, true);
    setRefreshing(false);
  };

  const onEndReached = () => {
    if (!loading && hasMore) load(page + 1);
  };

  const submitStatus = async () => {
    const text = composer.trim();
    if (!text || !token) return;
    setComposer('');
    try {
      await postActivity(text, token);
      await onRefresh();
    } catch (e) {
      console.warn('postActivity failed', e);
    }
  };

  const handleLike = async (id: number, liked: boolean) => {
    if (!token) return;
    // optimistic toggle
    setItems(prev =>
      prev.map(i =>
        i.id === id
          ? {
              ...i,
              // @ts-ignore - these come from BuddyPress server
              favorited: !liked,
              // @ts-ignore
              favorite_count: (i as any).favorite_count
                ? (i as any).favorite_count + (liked ? -1 : 1)
                : !liked ? 1 : 0,
            }
          : i
      )
    );
    try {
      if (liked) await unfavoriteActivity(id, token);
      else await favoriteActivity(id, token);
    } catch (e) {
      // rollback
      setItems(prev =>
        prev.map(i =>
          i.id === id
            ? {
                ...i,
                // @ts-ignore
                favorited: liked,
                // @ts-ignore
                favorite_count: (i as any).favorite_count
                  ? (i as any).favorite_count + (liked ? 1 : -1)
                  : liked ? 1 : 0,
              }
            : i
        )
      );
      console.warn('favorite toggle failed', e);
    }
  };

  const openReplySheet = (item: HydratedActivity) => {
    // TODO: push to a replies screen or show a bottom sheet
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>
      {/* Composer */}
      <View style={{ padding: 16, borderBottomWidth: 1, borderColor: BORDER }}>
        <Text style={{ fontSize: 18, fontWeight: '700', marginBottom: 8 }}>What’s new?</Text>
        <TextInput
          value={composer}
          onChangeText={setComposer}
          placeholder="Share an update…"
          multiline
          style={{
            borderWidth: 1, borderColor: BORDER, borderRadius: 10,
            padding: 12, minHeight: 60,
          }}
        />
        <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 10 }}>
          <TouchableOpacity
            onPress={submitStatus}
            disabled={!composer.trim()}
            style={{
              backgroundColor: composer.trim() ? PRIMARY : '#93c5fd',
              paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10,
            }}
          >
            <Text style={{ color: '#fff', fontWeight: '700' }}>Post</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Feed */}
      <FlatList
        data={items}
        keyExtractor={it => String(it.id)}
        renderItem={({ item }) => (
          <ActivityRow item={item} onLike={handleLike} onReplyPress={openReplySheet} />
        )}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        onEndReachedThreshold={0.4}
        onEndReached={onEndReached}
        ListFooterComponent={
          loading ? (
            <View style={{ paddingVertical: 16 }}>
              <ActivityIndicator />
            </View>
          ) : null
        }
      />
    </SafeAreaView>
  );
}