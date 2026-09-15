// app/profile/connections.tsx
/**
 * Connections screen accessible from profile menu
 * Shows friends list and friend requests with tabs
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  FlatList,
  Image,
  TouchableOpacity,
  RefreshControl,
  Alert,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import BackButton from '../../components/BackButton';
import { useAuth } from '../../lib/auth';
import {
  useMe,
  useFriendsList,
  useRemoveFriend,
  usePendingFriendRequests,
  useAcceptFriendRequest,
  useRejectFriendRequest,
} from '../../hooks/useQueries';
import { useMember } from '../../hooks/useMembers';
import RemoveFriendModal from '../../components/RemoveFriendModal';
import type { FriendWithDetails, BPFriendship } from '../../types';

type TabType = 'friends' | 'requests';

// ─── Main Screen ────────────────────────────────────────────────────────────
export default function ConnectionsScreen() {
  // Profile is a personal area: it shows the member's own confirmed
  // connections (and their own pending requests), never the public directory.
  const [activeTab, setActiveTab] = useState<TabType>('friends');
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

  const error = activeTab === 'friends' ? friendsError : activeTab === 'requests' ? requestsError : null;

  const onRefresh = async () => {
    setRefreshing(true);
    if (activeTab === 'friends') await refetchFriends();
    else if (activeTab === 'requests') await refetchRequests();
    setRefreshing(false);
  };

  const handleRemoveFriend = (friend: FriendWithDetails) => {
    if (!friend.id || friend.id === 0) {
      Alert.alert('Error', 'Cannot remove connection: Invalid user ID. Please refresh and try again.');
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
      Alert.alert('Connection Removed', `${selectedFriend.name} has been removed from your connections.`);
    } catch (err) {
      setModalVisible(false);
      setSelectedFriend(null);
      Alert.alert('Error', `Failed to remove connection: ${err instanceof Error ? err.message : 'Unknown error'}`);
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
      Alert.alert('Success', 'Connection request accepted!');
    } catch (err) {
      Alert.alert('Error', `Failed to accept request: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  const handleRejectRequest = async (request: BPFriendship) => {
    if (!userId) { Alert.alert('Error', 'User ID not available'); return; }
    Alert.alert('Reject Connection Request', 'Are you sure you want to reject this connection request?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Reject',
        style: 'destructive',
        onPress: async () => {
          try {
            const otherUserId = request.initiator_id === userId ? request.friend_id : request.initiator_id;
            await rejectRequestMutation.mutateAsync(otherUserId);
            await refetchRequests();
            Alert.alert('Success', 'Connection request rejected.');
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
    if (diffDays < 1) return 'Connected today';
    if (diffDays === 1) return 'Connected 1 day ago';
    if (diffDays < 30) return `Connected for ${diffDays} days`;
    if (diffDays < 365) {
      const months = Math.floor(diffDays / 30);
      return months === 1 ? 'Connected for 1 month' : `Connected for ${months} months`;
    }
    const years = Math.floor(diffDays / 365);
    return years === 1 ? 'Connected for 1 year' : `Connected for ${years} years`;
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
              {isReceived ? 'Sent you a connection request' : 'Connection request sent'}
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

  const renderEmptyFriends = () => (
    <View style={styles.emptyContainer}>
      <Ionicons name="people-outline" size={80} color="#ccc" />
      <Text style={styles.emptyTitle}>No connections yet</Text>
      <Text style={styles.emptyText}>
        Build your network from the Network tab.
      </Text>
    </View>
  );

  const renderEmptyRequests = () => (
    <View style={styles.emptyContainer}>
      <Ionicons name="mail-outline" size={80} color="#ccc" />
      <Text style={styles.emptyTitle}>No connection requests</Text>
      <Text style={styles.emptyText}>
        When someone sends you a connection request, it will appear here.
      </Text>
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: '#f5f5f5' }}>
      {/* Header */}
      <View style={{
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#e5e7eb',
        paddingHorizontal: 16,
        paddingTop: 60,
        paddingBottom: 16,
      }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <BackButton />
          <Text style={{ fontSize: 20, fontWeight: '700', color: '#1f2937', flex: 1 }}>
            My Connections
          </Text>
        </View>
      </View>

      {isLoading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#0066cc" />
          <Text style={styles.loadingText}>Loading connections...</Text>
        </View>
      ) : error ? (
        <View style={styles.centerContainer}>
          <Ionicons name="alert-circle-outline" size={64} color="#ff4444" />
          <Text style={styles.errorText}>Failed to load connections</Text>
          <Text style={styles.errorDetail}>{(error as Error).message}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={onRefresh}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.container}>
          {/* Tab Navigation */}
          <View style={styles.tabContainer}>
            <TouchableOpacity
              style={[styles.tab, activeTab === 'friends' && styles.activeTab]}
              onPress={() => setActiveTab('friends')}
            >
              <Text style={[styles.tabText, activeTab === 'friends' && styles.activeTabText]}>
                Connections
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
          {activeTab === 'friends' ? (
            friends.length === 0 ? renderEmptyFriends() : (
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
            requests.length === 0 ? renderEmptyRequests() : (
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
        </View>
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
  // Lists
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
