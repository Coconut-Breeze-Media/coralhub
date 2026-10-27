// hooks/useMembers.ts
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Image } from 'react-native';
import { getMemberById, getMembers, getMembersByIds } from '../lib/api';
import type { BPFriendship, BPMember } from '../types';

/**
 * Hook to fetch a BuddyPress member by ID
 * @param token - JWT authentication token
 * @param userId - User ID to fetch
 */
export function useMember(token: string | null, userId: number | null | undefined) {
  return useQuery({
    queryKey: ['member', userId] as const,
    queryFn: async () => {
      if (!token) throw new Error('No authentication token');
      if (!userId) throw new Error('No user ID provided');
      return getMemberById(userId, token);
    },
    enabled: !!token && !!userId,
    staleTime: 5 * 60 * 1000, // 5 minutes - user info doesn't change often
    gcTime: 10 * 60 * 1000, // 10 minutes - keep in cache
  });
}

/**
 * Hook to fetch a paginated/searchable list of BuddyPress members
 * @param token - JWT authentication token
 * @param options - Query options (search, page, perPage)
 */
export function useMembersList(
  token: string | null,
  options?: { search?: string; page?: number; perPage?: number; exclude?: number[] }
) {
  const excludeKey = [...(options?.exclude ?? [])].sort((a, b) => a - b).join(',');
  return useQuery({
    queryKey: [
      'members',
      'list',
      options?.search ?? '',
      options?.page ?? 1,
      options?.perPage ?? 20,
      excludeKey,
    ] as const,
    queryFn: () => {
      if (!token) throw new Error('No authentication token');
      return getMembers(token, options);
    },
    enabled: !!token,
    staleTime: 2 * 60 * 1000,
    // Keep the previous result on screen while a new search is in flight.
    placeholderData: (previous) => previous,
  });
}

/**
 * Hook to prefetch multiple members at once
 * This is useful for prefetching user data for a list of activities
 * @param token - JWT authentication token
 * @param userIds - Array of user IDs to prefetch
 */
export function usePrefetchMembers(token: string | null, userIds: number[]) {
  const uniqueUserIds = Array.from(new Set(userIds));
  
  return useQuery({
    queryKey: ['members', 'prefetch', uniqueUserIds.sort().join(',')] as const,
    queryFn: async () => {
      if (!token) throw new Error('No authentication token');
      
      // Fetch all members in parallel
      const memberPromises = uniqueUserIds.map(userId => 
        getMemberById(userId, token).catch(error => {
          return null; // Return null for failed requests
        })
      );
      
      const members = await Promise.all(memberPromises);
      
      // Create a map of userId -> member for easy lookup
      const memberMap: Record<number, BPMember | null> = {};
      uniqueUserIds.forEach((userId, index) => {
        memberMap[userId] = members[index];
      });
      
      return memberMap;
    },
    enabled: !!token && uniqueUserIds.length > 0,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });
}

/**
 * Members on the other side of the user's pending connection requests,
 * loaded in one batched request (`members?include=`), keyed by user id.
 *
 * Each member is also written to the per-member cache (`['member', id]`) and
 * their avatar is prefetched, so the Requests list and member profiles open
 * with names and photos already in place instead of placeholder initials.
 * The tab layout calls this too, which warms the cache at app start.
 */
export function usePendingRequestMembers(
  token: string | null,
  userId: number | null | undefined,
  requests: BPFriendship[] | undefined
) {
  const queryClient = useQueryClient();
  const currentUserId = Number(userId);
  const otherIds = Array.from(
    new Set(
      (requests || [])
        .map((request) =>
          Number(request.initiator_id) === currentUserId
            ? Number(request.friend_id)
            : Number(request.initiator_id)
        )
        .filter((id) => Number.isFinite(id) && id > 0 && id !== currentUserId)
    )
  ).sort((a, b) => a - b);

  return useQuery({
    queryKey: ['members', 'pending-requests', currentUserId, otherIds.join(',')] as const,
    queryFn: async () => {
      if (!token) throw new Error('No authentication token');
      const members = await getMembersByIds(token, otherIds);
      const map: Record<number, BPMember> = {};
      members.forEach((member) => {
        map[member.id] = member;
        queryClient.setQueryData(['member', member.id], member);
        const avatar = member.avatar_urls?.thumb || member.avatar_urls?.full;
        if (avatar) Image.prefetch(avatar).catch(() => {});
      });
      return map;
    },
    enabled: !!token && !!userId && otherIds.length > 0,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    // Keep showing the members already loaded while the list changes
    // (e.g. after accepting a request).
    placeholderData: (previous) => previous,
  });
}
