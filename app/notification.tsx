import React, { useMemo } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useAuth } from '../lib/auth';
import { useFriendsList, useMe, usePendingFriendRequests } from '../hooks/useQueries';
import { usePrefetchMembers } from '../hooks/useMembers';
import { useConversations } from '../hooks/useMessages';
import {
  useAcceptGroupInvite,
  useBuddyPressNotifications,
  useGroupInvites,
  useManagedGroupMembershipRequests,
  useMarkNotificationRead,
  useRejectGroupInvite,
} from '../hooks/useNotifications';
import {
  useAcceptMembershipRequest,
  useMyGroups,
  useRejectMembershipRequest,
} from '../hooks/useGroups';
import { getUnreadMessageNotifications } from '../lib/messageNotifications';
import {
  isMessageNotification,
  getNotificationActorId,
  getMirroredNotificationKind,
  presentBuddyPressNotification,
} from '../lib/notificationPresentation';
import type { BPNotification, BPFriendship } from '../types';

function formatDate(date: string) {
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return '';
  return parsed.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: parsed.getFullYear() === new Date().getFullYear() ? undefined : 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function Avatar({ uri, fallback }: { uri?: string; fallback: keyof typeof Ionicons.glyphMap }) {
  return uri ? (
    <Image source={{ uri }} style={styles.avatar} />
  ) : (
    <View style={styles.iconContainer}>
      <Ionicons name={fallback} size={21} color="#0369a1" />
    </View>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <Text style={styles.sectionTitle}>{children}</Text>;
}

function ActionButtons({
  onAccept,
  onReject,
  pending,
}: {
  onAccept: () => void;
  onReject: () => void;
  pending: boolean;
}) {
  return (
    <View style={styles.actionRow}>
      <TouchableOpacity
        style={[styles.rejectButton, pending && styles.disabledButton]}
        onPress={onReject}
        disabled={pending}
      >
        <Text style={styles.rejectText}>Decline</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.acceptButton, pending && styles.disabledButton]}
        onPress={onAccept}
        disabled={pending}
      >
        {pending ? (
          <ActivityIndicator size="small" color="#fff" />
        ) : (
          <Text style={styles.acceptText}>Accept</Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

export default function NotificationsScreen() {
  const { token, userId: authUserId } = useAuth();
  const { data: currentUser, isLoading: isLoadingUser } = useMe();
  const userId = currentUser?.id ?? authUserId ?? undefined;
  const { data: pendingRequests, isLoading: isLoadingRequests, error: requestsError } =
    usePendingFriendRequests(userId);
  const { data: friendsData, isLoading: isLoadingFriends } = useFriendsList(userId, 1, 200);
  const { data: conversationsData, isLoading: isLoadingMessages, error: messagesError } =
    useConversations(token);
  const { data: nativeNotifications, isLoading: isLoadingNative, error: nativeError } =
    useBuddyPressNotifications(token, userId);
  const { data: groupInvites, isLoading: isLoadingInvites, error: invitesError } =
    useGroupInvites(token, userId);
  const { data: myGroups, isLoading: isLoadingGroups } = useMyGroups(token);
  const {
    data: membershipRequests,
    isLoading: isLoadingMembershipRequests,
    error: membershipRequestsError,
  } = useManagedGroupMembershipRequests(token, userId, myGroups, nativeNotifications);

  const markRead = useMarkNotificationRead(token);
  const acceptInvite = useAcceptGroupInvite(token);
  const rejectInvite = useRejectGroupInvite(token);
  const acceptMembership = useAcceptMembershipRequest(token);
  const rejectMembership = useRejectMembershipRequest(token);

  const receivedRequests = useMemo(() => {
    if (!userId) return [];
    const currentUserId = Number(userId);
    const friendIds = new Set((friendsData?.friends || []).map((friend) => Number(friend.id)));
    return (pendingRequests || []).filter((request) => {
      const isConfirmed = request.is_confirmed === true || Number(request.is_confirmed) === 1;
      return (
        !isConfirmed &&
        Number(request.friend_id) === currentUserId &&
        !friendIds.has(Number(request.initiator_id))
      );
    });
  }, [pendingRequests, userId, friendsData]);

  const requestUserIds = useMemo(
    () => receivedRequests.map((request) => request.initiator_id),
    [receivedRequests]
  );
  const { data: memberMap, isLoading: isLoadingMembers } = usePrefetchMembers(
    token,
    requestUserIds
  );

  const messageNotifications = useMemo(
    () => getUnreadMessageNotifications(conversationsData, userId),
    [conversationsData, userId]
  );

  const activityNotifications = useMemo(
    () =>
      (nativeNotifications || []).filter((notification) => {
        if (isMessageNotification(notification)) return false;
        const mirroredKind = getMirroredNotificationKind(notification);
        if (mirroredKind === 'friend_request') return receivedRequests.length === 0;
        if (mirroredKind === 'group_invite') return (groupInvites?.length || 0) === 0;
        if (mirroredKind === 'group_request') return (membershipRequests?.length || 0) === 0;
        return true;
      }),
    [groupInvites, membershipRequests, nativeNotifications, receivedRequests.length]
  );

  const notificationActorIds = useMemo(
    () =>
      activityNotifications
        .map(getNotificationActorId)
        .filter((actorId): actorId is number => actorId !== null),
    [activityNotifications]
  );
  const { data: notificationActorMap, isLoading: isLoadingNotificationActors } =
    usePrefetchMembers(token, notificationActorIds);

  const getNotificationPresentation = (notification: BPNotification) => {
    const actorId = getNotificationActorId(notification);
    const actorName = actorId ? notificationActorMap?.[actorId]?.name : null;
    return presentBuddyPressNotification(notification, actorName);
  };

  const hasAnything =
    receivedRequests.length > 0 ||
    messageNotifications.length > 0 ||
    activityNotifications.length > 0 ||
    (groupInvites?.length || 0) > 0 ||
    (membershipRequests?.length || 0) > 0;

  const isLoading =
    isLoadingUser ||
    (Boolean(userId) &&
      (isLoadingRequests ||
        isLoadingFriends ||
        isLoadingMembers ||
        isLoadingMessages ||
        isLoadingNative ||
        isLoadingInvites ||
        isLoadingGroups ||
        isLoadingNotificationActors ||
        isLoadingMembershipRequests));
  const hasError =
    requestsError ||
    messagesError ||
    nativeError ||
    invitesError ||
    membershipRequestsError;

  const openNativeNotification = async (notification: BPNotification) => {
    const presentation = getNotificationPresentation(notification);
    try {
      await markRead.mutateAsync(notification.id);
    } catch {
      // Opening the destination is still useful if the read-state request
      // fails temporarily; React Query will retry it on the next refresh.
    } finally {
      if (presentation.route) router.push(presentation.route as never);
    }
  };

  const handleInvite = async (inviteId: number, action: 'accept' | 'reject') => {
    try {
      if (action === 'accept') await acceptInvite.mutateAsync(inviteId);
      else await rejectInvite.mutateAsync(inviteId);
    } catch (error: any) {
      Alert.alert('Error', error?.message || `Could not ${action} the group invitation.`);
    }
  };

  const handleMembershipRequest = async (
    groupId: number,
    requestId: number,
    action: 'accept' | 'reject'
  ) => {
    try {
      if (action === 'accept') {
        await acceptMembership.mutateAsync({ groupId, requestId });
      } else {
        await rejectMembership.mutateAsync({ groupId, requestId });
      }
    } catch (error: any) {
      Alert.alert('Error', error?.message || `Could not ${action} the membership request.`);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {isLoading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#0066cc" />
          <Text style={styles.secondaryText}>Loading notifications...</Text>
        </View>
      ) : hasError && !hasAnything ? (
        <View style={styles.centerContainer}>
          <Ionicons name="cloud-offline-outline" size={42} color="#dc2626" />
          <Text style={styles.errorText}>Could not load notifications</Text>
        </View>
      ) : !hasAnything ? (
        <View style={styles.centerContainer}>
          <Ionicons name="notifications-off-outline" size={42} color="#9ca3af" />
          <Text style={styles.emptyTitle}>You're all caught up</Text>
          <Text style={styles.secondaryText}>New activity and pending actions will appear here.</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          {(receivedRequests.length > 0 ||
            (groupInvites?.length || 0) > 0 ||
            (membershipRequests?.length || 0) > 0) && <SectionTitle>Pending actions</SectionTitle>}

          {receivedRequests.map((request: BPFriendship) => {
            const sender = memberMap?.[request.initiator_id];
            const userName = sender?.name || 'Someone';
            const avatarUrl = sender?.avatar_urls?.thumb || sender?.avatar_urls?.full;
            return (
              <Pressable
                key={`friend-${request.id}`}
                style={styles.card}
                onPress={() => router.push('/profile/connections')}
              >
                <Avatar uri={avatarUrl} fallback="person-add-outline" />
                <View style={styles.cardBody}>
                  <Text style={styles.cardTitle}>Connection request</Text>
                  <Text style={styles.cardDescription}>{userName} wants to connect with you.</Text>
                  <Text style={styles.cardDate}>{formatDate(request.date_created)}</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#9ca3af" />
              </Pressable>
            );
          })}

          {(groupInvites || []).map(({ invite, group, inviter }) => {
            const pending = acceptInvite.isPending || rejectInvite.isPending;
            return (
              <View key={`group-invite-${invite.id}`} style={styles.card}>
                <Avatar uri={group?.avatar_urls?.thumb} fallback="people-outline" />
                <View style={styles.cardBody}>
                  <Text style={styles.cardTitle}>Group invitation</Text>
                  <Text style={styles.cardDescription}>
                    {inviter?.name || 'Someone'} invited you to join {group?.name || 'a group'}.
                  </Text>
                  <Text style={styles.cardDate}>{formatDate(invite.date_modified)}</Text>
                  <ActionButtons
                    pending={pending}
                    onAccept={() => handleInvite(invite.id, 'accept')}
                    onReject={() => handleInvite(invite.id, 'reject')}
                  />
                </View>
              </View>
            );
          })}

          {(membershipRequests || []).map(({ request, group, requester }) => {
            const pending = acceptMembership.isPending || rejectMembership.isPending;
            return (
              <View key={`membership-${request.id}`} style={styles.card}>
                <Avatar uri={requester?.avatar_urls?.thumb} fallback="person-add-outline" />
                <View style={styles.cardBody}>
                  <Text style={styles.cardTitle}>Group membership request</Text>
                  <Text style={styles.cardDescription}>
                    {requester?.name || 'Someone'} wants to join {group.name}.
                  </Text>
                  <Text style={styles.cardDate}>{formatDate(request.date_modified)}</Text>
                  <ActionButtons
                    pending={pending}
                    onAccept={() => handleMembershipRequest(group.id, request.id, 'accept')}
                    onReject={() => handleMembershipRequest(group.id, request.id, 'reject')}
                  />
                </View>
              </View>
            );
          })}

          {(messageNotifications.length > 0 || activityNotifications.length > 0) && (
            <SectionTitle>Updates</SectionTitle>
          )}

          {messageNotifications.map((message) => (
            <Pressable
              key={message.id}
              style={styles.card}
              onPress={() => router.push(`/messages/${message.threadId}`)}
            >
              <Avatar uri={message.avatarUrl} fallback="chatbubble-ellipses-outline" />
              <View style={styles.cardBody}>
                <Text style={styles.cardTitle}>New message from {message.senderName}</Text>
                <Text style={styles.cardDescription} numberOfLines={2}>{message.preview}</Text>
                <Text style={styles.cardDate}>{formatDate(message.createdAt)}</Text>
              </View>
              <View style={styles.countBadge}>
                <Text style={styles.countText}>{message.unreadCount}</Text>
              </View>
            </Pressable>
          ))}

          {activityNotifications.map((notification) => {
            const presentation = getNotificationPresentation(notification);
            return (
              <Pressable
                key={`native-${notification.id}`}
                style={styles.card}
                onPress={() => openNativeNotification(notification)}
              >
                <View style={styles.iconContainer}>
                  <Ionicons name={presentation.icon} size={21} color="#0369a1" />
                </View>
                <View style={styles.cardBody}>
                  <Text style={styles.cardTitle}>{presentation.title}</Text>
                  <Text style={styles.cardDescription}>{presentation.description}</Text>
                  <Text style={styles.cardDate}>{formatDate(notification.date)}</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#9ca3af" />
              </Pressable>
            );
          })}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingHorizontal: 28,
  },
  content: { padding: 16, paddingBottom: 32, gap: 10 },
  sectionTitle: {
    marginTop: 4,
    marginBottom: 2,
    fontSize: 13,
    fontWeight: '700',
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: 0.7,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  cardBody: { flex: 1 },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#e5e7eb' },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#e0f2fe',
  },
  cardTitle: { fontSize: 15, fontWeight: '700', color: '#1f2937' },
  cardDescription: { marginTop: 3, fontSize: 14, lineHeight: 19, color: '#4b5563' },
  cardDate: { marginTop: 5, fontSize: 12, color: '#9ca3af' },
  actionRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
  rejectButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 9,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    backgroundColor: '#fff',
  },
  acceptButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 9,
    borderRadius: 8,
    backgroundColor: '#0369a1',
  },
  disabledButton: { opacity: 0.55 },
  rejectText: { color: '#475569', fontSize: 14, fontWeight: '700' },
  acceptText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  countBadge: {
    minWidth: 24,
    height: 24,
    paddingHorizontal: 6,
    borderRadius: 12,
    backgroundColor: '#dc2626',
    alignItems: 'center',
    justifyContent: 'center',
  },
  countText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: '#374151' },
  secondaryText: { fontSize: 14, color: '#6b7280', textAlign: 'center' },
  errorText: { fontSize: 14, color: '#dc2626', textAlign: 'center' },
});
