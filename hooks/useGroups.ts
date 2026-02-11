// hooks/useGroups.ts
/**
 * React Query hooks for BuddyPress Groups
 * Provides hooks for fetching user groups with caching and automatic refetching
 */

import { useQuery } from '@tanstack/react-query';
import { getMyGroups, getUserGroups, getGroupById, getGroupActivity, getGroupMembers } from '../lib/api';
import type { BPGroup } from '../types';

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
    staleTime: 30000, // 30 seconds - activity updates frequently
    gcTime: 5 * 60 * 1000, // 5 minutes
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
    staleTime: 5 * 60 * 1000, // 5 minutes - members don't change frequently
    gcTime: 10 * 60 * 1000, // 10 minutes
  });
}
