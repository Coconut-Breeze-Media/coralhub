// hooks/useActivity.ts
import { useMutation, useQuery, useQueryClient, useInfiniteQuery } from '@tanstack/react-query';
import { 
  getActivityFeed, 
  createPost, 
  likePost, 
  unlikePost, 
  sharePost, 
  deletePost 
} from '../lib/api';
import type { 
  BPActivity, 
  CreateActivityPayload, 
  ActivityFeedResponse 
} from '../types';

/**
 * Hook to fetch activity feed with infinite scroll/pagination
 * @param token - JWT authentication token
 * @param scope - 'just-me' for user's posts, 'friends' for friends' posts, or undefined for all
 * @param userId - Filter by specific user ID
 */
export function useActivityFeed(
  token: string | null,
  scope?: 'just-me' | 'friends',
  userId?: number
) {
  return useInfiniteQuery({
    queryKey: ['activity', 'feed', scope || 'all', userId || 'all'] as const,
    queryFn: async ({ pageParam = 1 }) => {
      if (!token) throw new Error('No authentication token');
      return getActivityFeed(token, { 
        scope, 
        user_id: userId, 
        page: pageParam,
        per_page: 20,
        component: 'activity' // Only fetch activities with component 'activity'
      });
    },
    enabled: !!token,
    staleTime: 30000, // 30 seconds
    refetchOnWindowFocus: true,
    initialPageParam: 1,
    getNextPageParam: (lastPage, allPages) => {
      // Check if there are more pages
      const currentPage = allPages.length;
      if (currentPage < lastPage.pages) {
        return currentPage + 1;
      }
      return undefined; // No more pages
    },
  });
}

/**
 * Hook to create a new post
 * @param token - JWT authentication token
 */
export function useCreatePost(token: string | null) {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (payload: CreateActivityPayload) => {
      if (!token) throw new Error('No authentication token');
      return createPost(token, payload);
    },
    onSuccess: () => {
      // Invalidate all activity queries to refetch the feed
      queryClient.invalidateQueries({ queryKey: ['activity'] });
    },
  });
}

/**
 * Hook to like/unlike a post
 * @param token - JWT authentication token
 */
export function useLikePost(token: string | null) {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ activityId, isLiked }: { activityId: number; isLiked: boolean }) => {
      if (!token) throw new Error('No authentication token');
      
      if (isLiked) {
        return unlikePost(activityId, token);
      } else {
        return likePost(activityId, token);
      }
    },
    onSuccess: () => {
      // Invalidate activity queries to update the UI
      queryClient.invalidateQueries({ queryKey: ['activity'] });
    },
  });
}

/**
 * Hook to share a post
 * @param token - JWT authentication token
 */
export function useSharePost(token: string | null) {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ activityId, content }: { activityId: number; content?: string }) => {
      if (!token) throw new Error('No authentication token');
      return sharePost(activityId, content || '', token);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['activity'] });
    },
  });
}

/**
 * Hook to delete a post
 * @param token - JWT authentication token
 */
export function useDeletePost(token: string | null) {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (activityId: number) => {
      if (!token) throw new Error('No authentication token');
      return deletePost(activityId, token);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['activity'] });
    },
  });
}
