// hooks/useActivityFeed.ts
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  getActivity,
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

  const inFlight = useRef<Promise<void> | null>(null);
  const seq = useRef(0);

  // ✅ NEW: keep server order, just de-dupe by id
  const mergeAppend = useCallback((base: HydratedActivity[], add: HydratedActivity[]) => {
    const seen = new Set(base.map(x => x.id));
    const appended = add.filter(x => !seen.has(x.id));
    return [...base, ...appended];
  }, []);

  const hydrate = useCallback(async (activities: ActivityItem[]): Promise<HydratedActivity[]> => {
    const rawIds = activities.map(a => a.user_id).filter(Boolean) as number[];
    const ids = Array.from(new Set(rawIds));
    const members = ids.length ? await getMembersByIds(ids) : {};
    return activities.map(a => ({ ...a, member: members[a.user_id] }));
  }, []);

  const load = useCallback(
    async (nextPage: number, replace = false) => {
      if (inFlight.current && !replace) return;
      setLoading(true);
      setPage(nextPage);
      const mySeq = ++seq.current;

      const p = (async () => {
        try {
          const acts = await getActivity(nextPage, pageSize);
          const hydrated = await hydrate(acts);

          if (mySeq !== seq.current) return; // ignore stale

          setHasMore(hydrated.length > 0);
          setItems(prev => (replace ? hydrated : mergeAppend(prev, hydrated))); // 👈 use mergeAppend
        } catch (e) {
          console.warn('[useActivityFeed] load failed:', (e as Error).message);
        } finally {
          if (mySeq === seq.current) {
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
      setRefreshing(false);
    }
  }, [load]);

  const loadMore = useCallback(async () => {
    if (!loading && hasMore) await load(page + 1);
  }, [loading, hasMore, page, load]);

  const submitStatus = useCallback(
    async (text: string) => {
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
    [token, refresh]
  );

  const toggleLike = useCallback(
    async (id: number, liked: boolean) => {
      if (!token) {
        setError('Must be logged in to like');
        return;
      }

      // optimistic
      setItems(prev =>
        prev.map(i =>
          i.id === id
            ? { ...i, favorited: !liked, favorite_count: Math.max(0, (i.favorite_count ?? 0) + (liked ? -1 : 1)) }
            : i
        )
      );

      try {
        if (liked) await unfavoriteActivity(id, token);
        else await favoriteActivity(id, token);
      } catch (e) {
        // rollback
        setItems(prev =>
          prev.map(i =>
            i.id === id
              ? { ...i, favorited: liked, favorite_count: Math.max(0, (i.favorite_count ?? 0) + (liked ? 1 : -1)) }
              : i
          )
        );
        setError((e as Error).message);
      }
    },
    [token]
  );

  useEffect(() => {
    if (!token) {
      // keep public feed; change to setItems([]) if you want to clear on logout
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
      submitStatus,
      toggleLike,
    }),
    [items, loading, refreshing, hasMore, page, error, load, refresh, loadMore, submitStatus, toggleLike]
  );
}