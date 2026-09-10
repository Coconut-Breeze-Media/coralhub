// hooks/useGroups.ts
/**
 * React Query hooks for BuddyPress Groups
 * Provides hooks for fetching user groups with caching and automatic refetching
 */

import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from '@tanstack/react-query';
import {
  getMyGroups, getUserGroups, getGroupById, getGroupActivity, getGroupMembers, getAllGroups,
  joinGroup, leaveGroup,
  requestGroupMembership, getGroupMembershipRequests, getMyMembershipRequest,
  acceptMembershipRequest, rejectMembershipRequest,
} from '../lib/api';
import type { BPGroup, BPActivity } from '../types';

/**
 * Hook to fetch all groups for exploration
 * @param token - JWT authentication token
 * @param params - Query parameters (per_page, page, search)
 */
export function useAllGroups(
  token: string | null,
  params?: { per_page?: number; page?: number; search?: string; user_id?: number }
) {
  return useQuery({
    queryKey: ['groups', 'all', params] as const,
    queryFn: async () => {
      if (!token) throw new Error('No authentication token');
      return getAllGroups(token, params);
    },
    enabled: !!token,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}

/**
 * Hook to fetch current user's groups
 * @param token - JWT authentication token
 * @param max - Maximum number of groups to return (0 = all)
 */
export function useMyGroups(token: string | null, max?: number) {
  return useQuery({
    queryKey: ['groups', 'me', max || 'all'] as const,
    queryFn: async () => {
      if (!token) throw new Error('No authentication token');
      return getMyGroups(token, { max, context: 'view' });
    },
    enabled: !!token,
    staleTime: 5 * 60 * 1000, // 5 minutes - groups don't change frequently
    gcTime: 10 * 60 * 1000, // 10 minutes - keep in cache
    refetchOnWindowFocus: false,
  });
}

/**
 * Hook to fetch groups for a specific user
 * @param token - JWT authentication token
 * @param userId - User ID to fetch groups for
 * @param perPage - Number of groups per page (default 50)
 */
export function useUserGroups(
  token: string | null, 
  userId: number | null | undefined,
  perPage: number = 50
) {
  return useQuery({
    queryKey: ['groups', 'user', userId, perPage] as const,
    queryFn: async () => {
      if (!token) throw new Error('No authentication token');
      if (!userId) throw new Error('No user ID provided');
      return getUserGroups(userId, token, { per_page: perPage });
    },
    enabled: !!token && !!userId,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    refetchOnWindowFocus: false,
  });
}

/**
 * Hook to fetch a single group by ID with full details
 * @param token - JWT authentication token
 * @param groupId - Group ID to fetch
 * @param populateExtras - Whether to populate extra data (default true)
 */
export function useGroup(
  token: string | null,
  groupId: number | null | undefined,
  populateExtras: boolean = true
) {
  return useQuery({
    queryKey: ['groups', 'detail', groupId, populateExtras] as const,
    queryFn: async () => {
      if (!token) throw new Error('No authentication token');
      if (!groupId) throw new Error('No group ID provided');
      return getGroupById(groupId, token, populateExtras);
    },
    enabled: !!token && !!groupId,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    refetchOnWindowFocus: false,
  });
}

/**
 * Hook to fetch activity feed for a specific group
 * @param token - JWT authentication token
 * @param groupId - Group ID to fetch activity for
 * @param perPage - Number of activities per page (default 20)
 */
export function useGroupActivity(
  token: string | null,
  groupId: number | null | undefined,
  perPage: number = 20
) {
  return useQuery({
    queryKey: ['groups', 'activity', groupId, perPage] as const,
    queryFn: async () => {
      if (!token) throw new Error('No authentication token');
      if (!groupId) throw new Error('No group ID provided');
      return getGroupActivity(groupId, token, { per_page: perPage });
    },
    enabled: !!token && !!groupId,
    staleTime: 2 * 60 * 1000,
    gcTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false,
  });
}

/**
 * Hook to fetch ALL of a group's activity with infinite scroll/pagination —
 * use this instead of useGroupActivity wherever the full post history should
 * be reachable (useGroupActivity only ever returns the first page).
 * @param token - JWT authentication token
 * @param groupId - Group ID to fetch activity for
 * @param perPage - Items per page (default 20)
 */
export function useGroupActivityInfinite(
  token: string | null,
  groupId: number | null | undefined,
  perPage: number = 20
) {
  return useInfiniteQuery({
    queryKey: ['groups', 'activity', 'infinite', groupId, perPage] as const,
    queryFn: async ({ pageParam = 1 }) => {
      if (!token) throw new Error('No authentication token');
      if (!groupId) throw new Error('No group ID provided');
      return getGroupActivity(groupId, token, { per_page: perPage, page: pageParam });
    },
    enabled: !!token && !!groupId,
    staleTime: 2 * 60 * 1000,
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    initialPageParam: 1,
    getNextPageParam: (lastPage, allPages) => {
      const currentPage = allPages.length;
      if (currentPage < lastPage.pages) {
        return currentPage + 1;
      }
      return undefined;
    },
  });
}

/**
 * Hook to fetch a combined, paginated activity feed across ALL of a user's
 * groups at once (the "All Groups" view, when no specific group is
 * selected) — with infinite scroll, like the main News Feed.
 *
 * Each "page" fetches the next page of each group in parallel, merges the
 * results, sorts by date, and keeps going as long as at least one group
 * still has more posts.
 *
 * @param token - JWT authentication token
 * @param groupIds - IDs of every group to include
 * @param perPageEach - Items requested per group, per page (default 10)
 */
export function useAllGroupsActivity(
  token: string | null,
  groupIds: number[],
  perPageEach: number = 10
) {
  const sortedIds = [...groupIds].sort((a, b) => a - b);
  return useInfiniteQuery({
    queryKey: ['groups', 'activity', 'all', sortedIds.join(','), perPageEach] as const,
    queryFn: async ({ pageParam = 1 }) => {
      if (!token) throw new Error('No authentication token');

      const results = await Promise.all(
        sortedIds.map(async (groupId) => {
          try {
            const res = await getGroupActivity(groupId, token, { per_page: perPageEach, page: pageParam });
            return { groupId, activities: res.activities || [], hasMore: pageParam < (res.pages || 1) };
          } catch {
            return { groupId, activities: [] as BPActivity[], hasMore: false };
          }
        })
      );

      const activities = results
        .flatMap((r) => r.activities)
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      const hasMore = results.some((r) => r.hasMore);

      return { activities, hasMore };
    },
    enabled: !!token && sortedIds.length > 0,
    staleTime: 2 * 60 * 1000,
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    initialPageParam: 1,
    getNextPageParam: (lastPage, _allPages, lastPageParam) =>
      lastPage.hasMore ? (lastPageParam as number) + 1 : undefined,
  });
}

/**
 * Hook to fetch members of a specific group
 * @param token - JWT authentication token
 * @param groupId - Group ID to fetch members for
 * @param perPage - Number of members per page (default 50)
 */
export function useGroupMembers(
  token: string | null,
  groupId: number | null | undefined,
  perPage: number = 50
) {
  return useQuery({
    queryKey: ['groups', 'members', groupId, perPage] as const,
    queryFn: async () => {
      if (!token) throw new Error('No authentication token');
      if (!groupId) throw new Error('No group ID provided');
      return getGroupMembers(groupId, token, { per_page: perPage });
    },
    enabled: !!token && !!groupId,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
    // Don't retry on 403 — private group non-member access is intentionally denied
    retry: (count, error: any) => {
      if (error?.status === 403) return false;
      return count < 3;
    },
  });
}

/**
 * Mutation hook to join a group
 * Invalidates the group members and group detail cache on success
 */
export function useJoinGroup(token: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ groupId, userId }: { groupId: number; userId: number }) => {
      if (!token) throw new Error('Not authenticated');
      return joinGroup(groupId, userId, token);
    },
    onSuccess: (_data, { groupId }) => {
      queryClient.invalidateQueries({ queryKey: ['groups', 'members', groupId] });
      queryClient.invalidateQueries({ queryKey: ['groups', 'detail', groupId] });
      queryClient.invalidateQueries({ queryKey: ['groups', 'me'] });
    },
  });
}

/**
 * Mutation hook to leave a group
 * Invalidates the group members and group detail cache on success
 */
export function useLeaveGroup(token: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ groupId, userId }: { groupId: number; userId: number }) => {
      if (!token) throw new Error('Not authenticated');
      return leaveGroup(groupId, userId, token);
    },
    onSuccess: (_data, { groupId }) => {
      queryClient.invalidateQueries({ queryKey: ['groups', 'members', groupId] });
      queryClient.invalidateQueries({ queryKey: ['groups', 'detail', groupId] });
      queryClient.invalidateQueries({ queryKey: ['groups', 'me'] });
    },
  });
}

// ─── Membership Requests ─────────────────────────────────────────────────────

/** Send a join request to a private group */
export function useRequestMembership(token: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ groupId, userId }: { groupId: number; userId: number }) => {
      if (!token) throw new Error('Not authenticated');
      return requestGroupMembership(groupId, userId, token);
    },
    onSuccess: (_data, { groupId, userId }) => {
      queryClient.invalidateQueries({ queryKey: ['groups', 'membership-request', groupId, userId] });
    },
  });
}

/** Check if the current user already has a pending request for this group */
export function useMyMembershipRequest(
  token: string | null,
  userId: number | null | undefined,
  groupId: number | null | undefined
) {
  return useQuery({
    queryKey: ['groups', 'membership-request', groupId, userId] as const,
    queryFn: async () => {
      if (!token || !userId || !groupId) return [];
      return getMyMembershipRequest(userId, groupId, token);
    },
    enabled: !!token && !!userId && !!groupId,
    staleTime: 60 * 1000,
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}

/** Get all pending membership requests for a group (admin/creator only) */
export function useGroupMembershipRequests(
  token: string | null,
  groupId: number | null | undefined
) {
  return useQuery({
    queryKey: ['groups', 'membership-requests', groupId] as const,
    queryFn: async () => {
      if (!token || !groupId) return [];
      return getGroupMembershipRequests(groupId, token);
    },
    enabled: !!token && !!groupId,
    staleTime: 60 * 1000,
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    retry: (count, error: any) => {
      if (error?.status === 404 || error?.status === 403) return false;
      return count < 3;
    },
  });
}

/** Accept a membership request (admin/creator only) */
export function useAcceptMembershipRequest(token: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ groupId, requestId }: { groupId: number; requestId: number }) => {
      if (!token) throw new Error('Not authenticated');
      return acceptMembershipRequest(groupId, requestId, token);
    },
    onSuccess: (_data, { groupId }) => {
      queryClient.invalidateQueries({ queryKey: ['groups', 'membership-requests', groupId] });
      queryClient.invalidateQueries({ queryKey: ['groups', 'members', groupId] });
      queryClient.invalidateQueries({ queryKey: ['groups', 'detail', groupId] });
    },
  });
}

/** Reject a membership request or cancel your own pending request */
export function useRejectMembershipRequest(token: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ groupId, requestId }: { groupId: number; requestId: number }) => {
      if (!token) throw new Error('Not authenticated');
      return rejectMembershipRequest(groupId, requestId, token);
    },
    onSuccess: (_data, { groupId }) => {
      queryClient.invalidateQueries({ queryKey: ['groups', 'membership-requests', groupId] });
      queryClient.invalidateQueries({ queryKey: ['groups', 'membership-request', groupId] });
    },
  });
}
