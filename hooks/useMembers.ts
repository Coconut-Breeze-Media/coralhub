// hooks/useMembers.ts
import { useQuery } from '@tanstack/react-query';
import { getMemberById } from '../lib/api';
import type { BPMember } from '../types';

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
          console.error(`Failed to fetch member ${userId}:`, error);
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
