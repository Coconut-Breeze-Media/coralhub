// app/(tabs)/index.tsx
import React, { useEffect, useMemo, useState, useCallback, useRef } from 'react';
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
    error, // you expose this from the hook already
  } = useActivityFeed(20);

  const replies = useActivityReplies();

  // Initial load
  useEffect(() => { load(1, true); }, [load]);

  const handleSubmit = useCallback(async () => {
    const text = composer.trim();
    if (!text) return;
    await submitStatus(text);
    setComposer('');
  }, [composer, submitStatus]);

  // One-shot guard for onEndReached (prevents double fire)
  const endReachedOK = useRef(true);
  const handleEndReached = useCallback(() => {
    if (!endReachedOK.current) return;
    endReachedOK.current = false;
    if (hasMore && !loading && !refreshing) {
      loadMore();
    }
  }, [hasMore, loading, refreshing, loadMore]);
  const onMomentumScrollBegin = useCallback(() => {
    endReachedOK.current = true;
  }, []);

  // Composer header (inside the list)
  const ListHeader = useCallback(() => (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={{ backgroundColor: '#fff' }}
    >
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
            disabled={!composer.trim()}
            style={{
              backgroundColor: composer.trim() ? PRIMARY : '#93c5fd',
              paddingHorizontal: 16,
              paddingVertical: 10,
              borderRadius: 10,
              opacity: !composer.trim() ? 0.8 : 1,
            }}
          >
            <Text style={{ color: '#fff', fontWeight: '700' }}>Post</Text>
          </TouchableOpacity>
        </View>
        {!!error && (
          <Text style={{ color: '#dc2626', marginTop: 8 }} numberOfLines={2}>
            {error}
          </Text>
        )}
      </View>
    </KeyboardAvoidingView>
  ), [composer, handleSubmit, error]);

  const renderItem = useCallback(
    ({ item }: { item: any }) => (
      <ActivityRow
        item={item}
        contentWidth={contentWidth}
        onLike={(id, liked) => toggleLike(id, liked)}
        onToggleComments={() => {
          replies.toggleOpen(item.id);
          if (!replies.isLoading(item.id) && !replies.getReplies(item.id).length) {
            replies.load(item.id);
          }
        }}
        commentsOpen={replies.isOpen(item.id)}
        replies={replies.getReplies(item.id)}
        repliesLoading={replies.isLoading(item.id)}
        replyValue={replies.getDraft(item.id)}
        onChangeReply={(v) => replies.setDraft(item.id, v)}
        onSubmitReply={() => replies.submit(item.id)}
        errorMessage={replies.getError(item.id) ?? undefined}
      />
    ),
    [contentWidth, replies, toggleLike]
  );

  const ListFooter = useCallback(() => {
    if (loading && hasMore) {
      return (
        <View style={{ paddingVertical: 16 }}>
          <ActivityIndicator />
        </View>
      );
    }
    if (!loading && !refreshing && items.length > 0 && !hasMore) {
      return (
        <View style={{ paddingVertical: 16, alignItems: 'center' }}>
          <Text style={{ color: '#6b7280' }}>You’re all caught up</Text>
        </View>
      );
    }
    return null;
  }, [loading, refreshing, hasMore, items.length]);

  const ListEmpty = useCallback(() => {
    if (loading || refreshing) return null;
    return (
      <View style={{ padding: 24, alignItems: 'center' }}>
        <Text style={{ color: '#6b7280' }}>
          No posts yet. Be the first to share something!
        </Text>
      </View>
    );
  }, [loading, refreshing]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>
      <FlatList
        data={items}
        keyExtractor={(it) => String(it.id)}
        renderItem={renderItem}
        ListHeaderComponent={ListHeader}
        ListFooterComponent={ListFooter}
        ListEmptyComponent={ListEmpty}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={refresh} />
        }
        onEndReachedThreshold={0.4}
        onEndReached={handleEndReached}
        onMomentumScrollBegin={onMomentumScrollBegin}
        // Virtualization hints
        initialNumToRender={6}
        maxToRenderPerBatch={8}
        windowSize={7}
        removeClippedSubviews
        // Keep position stable when refreshing on iOS
        maintainVisibleContentPosition={{ minIndexForVisible: 0, autoscrollToTopThreshold: 10 }}
      />
    </SafeAreaView>
  );
}