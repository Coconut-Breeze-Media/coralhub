// app/(tabs)/networking.tsx
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
  Platform,
} from 'react-native';
import { useMe, useFriendsList, useRemoveFriend } from '../../hooks/useQueries';
import type { FriendWithDetails } from '../../types';

export default function NetworkingScreen() {
  const [page, setPage] = useState(1);
  
  // Get current user to retrieve their ID
  const { data: currentUser } = useMe();
  const userId = currentUser?.id;
  
  // Fetch friends list for current user
  const { data: friendsData, isLoading, error, refetch } = useFriendsList(
    userId,
    page,
    20
  );
  
  const removeFriendMutation = useRemoveFriend();
  
  const [refreshing, setRefreshing] = useState(false);
  
  const onRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };
  
  const handleRemoveFriend = (friend: FriendWithDetails) => {
    console.log('handleRemoveFriend called for:', friend.name);
    console.log('friend user ID:', friend.id);
    console.log('friendship_id (for reference):', friend.friendship_id);
    
    // Check if friend ID is valid
    if (!friend.id || friend.id === 0) {
      console.log('Invalid friend user ID, showing error alert');
      Alert.alert(
        'Error',
        'Cannot remove friend: Invalid user ID. Please refresh and try again.'
      );
      return;
    }
    
    console.log('About to show confirmation dialog');
    
    // Directly remove without confirmation for testing
    const confirmRemove = async () => {
      try {
        console.log('Removing friend:', {
          userId: friend.id,
          name: friend.name,
          friendshipId: friend.friendship_id
        });
        
        const result = await removeFriendMutation.mutateAsync({
          friendUserId: friend.id,
          friendshipId: friend.friendship_id,
        });
        
        console.log('Remove friend result:', result);
        Alert.alert('Success', `${friend.name} has been removed from your friends.`);
      } catch (err) {
        console.error('Error removing friend:', err);
        Alert.alert(
          'Error',
          `Failed to remove friend: ${err instanceof Error ? err.message : 'Unknown error'}`
        );
      }
    };
    
    // Use platform-appropriate confirmation
    if (Platform.OS === 'web') {
      // For web, use native confirm
      if (window.confirm(`Are you sure you want to remove ${friend.name} from your friends?`)) {
        confirmRemove();
      }
    } else {
      // For mobile, use Alert.alert
      Alert.alert(
        'Remove Friend',
        `Are you sure you want to remove ${friend.name} from your friends?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Remove',
            style: 'destructive',
            onPress: confirmRemove,
          },
        ]
      );
    }
  };
  
  const calculateFriendshipDuration = (dateString: string): string => {
    if (!dateString) return 'Unknown';
    
    const friendshipDate = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - friendshipDate.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffDays < 1) {
      return 'Friends since today';
    } else if (diffDays === 1) {
      return 'Friends since 1 day ago';
    } else if (diffDays < 30) {
      return `Friends for ${diffDays} days`;
    } else if (diffDays < 365) {
      const months = Math.floor(diffDays / 30);
      return months === 1 ? 'Friends for 1 month' : `Friends for ${months} months`;
    } else {
      const years = Math.floor(diffDays / 365);
      return years === 1 ? 'Friends for 1 year' : `Friends for ${years} years`;
    }
  };
  
  const renderFriendItem = ({ item }: { item: FriendWithDetails }) => {
    const avatarUrl = item.avatar_urls?.thumb || item.avatar_urls?.full;
    const friendshipDuration = calculateFriendshipDuration(item.friendship_date);
    
    return (
      <View style={styles.friendCard}>
        <TouchableOpacity 
          style={styles.friendInfo}
          onPress={() => {
            // TODO: Navigate to friend profile
            Alert.alert('Profile', `View ${item.name}'s profile`);
          }}
        >
          {avatarUrl ? (
            <Image
              source={{ uri: avatarUrl }}
              style={styles.avatar}
            />
          ) : (
            <View style={[styles.avatar, styles.avatarPlaceholder]}>
              <Text style={styles.avatarPlaceholderText}>
                {item.name.charAt(0).toUpperCase()}
              </Text>
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
          onPress={() => {
            console.log('Remove button pressed!');
            handleRemoveFriend(item);
          }}
          disabled={removeFriendMutation.isPending}
          activeOpacity={0.7}
        >
          <Text style={styles.removeButtonText}>Remove</Text>
        </TouchableOpacity>
      </View>
    );
  };
  
  if (isLoading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#0066cc" />
        <Text style={styles.loadingText}>Loading friends...</Text>
      </View>
    );
  }
  
  if (error) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorText}>Failed to load friends</Text>
        <Text style={styles.errorDetail}>{(error as Error).message}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={() => refetch()}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }
  
  const friends = friendsData?.friends || [];
  
  if (friends.length === 0) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.emptyTitle}>No friends yet</Text>
        <Text style={styles.emptyText}>
          Start connecting with other members to build your network!
        </Text>
      </View>
    );
  }
  
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>My Friends</Text>
        <Text style={styles.headerSubtitle}>
          {friendsData?.total || 0} {friendsData?.total === 1 ? 'friend' : 'friends'}
        </Text>
      </View>
      
      <FlatList
        data={friends}
        renderItem={renderFriendItem}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ItemSeparatorComponent={() => <View style={styles.separator} />}
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
  header: {
    backgroundColor: '#fff',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
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
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
  },
  removeButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  separator: {
    height: 12,
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
    marginBottom: 8,
  },
  errorDetail: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 16,
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
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    paddingHorizontal: 32,
  },
});