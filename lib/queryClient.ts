// lib/queryClient.ts
/**
 * TanStack Query client configuration
 * Configures caching, retry logic, and default options for data fetching
 */

import { QueryClient } from '@tanstack/react-query';

/**
 * Default query options for all queries
 */
const DEFAULT_QUERY_OPTIONS = {
  queries: {
    // Cache data for 5 minutes by default
    staleTime: 5 * 60 * 1000,
    
    // Keep unused data in cache for 10 minutes
    gcTime: 10 * 60 * 1000,
    
    // Retry failed requests up to 3 times
    retry: 3,
    
    // Exponential backoff for retries
    retryDelay: (attemptIndex: number) => Math.min(1000 * 2 ** attemptIndex, 30000),
    
    // Refetch on window focus (useful for web)
    refetchOnWindowFocus: true,
    
    // Don't refetch on reconnect by default (can be overridden per query)
    refetchOnReconnect: false,
    
    // Refetch on mount only if data is stale
    refetchOnMount: true,
  },
  mutations: {
    // Retry mutations only once
    retry: 1,
    
    // Shorter retry delay for mutations
    retryDelay: 1000,
  },
};

/**
 * Create and configure the QueryClient instance
 */
export const queryClient = new QueryClient({
  defaultOptions: DEFAULT_QUERY_OPTIONS,
});

/**
 * Query key factory functions
 * Centralized location for all query keys to ensure consistency
 */
export const queryKeys = {
  // Auth & User
  auth: {
    me: () => ['auth', 'me'] as const,
    membership: () => ['auth', 'membership'] as const,
  },
  
  // Posts
  posts: {
    all: () => ['posts'] as const,
    list: (page: number) => ['posts', 'list', page] as const,
    detail: (id: number) => ['posts', 'detail', id] as const,
    byCategory: (categorySlug: string, page: number) => 
      ['posts', 'category', categorySlug, page] as const,
    byTag: (tagSlug: string, page: number) => 
      ['posts', 'tag', tagSlug, page] as const,
  },
  
  // Categories
  categories: {
    all: () => ['categories'] as const,
    detail: (slug: string) => ['categories', slug] as const,
  },
  
  // Tags
  tags: {
    all: () => ['tags'] as const,
    detail: (slug: string) => ['tags', slug] as const,
  },
  
  // Pages
  pages: {
    all: () => ['pages'] as const,
    detail: (slug: string) => ['pages', slug] as const,
  },
  
  // Membership
  membership: {
    levels: () => ['membership', 'levels'] as const,
    status: () => ['membership', 'status'] as const,
  },
  
  // Friends
  friends: {
    all: (userId: number) => ['friends', 'list', userId] as const,
    relationships: (userId: number) => ['friends', 'relationships', userId] as const,
    count: (userId: number) => ['friends', 'count', userId] as const,
  },
} as const;

/**
 * Cache invalidation helpers
 */
export const invalidateQueries = {
  /**
   * Invalidate all post-related queries
   */
  posts: () => queryClient.invalidateQueries({ queryKey: queryKeys.posts.all() }),
  
  /**
   * Invalidate specific post
   */
  post: (id: number) => queryClient.invalidateQueries({ queryKey: queryKeys.posts.detail(id) }),
  
  /**
   * Invalidate user data
   */
  user: () => queryClient.invalidateQueries({ queryKey: queryKeys.auth.me() }),
  
  /**
   * Invalidate membership data
   */
  membership: () => queryClient.invalidateQueries({ queryKey: queryKeys.membership.levels() }),
  
  /**
   * Invalidate all queries
   */
  all: () => queryClient.invalidateQueries(),
};

/**
 * Prefetch helpers for optimistic loading
 */
export const prefetchQueries = {
  /**
   * Prefetch posts for next page
   */
  postsNextPage: async (currentPage: number) => {
    const { getPosts } = await import('./api');
    return queryClient.prefetchQuery({
      queryKey: queryKeys.posts.list(currentPage + 1),
      queryFn: () => getPosts(currentPage + 1),
    });
  },
  
  /**
   * Prefetch membership levels
   */
  membershipLevels: async () => {
    const { getMembershipLevels } = await import('./api');
    return queryClient.prefetchQuery({
      queryKey: queryKeys.membership.levels(),
      queryFn: getMembershipLevels,
    });
  },
};
