// app/(tabs)/networking.tsx
import React, { useState } from 'react';
import {
  View,
  Text,
  FlatList,
  Image,
  TouchableOpacity,
  TextInput,
  RefreshControl,
  Alert,
  ActivityIndicator,
  StyleSheet,
  Platform,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useAuth } from '../../lib/auth';
import {
  useMe,
  useFriendsList,
  useRemoveFriend,
  usePendingFriendRequests,
  useAcceptFriendRequest,
  useRejectFriendRequest,
  useSendFriendRequest,
} from '../../hooks/useQueries';
import { useMember, useMembersList } from '../../hooks/useMembers';
import { useAllGroups } from '../../hooks/useGroups';
import RemoveFriendModal from '../../components/RemoveFriendModal';
import type { FriendWithDetails, BPFriendship, BPMember, BPGroup } from '../../types';

type SectionType = 'members' | 'groups';
type MembersTab = 'connect' | 'friends' | 'requests';
type GroupsTab = 'explore' | 'mygroups';

// ─── Status badge config ─────────────────────────────────────────────────────
const STATUS_COLORS: Record<string, { bg: string; text: string; icon: string }> = {
  public:  { bg: '#dcfce7', text: '#15803d', icon: 'earth-outline' },
  private: { bg: '#fef3c7', text: '#a16207', icon: 'lock-closed-outline' },
  hidden:  { bg: '#f3f4f6', text: '#4b5563', icon: 'eye-off-outline' },
};

// ─── Connect Tab ─────────────────────────────────────────────────────────────
function ConnectTab() {
  const { token } = useAuth();
  const [searchInput, setSearchInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [sentIds, setSentIds] = useState<Set<number>>(new Set());
  const [pendingIds, setPendingIds] = useState<Set<number>>(new Set());

  const { data: members, isLoading } = useMembersList(token, { search: searchQuery, perPage: 20 });
  const sendFriendMutation = useSendFriendRequest();

  const handleConnect = async (memberId: number, memberName: string) => {
    setPendingIds(prev => new Set([...prev, memberId]));
    try {
      await sendFriendMutation.mutateAsync(memberId);
      setSentIds(prev => new Set([...prev, memberId]));
      Alert.alert('Request Sent', `Friend request sent to ${memberName}!`);
    } catch (err) {
      Alert.alert('Error', `Failed to send request: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setPendingIds(prev => { const n = new Set(prev); n.delete(memberId); return n; });
    }
  };

  const renderMemberItem = ({ item }: { item: BPMember }) => {
    const avatarUrl = item.avatar_urls?.thumb || item.avatar_urls?.full;
    const statusSlug = item.friendship_status_slug;
    const isPending = pendingIds.has(item.id);
    const hasSent = sentIds.has(item.id);
    const isAlreadyFriend = statusSlug === 'is_friend';
    const hasRequest = statusSlug === 'pending' || statusSlug === 'awaiting_response' || hasSent;

    return (
      <View style={styles.friendCard}>
        <View style={styles.friendInfo}>
          {avatarUrl ? (
            <Image source={{ uri: avatarUrl }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarPlaceholder]}>
              <Text style={styles.avatarPlaceholderText}>{item.name.charAt(0).toUpperCase()}</Text>
            </View>
          )}
          <View style={styles.friendDetails}>
            <Text style={styles.friendName}>{item.name}</Text>
            {item.last_activity?.timediff && (
              <Text style={styles.lastActive}>Active {item.last_activity.timediff}</Text>
            )}
          </View>
        </View>
        {isAlreadyFriend ? (
          <View style={styles.friendStatusBadge}>
            <Ionicons name="checkmark-circle" size={16} color="#22c55e" />
            <Text style={styles.friendStatusText}>Friends</Text>
          </View>
        ) : hasRequest ? (
          <View style={styles.pendingBadge}>
            <Ionicons name="time-outline" size={16} color="#0066cc" />
            <Text style={styles.pendingText}>Pending</Text>
          </View>
        ) : (
          <TouchableOpacity
            style={styles.addFriendButton}
            onPress={() => handleConnect(item.id, item.name)}
            disabled={isPending}
            activeOpacity={0.7}
          >
            {isPending ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Ionicons name="person-add-outline" size={15} color="#fff" />
                <Text style={styles.addFriendText}>Connect</Text>
              </>
            )}
          </TouchableOpacity>
        )}
      </View>
    );
  };

  return (
    <View style={{ flex: 1 }}>
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search members..."
          placeholderTextColor="#999"
          value={searchInput}
          onChangeText={setSearchInput}
          onSubmitEditing={() => setSearchQuery(searchInput)}
          returnKeyType="search"
        />
        <TouchableOpacity style={styles.searchButton} onPress={() => setSearchQuery(searchInput)} activeOpacity={0.8}>
          <Ionicons name="search" size={18} color="#fff" />
        </TouchableOpacity>
      </View>
      {isLoading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#0066cc" />
          <Text style={styles.loadingText}>Loading members...</Text>
        </View>
      ) : (
        <FlatList
          data={members || []}
          renderItem={renderMemberItem}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={styles.listContent}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          ListEmptyComponent={() => (
            <View style={styles.emptyContainer}>
              <Ionicons name="people-outline" size={80} color="#ccc" />
              <Text style={styles.emptyTitle}>{searchQuery ? 'No members found' : 'No members available'}</Text>
              <Text style={styles.emptyText}>
                {searchQuery ? `No results for "${searchQuery}".` : 'Community members will appear here.'}
              </Text>
            </View>
          )}
        />
      )}
    </View>
  );
}

// ─── Explore Groups Tab ───────────────────────────────────────────────────────
function ExploreGroupsTab() {
  const { token } = useAuth();
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const debounceRef = useState<ReturnType<typeof setTimeout> | null>(null);

  const { data: groups, isLoading, refetch } = useAllGroups(token, {
    per_page: 50,
    search: debouncedSearch || undefined,
  });

  const handleSearchChange = (text: string) => {
    setSearch(text);
    if (debounceRef[0]) clearTimeout(debounceRef[0]);
    debounceRef[1](setTimeout(() => setDebouncedSearch(text), 400));
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  const renderGroup = ({ item }: { item: BPGroup }) => {
    const statusConfig = STATUS_COLORS[item.status] || STATUS_COLORS.public;
    return (
      <TouchableOpacity
        activeOpacity={0.7}
        onPress={() => router.push(`/group-detail?id=${item.id}`)}
        style={styles.groupCard}
      >
        {item.avatar_urls?.thumb ? (
          <Image source={{ uri: item.avatar_urls.thumb }} style={styles.groupAvatar} />
        ) : (
          <View style={[styles.groupAvatar, styles.groupAvatarPlaceholder]}>
            <Ionicons name="people" size={22} color="#3b82f6" />
          </View>
        )}
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <Text style={styles.groupName} numberOfLines={1}>{item.name}</Text>
            <View style={{ backgroundColor: statusConfig.bg, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 8 }}>
              <Text style={{ fontSize: 11, fontWeight: '600', color: statusConfig.text, textTransform: 'uppercase' }}>
                {item.status}
              </Text>
            </View>
          </View>
          {item.description?.rendered ? (
            <Text style={styles.groupDescription} numberOfLines={2}>
              {item.description.rendered.replace(/<[^>]+>/g, '').trim()}
            </Text>
          ) : null}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 }}>
            <Ionicons name="people-outline" size={13} color="#9ca3af" />
            <Text style={{ fontSize: 12, color: '#9ca3af' }}>
              {item.total_member_count ?? 0} members
            </Text>
          </View>
        </View>
        <Ionicons name="chevron-forward" size={18} color="#d1d5db" />
      </TouchableOpacity>
    );
  };

  return (
    <View style={{ flex: 1 }}>
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search groups..."
          placeholderTextColor="#999"
          value={search}
          onChangeText={handleSearchChange}
          returnKeyType="search"
        />
        <TouchableOpacity style={styles.searchButton} onPress={() => setDebouncedSearch(search)} activeOpacity={0.8}>
          <Ionicons name="search" size={18} color="#fff" />
        </TouchableOpacity>
      </View>
      {isLoading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#0066cc" />
          <Text style={styles.loadingText}>Loading groups...</Text>
        </View>
      ) : (
        <FlatList
          data={groups || []}
          renderItem={renderGroup}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={styles.listContent}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#0066cc']} />}
          ListEmptyComponent={() => (
            <View style={styles.emptyContainer}>
              <Ionicons name="people-circle-outline" size={80} color="#ccc" />
              <Text style={styles.emptyTitle}>{debouncedSearch ? 'No groups found' : 'No groups available'}</Text>
              <Text style={styles.emptyText}>
                {debouncedSearch ? `No results for "${debouncedSearch}".` : 'Groups will appear here.'}
              </Text>
            </View>
          )}
        />
      )}
    </View>
  );
}

// ─── My Groups Tab ────────────────────────────────────────────────────────────
function MyGroupsTab() {
  const { token, userId } = useAuth();
  const [refreshing, setRefreshing] = useState(false);
  const { data: groups, isLoading, refetch } = useAllGroups(token, {
    per_page: 50,
    user_id: userId ?? undefined,
  });

  const onRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  const renderGroup = ({ item }: { item: BPGroup }) => {
    const statusConfig = STATUS_COLORS[item.status] || STATUS_COLORS.public;
    return (
      <TouchableOpacity
        activeOpacity={0.7}
        onPress={() => router.push(`/group-detail?id=${item.id}`)}
        style={styles.groupCard}
      >
        {item.avatar_urls?.thumb ? (
          <Image source={{ uri: item.avatar_urls.thumb }} style={styles.groupAvatar} />
        ) : (
          <View style={[styles.groupAvatar, styles.groupAvatarPlaceholder]}>
            <Ionicons name="people" size={22} color="#3b82f6" />
          </View>
        )}
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <Text style={styles.groupName} numberOfLines={1}>{item.name}</Text>
            <View style={{ backgroundColor: statusConfig.bg, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 8 }}>
              <Text style={{ fontSize: 11, fontWeight: '600', color: statusConfig.text, textTransform: 'uppercase' }}>
                {item.status}
              </Text>
            </View>
          </View>
          {item.description?.rendered ? (
            <Text style={styles.groupDescription} numberOfLines={2}>
              {item.description.rendered.replace(/<[^>]+>/g, '').trim()}
            </Text>
          ) : null}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 }}>
            <Ionicons name="people-outline" size={13} color="#9ca3af" />
            <Text style={{ fontSize: 12, color: '#9ca3af' }}>
              {item.total_member_count ?? 0} members
            </Text>
          </View>
        </View>
        <Ionicons name="chevron-forward" size={18} color="#d1d5db" />
      </TouchableOpacity>
    );
  };

  if (isLoading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#0066cc" />
        <Text style={styles.loadingText}>Loading your groups...</Text>
      </View>
    );
  }

  return (
    <FlatList
      data={groups || []}
      renderItem={renderGroup}
      keyExtractor={(item) => item.id.toString()}
      contentContainerStyle={styles.listContent}
      ItemSeparatorComponent={() => <View style={styles.separator} />}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#0066cc']} />}
      ListEmptyComponent={() => (
        <View style={styles.emptyContainer}>
          <Ionicons name="people-circle-outline" size={80} color="#ccc" />
          <Text style={styles.emptyTitle}>No groups yet</Text>
          <Text style={styles.emptyText}>Go to Explore to find and join groups!</Text>
        </View>
      )}
    />
  );
}

// ─── Main Screen ─────────────────────────────────────────────────────────────
export default function NetworkingScreen() {
  const [activeSection, setActiveSection] = useState<SectionType>('members');
  const [activeMembersTab, setActiveMembersTab] = useState<MembersTab>('connect');
  const [activeGroupsTab, setActiveGroupsTab] = useState<GroupsTab>('explore');
  const [page] = useState(1);
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedFriend, setSelectedFriend] = useState<FriendWithDetails | null>(null);

  const { data: currentUser, isLoading: isLoadingUser } = useMe();
  const userId = currentUser?.id;

  const { data: friendsData, isLoading: isLoadingFriends, error: friendsError, refetch: refetchFriends } =
    useFriendsList(userId, page, 20);
  const { data: pendingRequests, isLoading: isLoadingRequests, error: requestsError, refetch: refetchRequests } =
    usePendingFriendRequests(userId);

  const removeFriendMutation = useRemoveFriend();
  const acceptRequestMutation = useAcceptFriendRequest();
  const rejectRequestMutation = useRejectFriendRequest();

  const [refreshing, setRefreshing] = useState(false);

  const isLoading =
    isLoadingUser ||
    (activeMembersTab === 'friends' ? isLoadingFriends : activeMembersTab === 'requests' ? isLoadingRequests : false);

  const error =
    activeMembersTab === 'friends' ? friendsError :
    activeMembersTab === 'requests' ? requestsError : null;

  const onRefresh = async () => {
    setRefreshing(true);
    if (activeMembersTab === 'friends') await refetchFriends();
    else if (activeMembersTab === 'requests') await refetchRequests();
    setRefreshing(false);
  };

  const handleRemoveFriend = (friend: FriendWithDetails) => {
    if (!friend.id || friend.id === 0) {
      Alert.alert('Error', 'Cannot remove friend: Invalid user ID. Please refresh and try again.');
      return;
    }
    setSelectedFriend(friend);
    setModalVisible(true);
  };

  const confirmRemoveFriend = async () => {
    if (!selectedFriend) return;
    try {
      await removeFriendMutation.mutateAsync({
        friendUserId: selectedFriend.id,
        friendshipId: selectedFriend.friendship_id,
      });
      setModalVisible(false);
      setSelectedFriend(null);
      await refetchFriends();
      Alert.alert('Friend Removed', `${selectedFriend.name} has been removed from your connections.`);
    } catch (err) {
      setModalVisible(false);
      setSelectedFriend(null);
      Alert.alert('Error', `Failed to remove friend: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  const handleAcceptRequest = async (request: BPFriendship) => {
    if (!userId) { Alert.alert('Error', 'User ID not available'); return; }
    const otherUserId = request.initiator_id === userId ? request.friend_id : request.initiator_id;
    try {
      await acceptRequestMutation.mutateAsync({ otherUserId, userId });
      await Promise.all([refetchRequests(), refetchFriends()]);
      Alert.alert('Success', 'Friend request accepted!');
    } catch (err) {
      Alert.alert('Error', `Failed to accept request: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  const handleRejectRequest = async (request: BPFriendship) => {
    if (!userId) { Alert.alert('Error', 'User ID not available'); return; }
    Alert.alert('Reject Request', 'Are you sure you want to reject this friend request?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Reject',
        style: 'destructive',
        onPress: async () => {
          try {
            const otherUserId = request.initiator_id === userId ? request.friend_id : request.initiator_id;
            await rejectRequestMutation.mutateAsync(otherUserId);
            await refetchRequests();
            Alert.alert('Success', 'Friend request rejected.');
          } catch (err) {
            Alert.alert('Error', `Failed to reject request: ${err instanceof Error ? err.message : 'Unknown error'}`);
          }
        },
      },
    ]);
  };

  const calculateFriendshipDuration = (dateString: string): string => {
    if (!dateString) return 'Unknown';
    const diffDays = Math.floor((Date.now() - new Date(dateString).getTime()) / 86400000);
    if (diffDays < 1) return 'Friends since today';
    if (diffDays === 1) return 'Friends since 1 day ago';
    if (diffDays < 30) return `Friends for ${diffDays} days`;
    if (diffDays < 365) { const m = Math.floor(diffDays / 30); return m === 1 ? 'Friends for 1 month' : `Friends for ${m} months`; }
    const y = Math.floor(diffDays / 365);
    return y === 1 ? 'Friends for 1 year' : `Friends for ${y} years`;
  };

  const renderFriendItem = ({ item }: { item: FriendWithDetails }) => {
    const avatarUrl = item.avatar_urls?.thumb || item.avatar_urls?.full;
    return (
      <View style={styles.friendCard}>
        <TouchableOpacity style={styles.friendInfo} onPress={() => Alert.alert('Profile', `View ${item.name}'s profile`)}>
          {avatarUrl ? (
            <Image source={{ uri: avatarUrl }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarPlaceholder]}>
              <Text style={styles.avatarPlaceholderText}>{item.name.charAt(0).toUpperCase()}</Text>
            </View>
          )}
          <View style={styles.friendDetails}>
            <Text style={styles.friendName}>{item.name}</Text>
            <Text style={styles.friendshipDuration}>{calculateFriendshipDuration(item.friendship_date)}</Text>
            {item.last_activity?.timediff && <Text style={styles.lastActive}>Active {item.last_activity.timediff}</Text>}
          </View>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.removeButton}
          onPress={() => handleRemoveFriend(item)}
          disabled={removeFriendMutation.isPending}
          activeOpacity={0.7}
        >
          <Ionicons name="person-remove-outline" size={18} color="#fff" />
        </TouchableOpacity>
      </View>
    );
  };

  const FriendRequestItem = ({ item }: { item: BPFriendship }) => {
    const isReceived = item.friend_id === userId;
    const otherUserId = isReceived ? item.initiator_id : item.friend_id;
    const { token } = useAuth();
    const { data: userData } = useMember(token, otherUserId);
    const avatarUrl = userData?.avatar_urls?.thumb || userData?.avatar_urls?.full;
    const userName = userData?.name || 'Loading...';
    return (
      <View style={styles.requestCard}>
        <View style={styles.requestInfo}>
          {avatarUrl ? (
            <Image source={{ uri: avatarUrl }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarPlaceholder]}>
              <Text style={styles.avatarPlaceholderText}>{userName.charAt(0).toUpperCase()}</Text>
            </View>
          )}
          <View style={styles.requestDetails}>
            <Text style={styles.requestName}>{userName}</Text>
            <Text style={styles.requestType}>{isReceived ? 'Sent you a friend request' : 'Request sent'}</Text>
            <Text style={styles.requestDate}>
              {new Date(item.date_created).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            </Text>
          </View>
        </View>
        <View style={styles.requestActions}>
          {isReceived ? (
            <>
              <TouchableOpacity style={styles.acceptButton} onPress={() => handleAcceptRequest(item)} disabled={acceptRequestMutation.isPending}>
                {acceptRequestMutation.isPending ? <ActivityIndicator size="small" color="#fff" /> : (
                  <><Ionicons name="checkmark" size={18} color="#fff" /><Text style={styles.acceptButtonText}>Accept</Text></>
                )}
              </TouchableOpacity>
              <TouchableOpacity style={styles.rejectButton} onPress={() => handleRejectRequest(item)} disabled={rejectRequestMutation.isPending}>
                {rejectRequestMutation.isPending ? <ActivityIndicator size="small" color="#ff4444" /> : (
                  <><Ionicons name="close" size={18} color="#ff4444" /><Text style={styles.rejectButtonText}>Reject</Text></>
                )}
              </TouchableOpacity>
            </>
          ) : (
            <TouchableOpacity style={styles.cancelButton} onPress={() => handleRejectRequest(item)} disabled={rejectRequestMutation.isPending}>
              {rejectRequestMutation.isPending ? <ActivityIndicator size="small" color="#fff" /> : (
                <Text style={styles.cancelButtonText}>Cancel Request</Text>
              )}
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  const friends = friendsData?.friends || [];
  const allRequests = pendingRequests || [];
  const friendUserIds = new Set(friends.map(f => f.id));
  const requests = allRequests.filter(req => {
    const otherUserId = req.initiator_id === userId ? req.friend_id : req.initiator_id;
    return !friendUserIds.has(otherUserId);
  });
  const receivedRequests = requests.filter(r => r.friend_id === userId);
  const sentRequests = requests.filter(r => r.initiator_id === userId);

  return (
    <View style={styles.container}>

      {/* ── Top Section Selector ── */}
      <View style={styles.sectionSelector}>
        <TouchableOpacity
          style={[styles.sectionBtn, activeSection === 'members' && styles.sectionBtnActive]}
          onPress={() => setActiveSection('members')}
          activeOpacity={0.8}
        >
          <Ionicons name="people" size={16} color={activeSection === 'members' ? '#fff' : '#6b7280'} />
          <Text style={[styles.sectionBtnText, activeSection === 'members' && styles.sectionBtnTextActive]}>
            Members
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.sectionBtn, activeSection === 'groups' && styles.sectionBtnActive]}
          onPress={() => setActiveSection('groups')}
          activeOpacity={0.8}
        >
          <Ionicons name="grid" size={16} color={activeSection === 'groups' ? '#fff' : '#6b7280'} />
          <Text style={[styles.sectionBtnText, activeSection === 'groups' && styles.sectionBtnTextActive]}>
            Groups
          </Text>
        </TouchableOpacity>
      </View>

      {/* ── Members Directory ── */}
      {activeSection === 'members' && (
        <>
          <View style={styles.tabContainer}>
            <TouchableOpacity
              style={[styles.tab, activeMembersTab === 'connect' && styles.activeTab]}
              onPress={() => setActiveMembersTab('connect')}
            >
              <Ionicons name="person-add-outline" size={15} color={activeMembersTab === 'connect' ? '#0066cc' : '#666'} />
              <Text style={[styles.tabText, activeMembersTab === 'connect' && styles.activeTabText]}>Connect</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.tab, activeMembersTab === 'friends' && styles.activeTab]}
              onPress={() => setActiveMembersTab('friends')}
            >
              <Ionicons name="heart-outline" size={15} color={activeMembersTab === 'friends' ? '#0066cc' : '#666'} />
              <Text style={[styles.tabText, activeMembersTab === 'friends' && styles.activeTabText]}>Friends</Text>
              {friends.length > 0 && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{friends.length}</Text>
                </View>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.tab, activeMembersTab === 'requests' && styles.activeTab]}
              onPress={() => setActiveMembersTab('requests')}
            >
              <Ionicons name="mail-outline" size={15} color={activeMembersTab === 'requests' ? '#0066cc' : '#666'} />
              <Text style={[styles.tabText, activeMembersTab === 'requests' && styles.activeTabText]}>Requests</Text>
              {requests.length > 0 && (
                <View style={[styles.badge, styles.badgeAlert]}>
                  <Text style={styles.badgeText}>{requests.length}</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>

          {activeMembersTab === 'connect' ? (
            <ConnectTab />
          ) : isLoading ? (
            <View style={styles.centerContainer}>
              <ActivityIndicator size="large" color="#0066cc" />
              <Text style={styles.loadingText}>Loading...</Text>
            </View>
          ) : error ? (
            <View style={styles.centerContainer}>
              <Ionicons name="alert-circle-outline" size={64} color="#ff4444" />
              <Text style={styles.errorText}>Failed to load</Text>
              <Text style={styles.errorDetail}>{(error as Error).message}</Text>
              <TouchableOpacity style={styles.retryButton} onPress={onRefresh}>
                <Text style={styles.retryButtonText}>Retry</Text>
              </TouchableOpacity>
            </View>
          ) : activeMembersTab === 'friends' ? (
            friends.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Ionicons name="people-outline" size={80} color="#ccc" />
                <Text style={styles.emptyTitle}>No friends yet</Text>
                <Text style={styles.emptyText}>Go to Connect to find and add members!</Text>
              </View>
            ) : (
              <FlatList
                data={friends}
                renderItem={renderFriendItem}
                keyExtractor={(item) => item.id.toString()}
                contentContainerStyle={styles.listContent}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
                ItemSeparatorComponent={() => <View style={styles.separator} />}
                ListHeaderComponent={() => (
                  <View style={styles.friendsListHeader}>
                    <Text style={styles.friendsListHeaderText}>Total friends: {friends.length}</Text>
                  </View>
                )}
              />
            )
          ) : (
            requests.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Ionicons name="mail-outline" size={80} color="#ccc" />
                <Text style={styles.emptyTitle}>No friend requests</Text>
                <Text style={styles.emptyText}>When someone sends you a friend request, it will appear here.</Text>
              </View>
            ) : (
              <FlatList
                data={requests}
                renderItem={({ item }) => <FriendRequestItem item={item} />}
                keyExtractor={(item) => item.id.toString()}
                contentContainerStyle={styles.listContent}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
                ItemSeparatorComponent={() => <View style={styles.separator} />}
                ListHeaderComponent={() => (
                  <View style={styles.requestsHeader}>
                    {receivedRequests.length > 0 && (
                      <Text style={styles.requestsHeaderText}>
                        {receivedRequests.length} Received · {sentRequests.length} Sent
                      </Text>
                    )}
                  </View>
                )}
              />
            )
          )}
        </>
      )}

      {/* ── Groups Directory ── */}
      {activeSection === 'groups' && (
        <>
          <View style={styles.tabContainer}>
            <TouchableOpacity
              style={[styles.tab, activeGroupsTab === 'explore' && styles.activeTab]}
              onPress={() => setActiveGroupsTab('explore')}
            >
              <Ionicons name="compass-outline" size={15} color={activeGroupsTab === 'explore' ? '#0066cc' : '#666'} />
              <Text style={[styles.tabText, activeGroupsTab === 'explore' && styles.activeTabText]}>Explore</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.tab, activeGroupsTab === 'mygroups' && styles.activeTab]}
              onPress={() => setActiveGroupsTab('mygroups')}
            >
              <Ionicons name="bookmark-outline" size={15} color={activeGroupsTab === 'mygroups' ? '#0066cc' : '#666'} />
              <Text style={[styles.tabText, activeGroupsTab === 'mygroups' && styles.activeTabText]}>My Groups</Text>
            </TouchableOpacity>
          </View>

          {activeGroupsTab === 'explore' ? <ExploreGroupsTab /> : <MyGroupsTab />}
        </>
      )}

      <RemoveFriendModal
        visible={modalVisible}
        friendName={selectedFriend?.name || ''}
        isRemoving={removeFriendMutation.isPending}
        onConfirm={confirmRemoveFriend}
        onCancel={() => { setModalVisible(false); setSelectedFriend(null); }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20, backgroundColor: '#f5f5f5' },

  // ── Section selector (Members / Groups pill) ──
  sectionSelector: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  sectionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#f3f4f6',
  },
  sectionBtnActive: {
    backgroundColor: '#0066cc',
  },
  sectionBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#6b7280',
  },
  sectionBtnTextActive: {
    color: '#fff',
  },

  // ── Sub-tab bar ──
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 13,
    gap: 5,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeTab: { borderBottomColor: '#0066cc' },
  tabText: { fontSize: 13, fontWeight: '600', color: '#666' },
  activeTabText: { color: '#0066cc' },

  badge: {
    backgroundColor: '#0066cc',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    minWidth: 20,
    alignItems: 'center',
  },
  badgeAlert: { backgroundColor: '#ff4444' },
  badgeText: { color: '#fff', fontSize: 11, fontWeight: '600' },

  // ── Search ──
  searchContainer: {
    flexDirection: 'row',
    padding: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    gap: 8,
  },
  searchInput: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'ios' ? 10 : 8,
    fontSize: 15,
    color: '#333',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  searchButton: {
    backgroundColor: '#0066cc',
    width: 44,
    height: 44,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // ── Friend / Member cards ──
  listContent: { padding: 12 },
  separator: { height: 12 },
  friendCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 3,
  },
  friendInfo: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  avatar: { width: 56, height: 56, borderRadius: 28, marginRight: 12 },
  avatarPlaceholder: { backgroundColor: '#0066cc', justifyContent: 'center', alignItems: 'center' },
  avatarPlaceholderText: { color: '#fff', fontSize: 24, fontWeight: 'bold' },
  friendDetails: { flex: 1 },
  friendName: { fontSize: 16, fontWeight: '600', color: '#333', marginBottom: 4 },
  friendshipDuration: { fontSize: 13, color: '#666', marginBottom: 2 },
  lastActive: { fontSize: 12, color: '#999' },
  addFriendButton: {
    backgroundColor: '#0066cc', flexDirection: 'row',
    paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8, alignItems: 'center', gap: 4,
  },
  addFriendText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  friendStatusBadge: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  friendStatusText: { color: '#22c55e', fontSize: 13, fontWeight: '600' },
  pendingBadge: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  pendingText: { color: '#0066cc', fontSize: 13, fontWeight: '600' },
  removeButton: {
    backgroundColor: '#ff4444', width: 40, height: 40,
    borderRadius: 20, justifyContent: 'center', alignItems: 'center',
  },

  // ── Group cards ──
  groupCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 3,
  },
  groupAvatar: { width: 52, height: 52, borderRadius: 10 },
  groupAvatarPlaceholder: { backgroundColor: '#eff6ff', justifyContent: 'center', alignItems: 'center' },
  groupName: { fontSize: 15, fontWeight: '700', color: '#111827', flex: 1 },
  groupDescription: { fontSize: 13, color: '#6b7280', lineHeight: 18 },

  // ── Request cards ──
  requestCard: {
    backgroundColor: '#fff', borderRadius: 12, padding: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 4, elevation: 3,
  },
  requestInfo: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  requestDetails: { flex: 1 },
  requestName: { fontSize: 16, fontWeight: '600', color: '#333', marginBottom: 4 },
  requestType: { fontSize: 13, color: '#666', marginBottom: 2 },
  requestDate: { fontSize: 12, color: '#999' },
  requestActions: { flexDirection: 'row', gap: 8 },
  acceptButton: {
    flex: 1, flexDirection: 'row', backgroundColor: '#0066cc',
    paddingVertical: 10, paddingHorizontal: 16, borderRadius: 8,
    justifyContent: 'center', alignItems: 'center', gap: 6,
  },
  acceptButtonText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  rejectButton: {
    flex: 1, flexDirection: 'row', backgroundColor: '#fff',
    paddingVertical: 10, paddingHorizontal: 16, borderRadius: 8,
    borderWidth: 1, borderColor: '#ff4444', justifyContent: 'center', alignItems: 'center', gap: 6,
  },
  rejectButtonText: { color: '#ff4444', fontSize: 14, fontWeight: '600' },
  cancelButton: {
    flex: 1, backgroundColor: '#666', paddingVertical: 10,
    paddingHorizontal: 16, borderRadius: 8, justifyContent: 'center', alignItems: 'center',
  },
  cancelButtonText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  requestsHeader: { paddingVertical: 8, alignItems: 'center' },
  requestsHeaderText: { fontSize: 13, color: '#666', fontWeight: '500' },
  friendsListHeader: { paddingVertical: 8, paddingHorizontal: 4, marginBottom: 4 },
  friendsListHeaderText: { fontSize: 13, color: '#666', fontWeight: '600' },

  // ── Empty / error states ──
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  emptyTitle: { fontSize: 20, fontWeight: 'bold', color: '#333', marginTop: 16, marginBottom: 8 },
  emptyText: { fontSize: 14, color: '#666', textAlign: 'center', paddingHorizontal: 32 },
  loadingText: { marginTop: 12, fontSize: 16, color: '#666' },
  errorText: { fontSize: 18, fontWeight: '600', color: '#ff4444', marginTop: 12, marginBottom: 8 },
  errorDetail: { fontSize: 14, color: '#666', textAlign: 'center', marginBottom: 16, paddingHorizontal: 20 },
  retryButton: { backgroundColor: '#0066cc', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 8 },
  retryButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
