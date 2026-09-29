// hooks/useActivity.ts
import { useMutation, useQuery, useQueryClient, useInfiniteQuery } from '@tanstack/react-query';
import type { QueryClient, InfiniteData } from '@tanstack/react-query';
import {
  getActivityFeed,
  getActivityById,
  createPost,
  createGroupPost,
  updatePost,
  likePost,
  unlikePost,
  sharePost,
  deletePost,
  getPostComments,
  createComment,
  updateComment,
  deleteComment,
  searchUsers,
} from '../lib/api';
import type { UserSearchResult } from '../lib/api';
import type {
  BPActivity,
  CreateActivityPayload,
  ActivityFeedResponse,
} from '../types';

/**
 * Hook to fetch activity feed with infinite scroll/pagination
 * @param token - JWT authentication token
 * @param scope - 'just-me' for user's posts, 'friends' for friends' posts, 'groups' for groups posts, or undefined for all
 * @param userId - Filter by specific user ID
 */
export function useActivityFeed(
  token: string | null,
  scope?: 'just-me' | 'friends' | 'groups',
  userId?: number,
  enabled: boolean = true
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
    enabled: !!token && enabled,
    // Keep the feed close to the website: short stale window + periodic polling
    // while the app is foregrounded, plus a refresh whenever the screen mounts.
    staleTime: 30 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchInterval: 30 * 1000,
    refetchIntervalInBackground: false,
    refetchOnMount: 'always',
    refetchOnReconnect: true,
    refetchOnWindowFocus: false,
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
 * Remove an activity from every cached feed after the server reports it no
 * longer exists (404). Covers the infinite News Feed / My Posts queries and the
 * per-group activity queries so the UI drops the post without a full refetch.
 */
export function removeActivityFromCache(queryClient: QueryClient, activityId: number) {
  queryClient.setQueriesData<InfiniteData<ActivityFeedResponse>>(
    { queryKey: ['activity', 'feed'] },
    (old) => {
      if (!old || !Array.isArray(old.pages)) return old;
      let changed = false;
      const pages = old.pages.map((page) => {
        if (!page || !Array.isArray(page.activities)) return page;
        const activities = page.activities.filter((a) => a.id !== activityId);
        if (activities.length !== page.activities.length) changed = true;
        return { ...page, activities };
      });
      return changed ? { ...old, pages } : old;
    }
  );

  queryClient.setQueriesData<ActivityFeedResponse>(
    { queryKey: ['groups', 'activity'] },
    (old) => {
      if (!old || !Array.isArray(old.activities)) return old;
      const activities = old.activities.filter((a) => a.id !== activityId);
      return activities.length === old.activities.length ? old : { ...old, activities };
    }
  );

  queryClient.removeQueries({ queryKey: ['activity', 'detail', activityId] });
}

/** True when an API error means the post was deleted on the server. */
function isNotFoundError(error: unknown): boolean {
  return (error as { status?: number } | null)?.status === 404;
}

/**
 * Hook to fetch a single activity by ID.
 * Used for shared posts so the app renders the original activity directly
 * instead of relying on BuddyPress' rendered share embed.
 */
export function useActivityById(token: string | null, activityId: number | null | undefined) {
  return useQuery<BPActivity>({
    queryKey: ['activity', 'detail', activityId] as const,
    queryFn: async () => {
      if (!token) throw new Error('No authentication token');
      if (!activityId) throw new Error('No activity ID provided');
      return getActivityById(activityId, token);
    },
    enabled: !!token && !!activityId,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
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
    onError: (error, { activityId }) => {
      if (isNotFoundError(error)) {
        removeActivityFromCache(queryClient, activityId);
        queryClient.invalidateQueries({ queryKey: ['activity'] });
      }
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
    mutationFn: async ({
      activityId,
      postUrl,
      content,
    }: {
      activityId: number;
      postUrl: string;
      content?: string;
    }) => {
      if (!token) throw new Error('No authentication token');
      return sharePost(activityId, postUrl, token, content);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['activity'] });
    },
    onError: (error, { activityId }) => {
      if (isNotFoundError(error)) {
        removeActivityFromCache(queryClient, activityId);
        queryClient.invalidateQueries({ queryKey: ['activity'] });
      }
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
      // Delete all comments for this post first, then delete the post itself
      try {
        const comments = await getPostComments(activityId, token);
        if (comments.length > 0) {
          await Promise.all(comments.map((c) => deleteComment(c.id, token)));
        }
      } catch {
        // If comment cleanup fails (no comments, permissions, etc.) still delete the post
      }
      return deletePost(activityId, token);
    },
    onSuccess: (_data, activityId) => {
      queryClient.invalidateQueries({ queryKey: ['activity'] });
      queryClient.removeQueries({ queryKey: ['comments', activityId] });
    },
    onError: (error, activityId) => {
      if (isNotFoundError(error)) {
        // Already gone on the server — drop it locally too.
        removeActivityFromCache(queryClient, activityId);
        queryClient.removeQueries({ queryKey: ['comments', activityId] });
        queryClient.invalidateQueries({ queryKey: ['activity'] });
      }
    },
  });
}

/**
 * Hook to update/edit a post
 * @param token - JWT authentication token
 */
export function useUpdatePost(token: string | null) {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ 
      activityId, 
      content, 
      component, 
      primary_item_id 
    }: { 
      activityId: number; 
      content: string;
      component?: string;
      primary_item_id?: number;
    }) => {
      if (!token) throw new Error('No authentication token');
      return updatePost(activityId, content, token, { component, primary_item_id });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['activity'] });
    },
    onError: (error, { activityId }) => {
      if (isNotFoundError(error)) {
        removeActivityFromCache(queryClient, activityId);
        queryClient.invalidateQueries({ queryKey: ['activity'] });
      }
    },
  });
}

/**
 * Hook to fetch comments for a post
 * @param token  - JWT authentication token
 * @param postId - Post/activity ID to fetch comments for (null = disabled)
 */
export function usePostComments(token: string | null, postId: number | null) {
  return useQuery<BPActivity[]>({
    queryKey: ['comments', postId],
    queryFn: async () => {
      if (!token || !postId) throw new Error('Missing token or postId');
      return getPostComments(postId, token);
    },
    enabled: !!token && !!postId,
    staleTime: 60 * 1000,
    gcTime: 5 * 60 * 1000,
    // A 404 means the post was removed on the website — no point retrying.
    retry: (count, error: any) => {
      if (error?.status === 404) return false;
      return count < 1;
    },
  });
}

/**
 * Hook to create a comment on a post
 * @param token - JWT authentication token
 */
export function useCreateComment(token: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      postId,
      content,
      parentCommentId,
    }: {
      postId: number;
      content: string;
      parentCommentId?: number;
    }) => {
      if (!token) throw new Error('No authentication token');
      return createComment(postId, content, token, parentCommentId);
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['comments', variables.postId] });
    },
  });
}

/**
 * Hook to edit an existing comment — user must be author or admin
 * @param token - JWT authentication token
 */
export function useUpdateComment(token: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      commentId,
      content,
      postId,
      primaryItemId,
      secondaryItemId,
    }: {
      commentId: number;
      content: string;
      postId: number;
      primaryItemId?: number;
      secondaryItemId?: number;
    }) => {
      if (!token) throw new Error('No authentication token');
      return updateComment(commentId, content, token, primaryItemId, secondaryItemId);
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['comments', variables.postId] });
    },
  });
}

/**
 * Hook to permanently delete a comment — user must be author or admin
 * @param token - JWT authentication token
 */
export function useDeleteComment(token: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ commentId, postId: _postId }: { commentId: number; postId: number }) => {
      if (!token) throw new Error('No authentication token');
      return deleteComment(commentId, token);
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['comments', variables.postId] });
    },
  });
}

/**
 * Hook to create a post in a group
 * @param token - JWT authentication token
 */
export function useCreateGroupPost(token: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ groupId, content }: { groupId: number; content: string }) => {
      if (!token) throw new Error('No authentication token');
      return createGroupPost(groupId, content, token);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['activity'] });
      queryClient.invalidateQueries({ queryKey: ['groups'] });
    },
  });
}

/**
 * Hook to search users by partial name for @mention autocomplete
 * @param token - JWT authentication token
 * @param query - Partial name/username to search (null = disabled)
 */
export function useSearchUsers(token: string | null, query: string | null) {
  return useQuery<UserSearchResult[]>({
    queryKey: ['users', 'search', query],
    queryFn: async () => {
      if (!token || !query) return [];
      return searchUsers(query, token);
    },
    enabled: !!token && !!query && query.length >= 1,
    staleTime: 2 * 60 * 1000,
    gcTime: 5 * 60 * 1000,
  });
}
