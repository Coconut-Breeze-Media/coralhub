import { useCallback, useMemo, useRef, useState } from 'react';
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
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<string|null>(null);

  const inflight = useRef<Promise<void> | null>(null);

  const mergeAndSort = useCallback((base: HydratedActivity[], add: HydratedActivity[]) => {
    const map = new Map<number, HydratedActivity>();
    [...base, ...add].forEach(item => map.set(item.id, item));
    return Array.from(map.values()).sort((a, b) =>
      new Date(b.date).getTime() - new Date(a.date).getTime()
    );
  }, []);

  const load = useCallback(async (nextPage: number, replace = false) => {
    if (inflight.current && !replace) return;
    setLoading(true);
    setPage(nextPage);
    const p = (async () => {
      try {
        const acts = await getActivity(nextPage, pageSize);
        const ids = Array.from(new Set(acts.map(a => a.user_id).filter(Boolean))) as number[];
        const members = await getMembersByIds(ids);
        const hydrated: HydratedActivity[] = acts.map(a => ({ ...a, member: members[a.user_id] }));
        setHasMore(hydrated.length > 0);
        setItems(prev => (replace ? hydrated : mergeAndSort(prev, hydrated)));
        setError(null);
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setLoading(false);
        inflight.current = null;
      }
    })();
    inflight.current = p;
    await p;
  }, [pageSize, mergeAndSort]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try { await load(1, true); } finally { setRefreshing(false); }
  }, [load]);

  const loadMore = useCallback(async () => {
    if (hasMore && !loading) await load(page + 1);
  }, [hasMore, loading, page, load]);

  const submitStatus = useCallback(async (text: string) => {
    const body = text.trim();
    if (!body) return;
    if (!token) throw new Error("Must be logged in to post");
    await postActivity(body, token);
    await refresh();
  }, [token, refresh]);

  const toggleLike = useCallback(async (id: number, liked: boolean) => {
    if (!token) throw new Error("Must be logged in to like");
    setItems(prev =>
      prev.map(i =>
        i.id === id
          ? { ...i, favorited: !liked, favorite_count: (i.favorite_count ?? 0) + (liked ? -1 : 1) }
          : i
      )
    );
    try {
      if (liked) await unfavoriteActivity(id, token);
      else await favoriteActivity(id, token);
    } catch {
      // rollback
      setItems(prev =>
        prev.map(i =>
          i.id === id
            ? { ...i, favorited: liked, favorite_count: (i.favorite_count ?? 0) + (liked ? 1 : -1) }
            : i
        )
      );
    }
  }, [token]);

  return useMemo(() => ({
    items, loading, refreshing, hasMore, page, error,
    load, refresh, loadMore, submitStatus, toggleLike,
  }), [items, loading, refreshing, hasMore, page, error, load, refresh, loadMore, submitStatus, toggleLike]);
}