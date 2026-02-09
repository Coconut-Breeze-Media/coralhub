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
