// hooks/useQueries.ts
/**
 * Custom React Query hooks for data fetching
 * Provides type-safe, cached data fetching with automatic refetching and error handling
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys, invalidateQueries } from '../lib/queryClient';
import { useAuth } from '../lib/auth';
import type {
  WPPost,
  WPUser,
  MembershipLevel,
  MembershipResponse,
  JWTPayload,
} from '../types';

// Import API functions dynamically to avoid circular dependencies
import {
  getPosts,
  getMe,
  getMembershipLevels,
  getMembershipStatus,
  wpLogin,
} from '../lib/api';

/**
 * Hook to fetch current user data
 * Requires authentication token
 */
export function useMe() {
  const { token } = useAuth();
  
  return useQuery({
    queryKey: queryKeys.auth.me(),
    queryFn: () => {
      if (!token) throw new Error('No authentication token');
      return getMe(token);
    },
    enabled: !!token,
    staleTime: 10 * 60 * 1000, // 10 minutes
  });
}

/**
 * Hook to fetch membership status
 * Requires authentication token
 */
export function useMembershipStatus() {
  const { token } = useAuth();
  
  return useQuery({
    queryKey: queryKeys.auth.membership(),
    queryFn: () => {
      if (!token) throw new Error('No authentication token');
      return getMembershipStatus(token);
    },
    enabled: !!token,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Hook to fetch posts with pagination
 * @param page - Page number (1-indexed)
 * @param options - Additional query options
 */
export function usePosts(page = 1, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: queryKeys.posts.list(page),
    queryFn: () => getPosts(page),
    staleTime: 3 * 60 * 1000, // 3 minutes for posts
    ...options,
  });
}

/**
 * Hook to fetch membership levels
 * Public data, no authentication required
 */
export function useMembershipLevels() {
  return useQuery({
    queryKey: queryKeys.membership.levels(),
    queryFn: getMembershipLevels,
    staleTime: 30 * 60 * 1000, // 30 minutes - this data rarely changes
  });
}

/**
 * Mutation hook for user login
 * Invalidates auth queries on success
 */
export function useLogin() {
  const queryClient = useQueryClient();
  const { setAuth } = useAuth();
  
  return useMutation({
    mutationFn: ({ username, password }: { username: string; password: string }) =>
      wpLogin(username, password),
    onSuccess: async (data: JWTPayload) => {
      // Update auth context
      await setAuth(data);
      
      // Invalidate and refetch user data
      await invalidateQueries.user();
      await invalidateQueries.membership();
    },
  });
}

/**
 * Mutation hook for user logout
 * Clears all cached data on success
 */
export function useLogout() {
  const queryClient = useQueryClient();
  const { clearAuth } = useAuth();
  
  return useMutation({
    mutationFn: async () => {
      await clearAuth();
    },
    onSuccess: () => {
      // Clear all cached data on logout
      queryClient.clear();
    },
  });
}

/**
 * Hook to prefetch next page of posts
 * Useful for pagination optimization
 */
export function usePrefetchNextPage(currentPage: number) {
  const queryClient = useQueryClient();
  
  const prefetchNext = () => {
    queryClient.prefetchQuery({
      queryKey: queryKeys.posts.list(currentPage + 1),
      queryFn: () => getPosts(currentPage + 1),
    });
  };
  
  return { prefetchNext };
}

/**
 * Hook to manually refetch membership status
 * Useful after membership changes
 */
export function useRefreshMembership() {
  const queryClient = useQueryClient();
  const { token } = useAuth();
  
  const refresh = async () => {
    if (!token) return;
    
    await queryClient.invalidateQueries({
      queryKey: queryKeys.auth.membership(),
    });
    
    await queryClient.refetchQueries({
      queryKey: queryKeys.auth.membership(),
    });
  };
  
  return { refresh };
}

// ============================================
// Friends Hooks
// ============================================

/**
 * Hook to fetch friends list for a user
 * @param userId - User ID to get friends for
 * @param page - Page number for pagination
 * @param perPage - Items per page
 */
export function useFriendsList(userId?: number, page = 1, perPage = 20) {
  const { token } = useAuth();
  
  return useQuery({
    queryKey: [...queryKeys.friends.all(userId || 0), page, perPage] as const,
    queryFn: async () => {
      if (!token || !userId) throw new Error('No authentication token or user ID');
      const { getFriendsList } = await import('../lib/api');
      return getFriendsList(userId, token, page, perPage);
    },
    enabled: !!token && !!userId,
    staleTime: 3 * 60 * 1000, // 3 minutes
  });
}

/**
 * Hook to fetch friendship relationships (raw data)
 * @param userId - User ID to get friendships for
 */
export function useFriendshipRelationships(userId?: number) {
  const { token } = useAuth();
  
  return useQuery({
    queryKey: queryKeys.friends.relationships(userId || 0),
    queryFn: async () => {
      if (!token || !userId) throw new Error('No authentication token or user ID');
      const { getFriendshipRelationships } = await import('../lib/api');
      return getFriendshipRelationships(userId, token);
    },
    enabled: !!token && !!userId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Mutation hook to remove a friend
 * Invalidates friends list on success
 */
export function useRemoveFriend() {
  const queryClient = useQueryClient();
  const { token } = useAuth();
  
  return useMutation({
    mutationFn: async ({ 
      friendUserId, 
      friendshipId 
    }: { 
      friendUserId: number;
      friendshipId?: number;
    }) => {
      if (!token) throw new Error('No authentication token');
      const { removeFriend } = await import('../lib/api');
      return removeFriend(friendUserId, token, friendshipId);
    },
    onSuccess: () => {
      // Invalidate all friends queries to refresh the list
      queryClient.invalidateQueries({
        queryKey: ['friends'],
      });
    },
  });
}

/**
 * Hook to fetch pending friend requests (received and sent)
 * @param userId - Current user ID
 */
export function usePendingFriendRequests(userId?: number) {
  const { token } = useAuth();
  
  return useQuery({
    queryKey: ['friends', 'pending', userId || 0] as const,
    queryFn: async () => {
      if (!token || !userId) throw new Error('No authentication token or user ID');
      const { getPendingFriendRequests } = await import('../lib/api');
      return getPendingFriendRequests(userId, token);
    },
    enabled: !!token && !!userId,
    staleTime: 30 * 1000, // 30 seconds - refresh frequently for friend requests
  });
}

/**
 * Mutation hook to accept a friend request
 * Invalidates friends list and pending requests on success
 * Uses optimistic update to remove request from UI immediately
 */
export function useAcceptFriendRequest() {
  const queryClient = useQueryClient();
  const { token } = useAuth();
  
  return useMutation({
    mutationFn: async ({ otherUserId, userId }: { otherUserId: number; userId: number }) => {
      if (!token) throw new Error('No authentication token');
      const { acceptFriendRequest } = await import('../lib/api');
      return acceptFriendRequest(otherUserId, token);
    },
    onMutate: async ({ otherUserId, userId }) => {
      // Cancel any outgoing refetches so they don't overwrite our optimistic update
      await queryClient.cancelQueries({ queryKey: ['friends', 'pending', userId] });
      
      // Snapshot the previous value
      const previousRequests = queryClient.getQueryData(['friends', 'pending', userId]);
      
      // Optimistically remove the accepted request from the list
      queryClient.setQueryData(['friends', 'pending', userId], (old: any) => {
        if (!Array.isArray(old)) return old;
        console.log('[Optimistic Update] Removing request from cache:', { otherUserId, userId, currentRequests: old.length });
        const filtered = old.filter((req: any) => {
          // Remove the request where the other user is involved
          const requestOtherUserId = req.initiator_id === userId ? req.friend_id : req.initiator_id;
          const shouldKeep = requestOtherUserId !== otherUserId;
          if (!shouldKeep) {
            console.log('[Optimistic Update] Removing request:', req.id, 'with otherUserId:', requestOtherUserId);
          }
          return shouldKeep;
        });
        console.log('[Optimistic Update] Remaining requests:', filtered.length);
        return filtered;
      });
      
      return { previousRequests, userId };
    },
    onError: (err, variables, context) => {
      // Rollback to previous state on error
      if (context?.previousRequests && context?.userId) {
        console.log('[Optimistic Update] Rolling back due to error');
        queryClient.setQueryData(['friends', 'pending', context.userId], context.previousRequests);
      }
    },
    onSettled: (data, error, variables) => {
      // Always refetch after error or success to ensure sync with server
      console.log('[Optimistic Update] Settled, invalidating queries');
      queryClient.invalidateQueries({ queryKey: ['friends', 'pending', variables.userId] });
      queryClient.invalidateQueries({ queryKey: ['friends'] });
    },
  });
}

/**
 * Mutation hook to reject or cancel a friend request
 * Invalidates pending requests on success
 */
export function useRejectFriendRequest() {
  const queryClient = useQueryClient();
  const { token } = useAuth();
  
  return useMutation({
    mutationFn: async (otherUserId: number) => {
      if (!token) throw new Error('No authentication token');
      const { rejectFriendRequest } = await import('../lib/api');
      return rejectFriendRequest(otherUserId, token);
    },
    onSuccess: () => {
      // Invalidate pending requests to refresh the list
      queryClient.invalidateQueries({
        queryKey: ['friends', 'pending'],
      });
    },
  });
}

/**
 * Mutation hook to send a friend request
 * Invalidates pending requests on success
 */
export function useSendFriendRequest() {
  const queryClient = useQueryClient();
  const { token, profile } = useAuth();
  
  return useMutation({
    mutationFn: async (friendId: number) => {
      if (!token || !profile?.user_id) throw new Error('No authentication token or user ID');
      const { sendFriendRequest } = await import('../lib/api');
      return sendFriendRequest(profile.user_id, friendId, token);
    },
    onSuccess: () => {
      // Invalidate pending requests to show the new request
      queryClient.invalidateQueries({
        queryKey: ['friends', 'pending'],
      });
    },
  });
}
