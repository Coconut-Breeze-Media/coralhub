// hooks/useActivityFeed.ts
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  getActivity,
  getActivityLikeCount,
  getMembersByIds,
  postActivity,
  favoriteActivity,
  unfavoriteActivity,
  type ActivityItem,
  type BPMember,
} from '../lib/api';
import { useAuth } from '../lib/auth';

export type HydratedActivity = ActivityItem & { member?: BPMember };

export function useActivityFeed(pageSize = 20) {
  const { token } = useAuth();

  const [items, setItems] = useState<HydratedActivity[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // guards / race protection
  const mounted = useRef(true);
  const seq = useRef(0);
  const inFlight = useRef<Promise<void> | null>(null);
  const aborter = useRef<AbortController | null>(null);

  // prevent rapid double-taps on the same row
  const toggleBusy = useRef<Record<number, boolean>>({});

  useEffect(() => {
    return () => {
      mounted.current = false;
      aborter.current?.abort();
    };
  }, []);

  const mergeAppend = useCallback((base: HydratedActivity[], add: HydratedActivity[]) => {
    const seen = new Set(base.map(x => x.id));
    const appended = add.filter(x => !seen.has(x.id));
    return [...base, ...appended];
  }, []);

  const hydrate = useCallback(
    async (activities: ActivityItem[], signal?: AbortSignal): Promise<HydratedActivity[]> => {
      const rawIds = activities.map(a => a.user_id).filter(Boolean) as number[];
      const ids = Array.from(new Set(rawIds));
      const members = ids.length ? await getMembersByIds(ids, signal) : {};
      return activities.map(a => ({ ...a, member: members[a.user_id] }));
    },
    []
  );

  const load = useCallback(
    async (nextPage: number, replace = false) => {
      if (inFlight.current && !replace) return;

      // abort any previous request
      aborter.current?.abort();
      aborter.current = new AbortController();
      const signal = aborter.current.signal;

      setLoading(true);
      setError(null);
      setPage(nextPage);

      const mySeq = ++seq.current;

      const p = (async () => {
        try {
          const acts = await getActivity(nextPage, pageSize, /* includeComments */ false, signal);
          const hydrated = await hydrate(acts, signal);

          // ignore stale or aborted
          if (!mounted.current || mySeq !== seq.current) return;

          setHasMore(hydrated.length > 0);
          setItems(prev => (replace ? hydrated : mergeAppend(prev, hydrated)));
        } catch (e: any) {
          if (e?.name === 'AbortError') return; // silent on abort
          if (mounted.current && mySeq === seq.current) {
            setError((e as Error).message || 'Failed to load feed.');
          }
        } finally {
          if (mounted.current && mySeq === seq.current) {
            setLoading(false);
            inFlight.current = null;
          }
        }
      })();

      inFlight.current = p;
      await p;
    },
    [pageSize, hydrate, mergeAppend]
  );

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await load(1, true);
    } finally {
      if (mounted.current) setRefreshing(false);
    }
  }, [load]);

  const loadMore = useCallback(async () => {
    if (!loading && hasMore) await load(page + 1);
  }, [loading, hasMore, page, load]);

  // Accurate count refresh for a single activity (background, no UI block)
  const refreshLikeCountFor = useCallback(
    async (id: number) => {
      try {
        const n = await getActivityLikeCount(id, token ?? undefined);
        setItems(prev => prev.map(it => (it.id === id ? { ...it, favorite_count: n } : it)));
      } catch {
        // ignore – stay with optimistic value if count endpoint unavailable
      }
    },
    [token]
  );

  // helpers to update one item immutably
  const patchItem = useCallback((id: number, patch: Partial<HydratedActivity>) => {
    setItems(prev => prev.map(i => (i.id === id ? { ...i, ...patch } : i)));
  }, []);

  const toggleLike = useCallback(
    async (id: number, liked: boolean) => {
      if (toggleBusy.current[id]) return;

      if (!token) {
        setError('Must be logged in to like');
        return;
      }

      toggleBusy.current[id] = true;

      // optimistic UI
      patchItem(id, {
        favorited: !liked,
        favorite_count: undefined as any, // allow calc below
      });
      setItems(prev =>
        prev.map(i =>
          i.id === id
            ? {
                ...i,
                favorited: !liked,
                favorite_count: Math.max(0, (i.favorite_count ?? 0) + (liked ? -1 : 1)),
              }
            : i
        )
      );

      try {
        if (liked) await unfavoriteActivity(id, token);
        else await favoriteActivity(id, token);

        // Re-sync with server truth (don’t block UI)
        refreshLikeCountFor(id).catch(() => {});
      } catch (e) {
        // rollback
        setItems(prev =>
          prev.map(i =>
            i.id === id
              ? {
                  ...i,
                  favorited: liked,
                  favorite_count: Math.max(0, (i.favorite_count ?? 0) + (liked ? 1 : -1)),
                }
              : i
          )
        );
        setError((e as Error).message);
      } finally {
        toggleBusy.current[id] = false;
      }
    },
    [token, refreshLikeCountFor, patchItem]
  );

  // token change: keep public feed (as you intended); or clear if preferred
  useEffect(() => {
    if (!token) {
      setItems(prev => prev);
    }
  }, [token]);

  return useMemo(
    () => ({
      items,
      loading,
      refreshing,
      hasMore,
      page,
      error,
      load,
      refresh,
      loadMore,
      submitStatus: async (text: string) => {
        const body = text.trim();
        if (!body) return;
        if (!token) {
          setError('Must be logged in to post');
          return;
        }
        setError(null);
        try {
          await postActivity(body, token);
          await refresh();
        } catch (e) {
          setError((e as Error).message);
        }
      },
      toggleLike,
    }),
    [items, loading, refreshing, hasMore, page, error, load, refresh, loadMore, toggleLike, token]
  );
}