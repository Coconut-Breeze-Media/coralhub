import React from 'react';
import { SafeAreaView, View, Text, FlatList, RefreshControl, ActivityIndicator } from 'react-native';

export default function ActivityList({
  data,
  renderItem,
  header,
  footerWhen,
  emptyWhen,
  onRefresh, refreshing,
  onEndReached, onMomentumScrollBegin,
}: {
  data: any[];
  renderItem: any;
  header: React.ReactElement | null;
  footerWhen: { loading: boolean; hasMore: boolean; itemsCount: number };
  emptyWhen: { loading: boolean; refreshing: boolean };
  onRefresh: () => void;
  refreshing: boolean;
  onEndReached: () => void;
  onMomentumScrollBegin: () => void;
}) {
  const { loading, hasMore, itemsCount } = footerWhen;
  const { loading: listLoading, refreshing: listRefreshing } = emptyWhen;

  const ListFooter = () => {
    if (loading && hasMore) return <View style={{ paddingVertical: 16 }}><ActivityIndicator /></View>;
    if (!loading && !listRefreshing && itemsCount > 0 && !hasMore)
      return <View style={{ paddingVertical: 16, alignItems: 'center' }}><Text style={{ color: '#6b7280' }}>You’re all caught up</Text></View>;
    return null;
  };

  const ListEmpty = () => {
    if (listLoading || listRefreshing) return null;
    return <View style={{ padding: 24, alignItems: 'center' }}><Text style={{ color: '#6b7280' }}>No posts yet. Be the first to share something!</Text></View>;
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>
      <FlatList
        data={data}
        keyExtractor={(it) => String(it.id)}
        renderItem={renderItem}
        ListHeaderComponent={header}
        ListFooterComponent={ListFooter}
        ListEmptyComponent={ListEmpty}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        onEndReachedThreshold={0.4}
        onEndReached={onEndReached}
        onMomentumScrollBegin={onMomentumScrollBegin}
        initialNumToRender={6}
        maxToRenderPerBatch={8}
        windowSize={7}
        removeClippedSubviews
        maintainVisibleContentPosition={{ minIndexForVisible: 0, autoscrollToTopThreshold: 10 }}
      />
    </SafeAreaView>
  );
}