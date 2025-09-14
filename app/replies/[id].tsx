// app/replies/[id].tsx
import { useLocalSearchParams, router } from 'expo-router';
import React, { useEffect, useState, useCallback } from 'react';
import {
  SafeAreaView,
  View,
  FlatList,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Linking,
  Image,
  RefreshControl,
} from 'react-native';
import RenderHTML from 'react-native-render-html';
import { useWindowDimensions } from 'react-native';
import { useAuth } from '../../lib/auth';
import {
  getActivityReplies,
  postActivityReply,
  getMembersByIds,
  type BPActivity,
  type BPMember,
  sanitizeBuddyHtml, 
} from '../../lib/api';

const BORDER  = '#e5e7eb';
const PRIMARY = '#0077b6';
const MUTED   = '#6b7280';

type HydratedReply = BPActivity & { member?: BPMember };

export default function RepliesScreen() {
  // Normalize the dynamic route param: id -> number or NaN
  const params = useLocalSearchParams();
  const rawId = Array.isArray(params.id) ? params.id[0] : params.id;
  const activityId = rawId ? Number(rawId) : NaN;

  const invalid = Number.isNaN(activityId) || activityId <= 0;
  const sortAsc = true; // oldest → newest like a conversation thread

  const { token } = useAuth();
  const { width } = useWindowDimensions();

  const [items, setItems] = useState<HydratedReply[]>([]);
  const [busy, setBusy] = useState(true);           // initial load
  const [refreshing, setRefreshing] = useState(false);
  const [posting, setPosting] = useState(false);    // ⬅️ NEW: prevent double-submit
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Load replies + hydrate members
  const load = useCallback(async () => {
    if (invalid) return;
    // show full-screen spinner only on first load (when items are empty)
    if (items.length === 0) setBusy(true);
    try {
      const list = await getActivityReplies(activityId, 1); // BPActivity[]

      const ids = Array.from(new Set(list.map(r => r.user_id).filter(Boolean))) as number[];
      const members = await getMembersByIds(ids);

      const hydrated: HydratedReply[] = list
        .map(r => ({ ...r, member: members[r.user_id] }))
        .sort((a, b) => {
          const ta = new Date(a.date).getTime();
          const tb = new Date(b.date).getTime();
          return sortAsc ? ta - tb : tb - ta;
        });

      setItems(hydrated);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }, [activityId, invalid, sortAsc, items.length]);

  useEffect(() => { void load(); }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  async function submit() {
    const body = text.trim();
    if (invalid || !body || !token || posting) return; // ⬅️ guard while posting
    setPosting(true);
    setText('');
    try {
      await postActivityReply(activityId, body, token);
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setPosting(false);
    }
  }

  if (invalid) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#fff', padding: 16 }}>
        <Text style={{ fontWeight: '700', fontSize: 16, marginBottom: 8 }}>
          Invalid activity
        </Text>
        <Text style={{ color: MUTED, marginBottom: 16 }}>
          We couldn’t open this conversation.
        </Text>
        <TouchableOpacity onPress={() => router.back()} style={{ padding: 12 }}>
          <Text style={{ color: PRIMARY, fontWeight: '700' }}>Go back</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>
      {/* Optional inline error */}
      {error && (
        <View style={{ paddingHorizontal: 16, paddingTop: 12 }}>
          <Text style={{ color: 'red' }}>{error}</Text>
        </View>
      )}

      {busy && items.length === 0 ? (
        <View style={{ padding: 16 }}>
          <ActivityIndicator />
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(i) => String(i.id)}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          contentContainerStyle={{ padding: 16, paddingBottom: 24 }}
          renderItem={({ item }) => {
            const avatar =
              item.member?.avatar_urls?.thumb ||
              item.member?.avatar_urls?.full ||
              undefined;
            const name = item.member?.name || 'Member';
            const html =
              typeof item.content === 'string'
                ? sanitizeBuddyHtml(item.content)    // 👈 sanitize here
                : sanitizeBuddyHtml(item.content?.rendered ?? '');

            return (
              <View
                style={{
                  paddingVertical: 12,
                  borderBottomWidth: 1,
                  borderColor: BORDER,
                  gap: 8,
                }}
              >
                {/* header: avatar + name + time */}
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  {avatar ? (
                    <Image
                      source={{ uri: avatar }}
                      style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: '#ddd' }}
                    />
                  ) : (
                    <View
                      style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: '#e5e7eb' }}
                    />
                  )}
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontWeight: '700' }} numberOfLines={1}>
                      {name}
                    </Text>
                    <Text style={{ color: MUTED, fontSize: 12 }}>
                      {new Date(item.date).toLocaleString()}
                    </Text>
                  </View>
                </View>

                {/* body: HTML */}
                {!!html && (
                  <RenderHTML
                    contentWidth={width - 32}
                    source={{ html }}
                    renderersProps={{
                      a: {
                        onPress: (_event, href?: string) => {
                          if (href) Linking.openURL(href);
                        },
                      },
                      img: {
                        enableExperimentalPercentWidth: true,
                      },
                    }}
                  />
                )}
              </View>
            );
          }}
          ListEmptyComponent={<Text>No comments yet.</Text>}
        />
      )}

      {/* composer */}
      <View
        style={{
          padding: 12,
          borderTopWidth: 1,
          borderColor: BORDER,
          gap: 8,
        }}
      >
        <TextInput
          value={text}
          onChangeText={setText}
          placeholder="Write a comment…"
          multiline
          style={{
            borderWidth: 1,
            borderColor: BORDER,
            borderRadius: 10,
            padding: 10,
            minHeight: 44,
          }}
        />
        <TouchableOpacity
          onPress={submit}
          disabled={posting || !text.trim()}
          style={{
            backgroundColor: text.trim() && !posting ? PRIMARY : '#93c5fd',
            padding: 12,
            borderRadius: 10,
            alignItems: 'center',
            opacity: posting ? 0.7 : 1,
          }}
        >
          <Text style={{ color: '#fff', fontWeight: '700' }}>
            {posting ? 'Posting…' : 'Post comment'}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}