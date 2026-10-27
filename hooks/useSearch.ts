// hooks/useSearch.ts
import { useEffect, useState } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { useAuth } from '../lib/auth';
import { searchSite } from '../lib/siteSearch';
import type { SiteSearchPage } from '../types';

/** Minimum characters before a search is sent. */
export const SITE_SEARCH_MIN_CHARS = 2;

/** Returns `value` once it has stopped changing for `delayMs`. */
export function useDebouncedValue<T>(value: T, delayMs = 350): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(id);
  }, [value, delayMs]);

  return debounced;
}

/**
 * Site-wide search (pages, posts, documents). Pass an already-debounced
 * query. Results are cached for 5 minutes per query, like other content.
 */
export function useSiteSearch(query: string) {
  const { token } = useAuth();
  const trimmed = query.trim();

  return useInfiniteQuery<SiteSearchPage, Error>({
    queryKey: ['search', 'site', trimmed.toLowerCase()],
    queryFn: async ({ pageParam }) => {
      if (!token) throw new Error('No authentication token');
      return searchSite(token, trimmed, pageParam as number);
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage) =>
      lastPage.page < lastPage.total_pages ? lastPage.page + 1 : undefined,
    enabled: !!token && trimmed.length >= SITE_SEARCH_MIN_CHARS,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}
