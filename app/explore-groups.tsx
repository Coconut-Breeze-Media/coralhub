// app/explore-groups.tsx
import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  RefreshControl,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useAuth } from '../lib/auth';
import { useAllGroups } from '../hooks/useGroups';
import BackButton from '../components/BackButton';
import type { BPGroup } from '../types';

const STATUS_COLORS: Record<string, { bg: string; text: string; icon: string }> = {
  public: { bg: '#dcfce7', text: '#15803d', icon: 'earth-outline' },
  private: { bg: '#fef3c7', text: '#a16207', icon: 'lock-closed-outline' },
  hidden: { bg: '#f3f4f6', text: '#4b5563', icon: 'eye-off-outline' },
};

export default function ExploreGroupsScreen() {
  const { token } = useAuth();
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const debounceRef = useState<ReturnType<typeof setTimeout> | null>(null);

  const { data: groups, isLoading, refetch } = useAllGroups(token, {
    per_page: 50,
    search: debouncedSearch || undefined,
  });


  console.log('Grupos:', groups);

  const handleSearchChange = (text: string) => {
    setSearch(text);
    if (debounceRef[0]) clearTimeout(debounceRef[0]);
    debounceRef[1](
      setTimeout(() => setDebouncedSearch(text), 400)
    );
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  const getStatusConfig = (status: string) =>
    STATUS_COLORS[status] || STATUS_COLORS.public;

  const renderGroup = ({ item }: { item: BPGroup }) => {
    const statusConfig = getStatusConfig(item.status);
    return (
      <TouchableOpacity
        activeOpacity={0.7}
        onPress={() => router.push(`/group-detail?id=${item.id}`)}
        style={styles.card}
      >
        {/* Avatar */}
        <View style={styles.avatarContainer}>
          {item.avatar_urls?.thumb ? (
            <Image source={{ uri: item.avatar_urls.thumb }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarPlaceholder]}>
              <Ionicons name="people" size={24} color="#3b82f6" />
            </View>
          )}
        </View>

        {/* Info */}
        <View style={styles.info}>
          <View style={styles.nameRow}>
            <Text style={styles.groupName} numberOfLines={1}>{item.name}</Text>
            <View style={[styles.badge, { backgroundColor: statusConfig.bg }]}>
              <Ionicons
                name={statusConfig.icon as any}
                size={11}
                color={statusConfig.text}
              />
              <Text style={[styles.badgeText, { color: statusConfig.text }]}>
                {item.status}
              </Text>
            </View>
          </View>

          {item.description?.rendered ? (
            <Text style={styles.description} numberOfLines={2}>
              {item.description.rendered.replace(/<[^>]*>/g, '')}
            </Text>
          ) : null}

          <View style={styles.meta}>
            <Ionicons name="people-outline" size={13} color="#9ca3af" />
            <Text style={styles.metaText}>
              {item.total_member_count === 1
                ? '1 member'
                : `${item.total_member_count} members`}
            </Text>
            {item.last_activity_diff ? (
              <>
                <Text style={styles.dot}>·</Text>
                <Ionicons name="time-outline" size={13} color="#9ca3af" />
                <Text style={styles.metaText}>Active {item.last_activity_diff}</Text>
              </>
            ) : null}
          </View>
        </View>

        <Ionicons name="chevron-forward" size={18} color="#d1d5db" />
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <BackButton />
          <Text style={styles.headerTitle}>Explore Groups</Text>
        </View>
        {/* Search */}
        <View style={styles.searchBox}>
          <Ionicons name="search-outline" size={16} color="#9ca3af" style={{ marginRight: 8 }} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search groups..."
            placeholderTextColor="#9ca3af"
            value={search}
            onChangeText={handleSearchChange}
            returnKeyType="search"
            clearButtonMode="while-editing"
          />
        </View>
      </View>

      {/* List */}
      {isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#2563eb" />
          <Text style={styles.loadingText}>Loading groups...</Text>
        </View>
      ) : (
        <FlatList
          data={groups ?? []}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderGroup}
          contentContainerStyle={
            groups && groups.length === 0 ? styles.emptyContainer : styles.list
          }
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#2563eb']} />
          }
          ListEmptyComponent={
            <View style={styles.emptyBox}>
              <Ionicons name="people-outline" size={48} color="#d1d5db" />
              <Text style={styles.emptyTitle}>
                {debouncedSearch ? 'No groups found' : 'No groups available'}
              </Text>
              <Text style={styles.emptySubtitle}>
                {debouncedSearch
                  ? `No groups match "${debouncedSearch}"`
                  : 'Check back later for new groups to join.'}
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  header: {
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    paddingHorizontal: 16,
    paddingTop: 60,
    paddingBottom: 12,
    gap: 12,
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  headerTitle: { fontSize: 20, fontWeight: '700', color: '#1f2937', flex: 1 },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f3f4f6',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  searchInput: { flex: 1, fontSize: 15, color: '#1f2937' },
  list: { padding: 16, gap: 10 },
  emptyContainer: { flex: 1, padding: 16 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  avatarContainer: { marginRight: 12 },
  avatar: { width: 52, height: 52, borderRadius: 26 },
  avatarPlaceholder: {
    backgroundColor: '#eff6ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  info: { flex: 1, gap: 4 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  groupName: { flex: 1, fontSize: 16, fontWeight: '700', color: '#1f2937' },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
  },
  badgeText: { fontSize: 11, fontWeight: '600', textTransform: 'capitalize' },
  description: { fontSize: 13, color: '#6b7280', lineHeight: 18 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { fontSize: 12, color: '#9ca3af' },
  dot: { fontSize: 12, color: '#d1d5db' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadingText: { color: '#6b7280', fontSize: 14 },
  emptyBox: { alignItems: 'center', paddingVertical: 60, gap: 12 },
  emptyTitle: { fontSize: 18, fontWeight: '600', color: '#374151' },
  emptySubtitle: { fontSize: 14, color: '#9ca3af', textAlign: 'center' },
});
