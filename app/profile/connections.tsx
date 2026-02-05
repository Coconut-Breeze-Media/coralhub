// app/profile/connections.tsx
/**
 * Connections (Friends) screen accessible from profile menu
 * Shows the user's friends list with management options
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
import { Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useMe, useFriendsList, useRemoveFriend } from '../../hooks/useQueries';
import type { FriendWithDetails } from '../../types';

export default function ConnectionsScreen() {
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
    Alert.alert(
      'Remove Friend',
      `Are you sure you want to remove ${friend.name} from your friends?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              await removeFriendMutation.mutateAsync({
                friendshipId: friend.friendship_id,
              });
              Alert.alert('Success', `${friend.name} has been removed from your friends.`);
            } catch (err) {
              Alert.alert('Error', 'Failed to remove friend. Please try again.');
            }
          },
        },
      ]
    );
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
          onPress={() => handleRemoveFriend(item)}
          disabled={removeFriendMutation.isPending}
        >
          <Ionicons name="person-remove-outline" size={18} color="#fff" />
        </TouchableOpacity>
      </View>
    );
  };
  
  if (isLoading) {
    return (
      <>
        <Stack.Screen
          options={{
            title: 'Connections',
            headerBackTitle: 'Profile',
          }}
        />
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#0066cc" />
          <Text style={styles.loadingText}>Loading connections...</Text>
        </View>
      </>
    );
  }
  
  if (error) {
    return (
      <>
        <Stack.Screen
          options={{
            title: 'Connections',
            headerBackTitle: 'Profile',
          }}
        />
        <View style={styles.centerContainer}>
          <Ionicons name="alert-circle-outline" size={64} color="#ff4444" />
          <Text style={styles.errorText}>Failed to load connections</Text>
          <Text style={styles.errorDetail}>{(error as Error).message}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => refetch()}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </>
    );
  }
  
  const friends = friendsData?.friends || [];
  
  if (friends.length === 0) {
    return (
      <>
        <Stack.Screen
          options={{
            title: 'Connections',
            headerBackTitle: 'Profile',
          }}
        />
        <View style={styles.centerContainer}>
          <Ionicons name="people-outline" size={80} color="#ccc" />
          <Text style={styles.emptyTitle}>No connections yet</Text>
          <Text style={styles.emptyText}>
            Start connecting with other members to build your network!
          </Text>
        </View>
      </>
    );
  }
  
  return (
    <>
      <Stack.Screen
        options={{
          title: 'Connections',
          headerBackTitle: 'Profile',
        }}
      />
      <View style={styles.container}>
        <View style={styles.header}>
          <View style={styles.headerContent}>
            <Ionicons name="people" size={24} color="#0066cc" />
            <Text style={styles.headerTitle}>My Connections</Text>
          </View>
          <Text style={styles.headerSubtitle}>
            {friendsData?.total || 0} {friendsData?.total === 1 ? 'connection' : 'connections'}
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
    </>
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
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#666',
    marginLeft: 32,
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
