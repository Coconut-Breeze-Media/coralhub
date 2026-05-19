import React, { useMemo } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useAuth } from '../lib/auth';
import { useMe, usePendingFriendRequests } from '../hooks/useQueries';
import { usePrefetchMembers } from '../hooks/useMembers';
import type { BPFriendship } from '../types';

type AppNotification =
  | {
      id: string;
      type: 'friend_request';
      createdAt: string;
      userName: string;
      avatarUrl?: string;
      onPress: () => void;
    }
  | {
      id: string;
      type: 'message';
      createdAt: string;
      title: string;
      preview: string;
      onPress: () => void;
    };

function formatDate(date: string) {
  return new Date(date).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export default function NotificationsScreen() {
  const { token } = useAuth();
  const { data: currentUser, isLoading: isLoadingUser } = useMe();
  const userId = currentUser?.id;

  const {
    data: pendingRequests,
    isLoading: isLoadingRequests,
    error: requestsError,
  } = usePendingFriendRequests(userId);

  const receivedRequests = useMemo(() => {
    if (!userId) return [];
    return (pendingRequests || []).filter((request) => request.friend_id === userId);
  }, [pendingRequests, userId]);

  const requestUserIds = useMemo(
    () => receivedRequests.map((request) => request.initiator_id),
    [receivedRequests]
  );

  const { data: memberMap, isLoading: isLoadingMembers } = usePrefetchMembers(token, requestUserIds);

  const requestNotifications = useMemo<AppNotification[]>(() => {
    return receivedRequests.map((request: BPFriendship) => {
      const sender = memberMap?.[request.initiator_id];
      const userName = sender?.name || 'Someone';
      const avatarUrl = sender?.avatar_urls?.thumb || sender?.avatar_urls?.full;

      return {
        id: `friend-request-${request.id}`,
        type: 'friend_request',
        createdAt: request.date_created,
        userName,
        avatarUrl,
        onPress: () => router.push('/profile/connections'),
      };
    });
  }, [memberMap, receivedRequests]);

  const messageNotifications = useMemo<AppNotification[]>(() => {
    return [];
  }, []);

  const notifications = useMemo(() => {
    return [...requestNotifications, ...messageNotifications].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }, [messageNotifications, requestNotifications]);

  const isLoading = isLoadingUser || (Boolean(userId) && (isLoadingRequests || isLoadingMembers));

  return (
    <SafeAreaView style={styles.container}>
      {isLoading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#0066cc" />
          <Text style={styles.loadingText}>Loading notifications...</Text>
        </View>
      ) : requestsError ? (
        <View style={styles.centerContainer}>
          <Text style={styles.errorText}>Could not load notifications</Text>
        </View>
      ) : notifications.length === 0 ? (
        <View style={styles.centerContainer}>
          <Ionicons name="notifications-off-outline" size={40} color="#9ca3af" />
          <Text style={styles.emptyTitle}>No pending notifications</Text>
        </View>
      ) : (
        <View style={styles.cardsContainer}>
          {notifications.map((notification) => {
            if (notification.type === 'friend_request') {
              return (
                <Pressable key={notification.id} style={styles.friendRequestCard} onPress={notification.onPress}>
                  <View style={styles.leftContainer}>
                    {notification.avatarUrl ? (
                      <Image source={{ uri: notification.avatarUrl }} style={styles.avatar} />
                    ) : (
                      <View style={[styles.avatar, styles.avatarFallback]}>
                        <Ionicons name="person-outline" size={18} color="#1f2937" />
                      </View>
                    )}
                    <View style={styles.cardContent}>
                      <Text style={styles.cardTitle}>Friend request</Text>
                      <Text style={styles.cardDescription}>{notification.userName} sent you a friend request</Text>
                      <Text style={styles.cardDate}>{formatDate(notification.createdAt)}</Text>
                    </View>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color="#9ca3af" />
                </Pressable>
              );
            }

            return (
              <Pressable key={notification.id} style={styles.messageCard} onPress={notification.onPress}>
                <View style={styles.leftContainer}>
                  <View style={styles.messageIconContainer}>
                    <Ionicons name="chatbubble-ellipses-outline" size={20} color="#a16207" />
                  </View>
                  <View style={styles.cardContent}>
                    <Text style={styles.cardTitle}>{notification.title}</Text>
                    <Text style={styles.cardDescription}>{notification.preview}</Text>
                    <Text style={styles.cardDate}>{formatDate(notification.createdAt)}</Text>
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#9ca3af" />
              </Pressable>
            );
          })}
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    color: '#6b7280',
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#4b5563',
  },
  errorText: {
    fontSize: 14,
    color: '#dc2626',
  },
  cardsContainer: {
    gap: 12,
  },
  friendRequestCard: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  messageCard: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#fde68a',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  leftContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
  },
  avatarFallback: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#e5e7eb',
  },
  messageIconContainer: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fffbeb',
  },
  cardContent: {
    flex: 1,
    gap: 2,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  cardDescription: {
    fontSize: 13,
    color: '#6b7280',
  },
  cardDate: {
    fontSize: 12,
    color: '#9ca3af',
    marginTop: 2,
  },
});