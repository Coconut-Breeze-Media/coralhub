// components/FriendRequestRow.tsx
/**
 * One pending connection request (received or sent), shared by
 * Network > Members > Requests and Profile > My Connections > Requests.
 *
 * The member (name + avatar) is passed in from a batched lookup
 * (usePendingRequestMembers). While it loads, a neutral avatar/name skeleton
 * is shown instead of a placeholder initial.
 */

import React from 'react';
import { ActivityIndicator, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { ROUTES } from '../constants/navigation';
import type { BPFriendship, BPMember } from '../types';

type FriendRequestRowProps = {
  request: BPFriendship;
  userId: number;
  member?: BPMember | null;
  memberLoading: boolean;
  accepting: boolean;
  rejecting: boolean;
  /** Disable the action buttons (another request is being handled). */
  busy: boolean;
  onAccept: (request: BPFriendship) => void;
  onReject: (request: BPFriendship) => void;
};

function FriendRequestRow({
  request,
  userId,
  member,
  memberLoading,
  accepting,
  rejecting,
  busy,
  onAccept,
  onReject,
}: FriendRequestRowProps) {
  const isReceived = Number(request.friend_id) === Number(userId);
  const otherUserId = isReceived ? request.initiator_id : request.friend_id;
  const avatarUrl = member?.avatar_urls?.thumb || member?.avatar_urls?.full;
  const showSkeleton = !member && memberLoading;
  const userName = member?.name || (showSkeleton ? '' : 'Member');

  return (
    <View style={styles.requestCard}>
      <TouchableOpacity
        style={styles.requestInfo}
        activeOpacity={0.7}
        onPress={() =>
          router.push({ pathname: ROUTES.MEMBER_PROFILE, params: { id: String(otherUserId) } } as any)
        }
      >
        {avatarUrl ? (
          <Image source={{ uri: avatarUrl }} style={[styles.avatar, styles.avatarSkeleton]} />
        ) : showSkeleton ? (
          <View style={[styles.avatar, styles.avatarSkeleton]} />
        ) : (
          <View style={[styles.avatar, styles.avatarPlaceholder]}>
            <Text style={styles.avatarPlaceholderText}>{userName.charAt(0).toUpperCase()}</Text>
          </View>
        )}
        <View style={styles.requestDetails}>
          {showSkeleton ? (
            <View style={styles.nameSkeleton} />
          ) : (
            <Text style={styles.requestName}>{userName}</Text>
          )}
          <Text style={styles.requestType}>
            {isReceived ? 'Sent you a connection request' : 'Connection request sent'}
          </Text>
          <Text style={styles.requestDate}>
            {new Date(request.date_created).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            })}
          </Text>
        </View>
      </TouchableOpacity>
      <View style={styles.requestActions}>
        {isReceived ? (
          <>
            <TouchableOpacity
              style={[styles.acceptButton, busy && !accepting && styles.disabled]}
              onPress={() => onAccept(request)}
              disabled={busy}
            >
              {accepting ? (
                <>
                  <ActivityIndicator size="small" color="#fff" />
                  <Text style={styles.acceptButtonText}>Accepting…</Text>
                </>
              ) : (
                <>
                  <Ionicons name="checkmark" size={18} color="#fff" />
                  <Text style={styles.acceptButtonText}>Accept</Text>
                </>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.rejectButton, busy && !rejecting && styles.disabled]}
              onPress={() => onReject(request)}
              disabled={busy}
            >
              {rejecting ? (
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
            style={[styles.cancelButton, busy && !rejecting && styles.disabled]}
            onPress={() => onReject(request)}
            disabled={busy}
          >
            {rejecting ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.cancelButtonText}>Cancel Request</Text>
            )}
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

export default React.memo(FriendRequestRow);

const styles = StyleSheet.create({
  requestCard: {
    backgroundColor: '#fff', borderRadius: 12, padding: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 4, elevation: 3,
  },
  requestInfo: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  avatar: { width: 56, height: 56, borderRadius: 28, marginRight: 12 },
  avatarSkeleton: { backgroundColor: '#e5e7eb' },
  avatarPlaceholder: { backgroundColor: '#0066cc', justifyContent: 'center', alignItems: 'center' },
  avatarPlaceholderText: { color: '#fff', fontSize: 24, fontWeight: 'bold' },
  nameSkeleton: { width: 140, height: 16, borderRadius: 4, backgroundColor: '#e5e7eb', marginBottom: 6 },
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
  disabled: { opacity: 0.55 },
});
