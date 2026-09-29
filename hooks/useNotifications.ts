import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  acceptGroupInvite,
  getBuddyPressNotifications,
  getGroupById,
  getGroupInvites,
  getGroupMembershipRequests,
  getMemberById,
  markBuddyPressNotificationRead,
  rejectGroupInvite,
} from '../lib/api';
import type {
  BPGroup,
  BPGroupInvite,
  BPGroupMembershipRequest,
  BPMember,
  BPNotification,
} from '../types';

export interface ResolvedGroupInvite {
  invite: BPGroupInvite;
  group: BPGroup | null;
  inviter: BPMember | null;
}

export interface ResolvedMembershipRequest {
  request: BPGroupMembershipRequest;
  group: BPGroup;
  requester: BPMember | null;
}

export function useBuddyPressNotifications(
  token: string | null,
  userId: number | null | undefined
) {
  return useQuery<BPNotification[]>({
    queryKey: ['notifications', 'buddypress', userId] as const,
    queryFn: () => {
      if (!token || !userId) throw new Error('Not authenticated');
      return getBuddyPressNotifications(userId, token);
    },
    enabled: !!token && !!userId,
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    refetchInterval: 30 * 1000,
    refetchIntervalInBackground: false,
  });
}

export function useMarkNotificationRead(token: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (notificationId: number) => {
      if (!token) throw new Error('Not authenticated');
      return markBuddyPressNotificationRead(notificationId, token);
    },
    onMutate: async (notificationId) => {
      await queryClient.cancelQueries({ queryKey: ['notifications', 'buddypress'] });
      const previous = queryClient.getQueriesData<BPNotification[]>({
        queryKey: ['notifications', 'buddypress'],
      });
      queryClient.setQueriesData<BPNotification[]>(
        { queryKey: ['notifications', 'buddypress'] },
        (current) => current?.filter((item) => item.id !== notificationId)
      );
      return { previous };
    },
    onError: (_error, _notificationId, context) => {
      context?.previous.forEach(([key, value]) => queryClient.setQueryData(key, value));
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications', 'buddypress'] });
    },
  });
}

export function useGroupInvites(
  token: string | null,
  userId: number | null | undefined
) {
  return useQuery<ResolvedGroupInvite[]>({
    queryKey: ['notifications', 'group-invites', userId] as const,
    queryFn: async () => {
      if (!token || !userId) throw new Error('Not authenticated');
      const invites = await getGroupInvites(userId, token);

      return Promise.all(
        invites.map(async (invite) => {
          const [group, inviter] = await Promise.all([
            getGroupById(invite.group_id, token).catch(() => null),
            getMemberById(invite.inviter_id, token).catch(() => null),
          ]);
          return { invite, group, inviter };
        })
      );
    },
    enabled: !!token && !!userId,
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
    refetchInterval: 30 * 1000,
    retry: (count, error: any) => {
      if (error?.status === 403 || error?.status === 404) return false;
      return count < 2;
    },
  });
}

export function useAcceptGroupInvite(token: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (inviteId: number) => {
      if (!token) throw new Error('Not authenticated');
      return acceptGroupInvite(inviteId, token);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['groups'] });
    },
  });
}

export function useRejectGroupInvite(token: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (inviteId: number) => {
      if (!token) throw new Error('Not authenticated');
      return rejectGroupInvite(inviteId, token);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['groups'] });
    },
  });
}

export function useManagedGroupMembershipRequests(
  token: string | null,
  userId: number | null | undefined,
  groups: BPGroup[] | undefined,
  notifications: BPNotification[] | undefined
) {
  const requestedGroupIds = new Set(
    (notifications || [])
      .filter((notification) =>
        ['membership_request', 'groups_membership_request', 'new_membership_request'].includes(
          notification.action
        )
      )
      .map((notification) => Number(notification.item_id))
  );
  const managedGroups = (groups || []).filter(
    (group) =>
      Number(group.creator_id) === Number(userId) ||
      requestedGroupIds.has(Number(group.id)) ||
      group.admins?.some(
        (admin) => Number(admin.user_id) === Number(userId) && admin.is_admin
      )
  );
  const managedGroupIds = managedGroups.map((group) => group.id).sort((a, b) => a - b);

  return useQuery<ResolvedMembershipRequest[]>({
    queryKey: ['notifications', 'group-membership-requests', managedGroupIds.join(',')] as const,
    queryFn: async () => {
      if (!token || !userId) throw new Error('Not authenticated');

      const requestsByGroup = await Promise.all(
        managedGroups.map(async (group) => {
          const requests = await getGroupMembershipRequests(group.id, token).catch(
            () => [] as BPGroupMembershipRequest[]
          );
          return requests.map((request) => ({ request, group }));
        })
      );
      const requests = requestsByGroup.flat();
      const requesterIds = Array.from(
        new Set(requests.map(({ request }) => Number(request.user_id)).filter(Boolean))
      );
      const requesters = await Promise.all(
        requesterIds.map(async (id) => [id, await getMemberById(id, token).catch(() => null)] as const)
      );
      const requesterMap = new Map<number, BPMember | null>(requesters);

      return requests.map(({ request, group }) => ({
        request,
        group,
        requester: requesterMap.get(Number(request.user_id)) ?? null,
      }));
    },
    enabled: !!token && !!userId && managedGroupIds.length > 0,
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
    refetchInterval: 30 * 1000,
  });
}
