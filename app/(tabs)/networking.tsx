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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
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
import RemoveFriendModal from '../../components/RemoveFriendModal';
import type { FriendWithDetails, BPFriendship, BPMember } from '../../types';

type TabType = 'connect' | 'friends' | 'requests';

// ─── Connect Tab ────────────────────────────────────────────────────────────
function ConnectTab() {
  const { token } = useAuth();
  const [searchInput, setSearchInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [sentIds, setSentIds] = useState<Set<number>>(new Set());
  const [pendingIds, setPendingIds] = useState<Set<number>>(new Set());

  const { data: members, isLoading } = useMembersList(token, {
    search: searchQuery,
    perPage: 20,
  });

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
      setPendingIds(prev => {
        const next = new Set(prev);
        next.delete(memberId);
        return next;
      });
    }
  };

  const renderMemberItem = ({ item }: { item: BPMember }) => {
    const avatarUrl = item.avatar_urls?.thumb || item.avatar_urls?.full;
    const statusSlug = item.friendship_status_slug;
    const isPending = pendingIds.has(item.id);
    const hasSent = sentIds.has(item.id);

    const isAlreadyFriend = statusSlug === 'is_friend';
    const hasRequest =
      statusSlug === 'pending' ||
      statusSlug === 'awaiting_response' ||
      hasSent;

    return (
      <View style={styles.friendCard}>
        <View style={styles.friendInfo}>
          {avatarUrl ? (
            <Image source={{ uri: avatarUrl }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarPlaceholder]}>
              <Text style={styles.avatarPlaceholderText}>
                {item.name.charAt(0).toUpperCase()}
              </Text>
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
        <TouchableOpacity
          style={styles.searchButton}
          onPress={() => setSearchQuery(searchInput)}
          activeOpacity={0.8}
        >
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
              <Text style={styles.emptyTitle}>
                {searchQuery ? 'No members found' : 'No members available'}
              </Text>
              <Text style={styles.emptyText}>
                {searchQuery
                  ? `No results for "${searchQuery}". Try a different search.`
                  : 'Community members will appear here.'}
              </Text>
            </View>
          )}
        />
      )}
    </View>
  );
}

// ─── Main Screen ────────────────────────────────────────────────────────────
export default function NetworkingScreen() {
  const [activeTab, setActiveTab] = useState<TabType>('connect');
  const [page] = useState(1);
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedFriend, setSelectedFriend] = useState<FriendWithDetails | null>(null);

  const { data: currentUser, isLoading: isLoadingUser } = useMe();
  const userId = currentUser?.id;

  const { data: friendsData, isLoading: isLoadingFriends, error: friendsError, refetch: refetchFriends } = useFriendsList(
    userId,
    page,
    20
  );

  const { data: pendingRequests, isLoading: isLoadingRequests, error: requestsError, refetch: refetchRequests } = usePendingFriendRequests(userId);

  const removeFriendMutation = useRemoveFriend();
  const acceptRequestMutation = useAcceptFriendRequest();
  const rejectRequestMutation = useRejectFriendRequest();

  const [refreshing, setRefreshing] = useState(false);

  const isLoading =
    isLoadingUser ||
    (activeTab === 'friends'
      ? isLoadingFriends
      : activeTab === 'requests'
      ? isLoadingRequests
      : false);

  const error =
    activeTab === 'friends' ? friendsError :
    activeTab === 'requests' ? requestsError : null;

  const onRefresh = async () => {
    setRefreshing(true);
    if (activeTab === 'friends') await refetchFriends();
    else if (activeTab === 'requests') await refetchRequests();
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

  const cancelRemoveFriend = () => {
    setModalVisible(false);
    setSelectedFriend(null);
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
    const friendshipDate = new Date(dateString);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - friendshipDate.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays < 1) return 'Friends since today';
    if (diffDays === 1) return 'Friends since 1 day ago';
    if (diffDays < 30) return `Friends for ${diffDays} days`;
    if (diffDays < 365) {
      const months = Math.floor(diffDays / 30);
      return months === 1 ? 'Friends for 1 month' : `Friends for ${months} months`;
    }
    const years = Math.floor(diffDays / 365);
    return years === 1 ? 'Friends for 1 year' : `Friends for ${years} years`;
  };

  const renderFriendItem = ({ item }: { item: FriendWithDetails }) => {
    const avatarUrl = item.avatar_urls?.thumb || item.avatar_urls?.full;
    const friendshipDuration = calculateFriendshipDuration(item.friendship_date);
    return (
      <View style={styles.friendCard}>
        <TouchableOpacity
          style={styles.friendInfo}
          onPress={() => Alert.alert('Profile', `View ${item.name}'s profile`)}
        >
          {avatarUrl ? (
            <Image source={{ uri: avatarUrl }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarPlaceholder]}>
              <Text style={styles.avatarPlaceholderText}>{item.name.charAt(0).toUpperCase()}</Text>
            </View>
          )}
          <View style={styles.friendDetails}>
            <Text style={styles.friendName}>{item.name}</Text>
            <Text style={styles.friendshipDuration}>{friendshipDuration}</Text>
            {item.last_activity?.timediff && (
              <Text style={styles.lastActive}>Active {item.last_activity.timediff}</Text>
            )}
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
            <Text style={styles.requestType}>
              {isReceived ? 'Sent you a friend request' : 'Request sent'}
            </Text>
            <Text style={styles.requestDate}>
              {new Date(item.date_created).toLocaleDateString('en-US', {
                month: 'short', day: 'numeric', year: 'numeric',
              })}
            </Text>
          </View>
        </View>
        <View style={styles.requestActions}>
          {isReceived ? (
            <>
              <TouchableOpacity
                style={styles.acceptButton}
                onPress={() => handleAcceptRequest(item)}
                disabled={acceptRequestMutation.isPending}
              >
                {acceptRequestMutation.isPending ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Ionicons name="checkmark" size={18} color="#fff" />
                    <Text style={styles.acceptButtonText}>Accept</Text>
                  </>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.rejectButton}
                onPress={() => handleRejectRequest(item)}
                disabled={rejectRequestMutation.isPending}
              >
                {rejectRequestMutation.isPending ? (
                  <ActivityIndicator size="small" color="#ff4444" />
                ) : (
                  <>
                    <Ionicons name="close" size={18} color="#ff4444" />
                    <Text style={styles.rejectButtonText}>Reject</Text>
                  </>
                )}
              </TouchableOpacity>
            </>
          ) : (
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => handleRejectRequest(item)}
              disabled={rejectRequestMutation.isPending}
            >
              {rejectRequestMutation.isPending ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
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
      {/* Tab Navigation */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'connect' && styles.activeTab]}
          onPress={() => setActiveTab('connect')}
        >
          <Ionicons
            name="person-add-outline"
            size={15}
            color={activeTab === 'connect' ? '#0066cc' : '#666'}
          />
          <Text style={[styles.tabText, activeTab === 'connect' && styles.activeTabText]}>
            Connect
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, activeTab === 'friends' && styles.activeTab]}
          onPress={() => setActiveTab('friends')}
        >
          <Text style={[styles.tabText, activeTab === 'friends' && styles.activeTabText]}>
            Friends
          </Text>
          {friends.length > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{friends.length}</Text>
            </View>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, activeTab === 'requests' && styles.activeTab]}
          onPress={() => setActiveTab('requests')}
        >
          <Text style={[styles.tabText, activeTab === 'requests' && styles.activeTabText]}>
            Requests
          </Text>
          {requests.length > 0 && (
            <View style={[styles.badge, styles.badgeAlert]}>
              <Text style={styles.badgeText}>{requests.length}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* Content */}
      {activeTab === 'connect' ? (
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
      ) : activeTab === 'friends' ? (
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
          />
        )
      ) : (
        requests.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="mail-outline" size={80} color="#ccc" />
            <Text style={styles.emptyTitle}>No friend requests</Text>
            <Text style={styles.emptyText}>
              When someone sends you a friend request, it will appear here.
            </Text>
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
                    {receivedRequests.length} Received • {sentRequests.length} Sent
                  </Text>
                )}
              </View>
            )}
          />
        )
      )}

      <RemoveFriendModal
        visible={modalVisible}
        friendName={selectedFriend?.name || ''}
        isRemoving={removeFriendMutation.isPending}
        onConfirm={confirmRemoveFriend}
        onCancel={cancelRemoveFriend}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#f5f5f5',
  },
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
    paddingVertical: 14,
    gap: 6,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeTab: {
    borderBottomColor: '#0066cc',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  activeTabText: {
    color: '#0066cc',
  },
  badge: {
    backgroundColor: '#0066cc',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    minWidth: 20,
    alignItems: 'center',
  },
  badgeAlert: {
    backgroundColor: '#ff4444',
  },
  badgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
  },
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
  addFriendButton: {
    backgroundColor: '#0066cc',
    flexDirection: 'row',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    alignItems: 'center',
    gap: 4,
  },
  addFriendText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  friendStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  friendStatusText: {
    color: '#22c55e',
    fontSize: 13,
    fontWeight: '600',
  },
  pendingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  pendingText: {
    color: '#0066cc',
    fontSize: 13,
    fontWeight: '600',
  },
  listContent: {
    padding: 12,
  },
  friendCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  friendInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    marginRight: 12,
  },
  avatarPlaceholder: {
    backgroundColor: '#0066cc',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarPlaceholderText: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
  },
  friendDetails: {
    flex: 1,
  },
  friendName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  friendshipDuration: {
    fontSize: 13,
    color: '#666',
    marginBottom: 2,
  },
  lastActive: {
    fontSize: 12,
    color: '#999',
  },
  removeButton: {
    backgroundColor: '#ff4444',
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  requestCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  requestInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  requestDetails: {
    flex: 1,
  },
  requestName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  requestType: {
    fontSize: 13,
    color: '#666',
    marginBottom: 2,
  },
  requestDate: {
    fontSize: 12,
    color: '#999',
  },
  requestActions: {
    flexDirection: 'row',
    gap: 8,
  },
  acceptButton: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: '#0066cc',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
  },
  acceptButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  rejectButton: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: '#fff',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ff4444',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
  },
  rejectButtonText: {
    color: '#ff4444',
    fontSize: 14,
    fontWeight: '600',
  },
  cancelButton: {
    flex: 1,
    backgroundColor: '#666',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  requestsHeader: {
    paddingVertical: 8,
    alignItems: 'center',
  },
  requestsHeaderText: {
    fontSize: 13,
    color: '#666',
    fontWeight: '500',
  },
  separator: {
    height: 12,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666',
  },
  errorText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#ff4444',
    marginTop: 12,
    marginBottom: 8,
  },
  errorDetail: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 16,
    paddingHorizontal: 20,
  },
  retryButton: {
    backgroundColor: '#0066cc',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    paddingHorizontal: 32,
  },
});
