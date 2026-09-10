// hooks/useActivity.ts
import { useMutation, useQuery, useQueryClient, useInfiniteQuery } from '@tanstack/react-query';
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
    staleTime: 2 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
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

  const toggleActivity = (activity: BPActivity, activityId: number, nextFavorited: boolean): BPActivity => {
    if (activity.id !== activityId) return activity;
    const currentCount = activity.favorite_count || 0;
    return {
      ...activity,
      favorited: nextFavorited,
      favorite_count: Math.max(0, currentCount + (nextFavorited ? 1 : -1)),
    };
  };

  return useMutation({
    mutationFn: async ({ activityId, isLiked }: { activityId: number; isLiked: boolean }) => {
      if (!token) throw new Error('No authentication token');

      if (isLiked) {
        return unlikePost(activityId, token);
      } else {
        return likePost(activityId, token);
      }
    },
    onMutate: async ({ activityId, isLiked }) => {
      const nextFavorited = !isLiked;
      await queryClient.cancelQueries({ queryKey: ['activity'] });
      await queryClient.cancelQueries({ queryKey: ['groups', 'activity'] });

      const previousQueries = [
        ...queryClient.getQueriesData<unknown>({ queryKey: ['activity'] }),
        ...queryClient.getQueriesData<unknown>({ queryKey: ['groups', 'activity'] }),
      ];

      // Main feed / "My Posts" (infinite query: { pages: [...] })
      queryClient.setQueriesData<{ pages: ActivityFeedResponse[] } | undefined>(
        { queryKey: ['activity', 'feed'] },
        (old) => {
          if (!old?.pages) return old;
          return {
            ...old,
            pages: old.pages.map((page) => ({
              ...page,
              activities: page.activities.map((activity) =>
                toggleActivity(activity, activityId, nextFavorited)
              ),
            })),
          };
        }
      );

      queryClient.setQueriesData<BPActivity | undefined>(
        { queryKey: ['activity', 'detail', activityId] },
        (old) => (old ? toggleActivity(old, activityId, nextFavorited) : old)
      );

      // Groups tab, single selected group (regular query: { activities: [...] })
      queryClient.setQueriesData<ActivityFeedResponse | undefined>(
        { queryKey: ['groups', 'activity'] },
        (old) => {
          if (!old?.activities) return old;
          return {
            ...old,
            activities: old.activities.map((activity) =>
              toggleActivity(activity, activityId, nextFavorited)
            ),
          };
        }
      );

      return { previousQueries };
    },
    onError: (_err, _vars, context) => {
      // Roll back the optimistic update if the request failed
      context?.previousQueries?.forEach(([key, data]) => {
        queryClient.setQueryData(key, data);
      });
    },
    onSettled: () => {
      // Mark stale without forcing an immediate refetch of the whole feed;
      // the optimistic value already reflects the change.
      queryClient.invalidateQueries({ queryKey: ['activity'], refetchType: 'none' });
      queryClient.invalidateQueries({ queryKey: ['groups', 'activity'], refetchType: 'none' });
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
  });
}

/**
 * Hook to delete a post
 * @param token - JWT authentication token
 */
export function useDeletePost(token: string | null) {
  const queryClient = useQueryClient();

  const removeActivity = (list: BPActivity[], activityId: number) =>
    list.filter((activity) => activity.id !== activityId);

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
    onMutate: async (activityId) => {
      await queryClient.cancelQueries({ queryKey: ['activity'] });
      await queryClient.cancelQueries({ queryKey: ['groups', 'activity'] });

      const previousQueries = [
        ...queryClient.getQueriesData<unknown>({ queryKey: ['activity'] }),
        ...queryClient.getQueriesData<unknown>({ queryKey: ['groups', 'activity'] }),
      ];

      // Main feed / "My Posts" (infinite query: { pages: [...] })
      queryClient.setQueriesData<{ pages: ActivityFeedResponse[] } | undefined>(
        { queryKey: ['activity', 'feed'] },
        (old) => {
          if (!old?.pages) return old;
          return {
            ...old,
            pages: old.pages.map((page) => ({
              ...page,
              activities: removeActivity(page.activities, activityId),
            })),
          };
        }
      );

      // Groups tab, single selected group (regular query: { activities: [...] })
      queryClient.setQueriesData<ActivityFeedResponse | undefined>(
        { queryKey: ['groups', 'activity'] },
        (old) => (old?.activities ? { ...old, activities: removeActivity(old.activities, activityId) } : old)
      );

      return { previousQueries };
    },
    onError: (_err, _activityId, context) => {
      context?.previousQueries?.forEach(([key, data]) => {
        queryClient.setQueryData(key, data);
      });
    },
    onSuccess: (_data, activityId) => {
      queryClient.removeQueries({ queryKey: ['comments', activityId] });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['activity'], refetchType: 'none' });
      queryClient.invalidateQueries({ queryKey: ['groups', 'activity'], refetchType: 'none' });
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
