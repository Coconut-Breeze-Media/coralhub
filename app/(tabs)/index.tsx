// app/(tabs)/index.tsx
import React, { useEffect, useMemo, useState, useCallback } from 'react';
import {
  SafeAreaView,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  RefreshControl,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useWindowDimensions } from 'react-native';
import { useActivityFeed } from '../../hooks/useActivityFeed';
import { useActivityReplies } from '../../hooks/useActivityReplies';
import ActivityRow from '../../components/ActivityRow';

const PRIMARY = '#0077b6';
const BORDER  = '#e5e7eb';

export default function ActivityTab() {
  const { width } = useWindowDimensions();
  const contentWidth = useMemo(() => Math.max(0, width - 32), [width]);

  const [composer, setComposer] = useState('');

  const {
    items,
    loading,
    refreshing,
    hasMore,
    load,
    refresh,
    loadMore,
    submitStatus,
    toggleLike,
    // posting, // ← expose from hook if you want to disable the button while posting
  } = useActivityFeed(20);

  const replies = useActivityReplies();

  // Initial load
  useEffect(() => { load(1, true); }, [load]);

  // Handlers (stable refs)
  const handleSubmit = useCallback(async () => {
    const text = composer.trim();
    if (!text) return;
    await submitStatus(text);
    setComposer('');
  }, [composer, submitStatus]);

  const handleEndReached = useCallback(() => {
    if (hasMore) loadMore(); // hook should guard if already loading
  }, [hasMore, loadMore]);

  const renderItem = useCallback(
    ({ item }: any) => (
      <ActivityRow
        item={item}
        contentWidth={width - 32}
        onLike={(id, liked) => toggleLike(id, liked)}
        onToggleComments={() => {
          replies.toggleOpen(item.id);
          if (!replies.getReplies(item.id).length) replies.load(item.id);
        }}
        commentsOpen={replies.isOpen(item.id)}
        replies={replies.getReplies(item.id)}
        repliesLoading={replies.isLoading(item.id)}
        replyValue={replies.getDraft(item.id)}
        onChangeReply={(v) => replies.setDraft(item.id, v)}
        onSubmitReply={() => replies.submit(item.id)}
        errorMessage={replies.getError(item.id) ?? undefined}   
        // sending={replies.isPosting(item.id)} // optional if you add posting state
      />
    ),
    [contentWidth, replies, toggleLike]
  );

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: '#fff' }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>
        {/* Composer */}
        <View style={{ padding: 16, borderBottomWidth: 1, borderColor: BORDER }}>
          <Text style={{ fontSize: 18, fontWeight: '700', marginBottom: 8 }}>
            What’s new?
          </Text>
          <TextInput
            value={composer}
            onChangeText={setComposer}
            placeholder="Share an update…"
            multiline
            style={{
              borderWidth: 1,
              borderColor: BORDER,
              borderRadius: 10,
              padding: 12,
              minHeight: 60,
            }}
          />
          <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 10 }}>
            <TouchableOpacity
              onPress={handleSubmit}
              disabled={!composer.trim() /* || posting */}
              style={{
                backgroundColor: composer.trim() ? PRIMARY : '#93c5fd',
                paddingHorizontal: 16,
                paddingVertical: 10,
                borderRadius: 10,
              }}
            >
              <Text style={{ color: '#fff', fontWeight: '700' }}>
                Post
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Feed */}
        <FlatList
          data={items}
          keyExtractor={(it) => String(it.id)}
          renderItem={renderItem}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={refresh} />
          }
          onEndReachedThreshold={0.4}
          onEndReached={handleEndReached}
          ListFooterComponent={
            loading ? (
              <View style={{ paddingVertical: 16 }}>
                <ActivityIndicator />
              </View>
            ) : null
          }
          ListEmptyComponent={
            !loading && !refreshing ? (
              <View style={{ padding: 24, alignItems: 'center' }}>
                <Text style={{ color: '#6b7280' }}>
                  No posts yet. Be the first to share something!
                </Text>
              </View>
            ) : null
          }
        />
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}