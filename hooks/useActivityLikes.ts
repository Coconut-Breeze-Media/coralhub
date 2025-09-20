import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  favoriteActivity,
  unfavoriteActivity,
  getActivityLikers,
  type BPMember,
  type ActivityItem,
} from '../lib/api';
import { useAuth } from '../lib/auth';

export type UseActivityLikesOptions = {
  /** Optional list of recent likers to seed the UI */
  initialLikers?: BPMember[];
  /** Current user (for optimistic avatar insert/remove) */
  me?: BPMember | null;
};

export type UseActivityLikesReturn = {
  liked: boolean;
  count: number;
  likers: BPMember[];
  error?: string;
  toggle(): Promise<void>;
  refreshLikers(): Promise<void>;
  summaryText: string;
};

export function useActivityLikes(
  item: Pick<ActivityItem, 'id' | 'favorited' | 'favorite_count'>,
  opts: UseActivityLikesOptions = {}
): UseActivityLikesReturn {
  const { token } = useAuth();

  const [liked, setLiked] = useState<boolean>(!!item.favorited);
  const [count, setCount] = useState<number>(item.favorite_count ?? 0);
  const [likers, setLikers] = useState<BPMember[]>(opts.initialLikers ?? []);
  const [error, setError] = useState<string | undefined>(undefined);

  const inFlightToggle = useRef(false);
  const lastFetchId = useRef(0);

  // Keep state in sync with upstream ActivityItem changes (e.g., refresh)
  useEffect(() => setLiked(!!item.favorited), [item.favorited]);
  useEffect(() => setCount(item.favorite_count ?? 0), [item.favorite_count]);

  // Reset likers when the activity item changes (prevents mixing arrays across posts)
  useEffect(() => {
    setLikers(opts.initialLikers ?? []);
    setError(undefined);
  }, [item.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const me = opts.me ?? null;
  const meId = me?.id;

  /** Optimistically add/remove “me” to the first slot of likers */
  const applyMeOptimistic = useCallback(
    (nextLiked: boolean) => {
      if (!me) return;
      setLikers(prev => {
        const hasMe = prev.some(p => p.id === meId);
        if (nextLiked && !hasMe) return [me, ...prev].slice(0, 6);
        if (!nextLiked && hasMe) return prev.filter(p => p.id !== meId);
        return prev;
      });
    },
    [me, meId]
  );

  /** Fetch likers from the server, if supported. Safe to call anytime. */
  const refreshLikers = useCallback(async () => {
    const fetchId = ++lastFetchId.current;
    try {
      const list = await getActivityLikers(item.id, token ?? undefined);
      // Ignore stale results
      if (fetchId !== lastFetchId.current) return;
      if (Array.isArray(list)) setLikers(list);
      // If server returns *actual* list, prefer that count over our local one
      if (Array.isArray(list) && list.length >= 0) {
        setCount(c => (list.length > 0 ? list.length : c));
      }
    } catch {
      // getActivityLikers is already “no-throw”; nothing to do
    }
  }, [item.id, token]);

  // Initial likers fetch (once per item or token change)
  useEffect(() => {
    let cancel = false;
    (async () => {
      const fid = ++lastFetchId.current;
      try {
        const list = await getActivityLikers(item.id, token ?? undefined);
        if (cancel || fid !== lastFetchId.current) return;
        if (Array.isArray(list)) setLikers(list);
        if (Array.isArray(list) && list.length >= 0) {
          setCount(c => (list.length > 0 ? list.length : c));
        }
      } catch {
        /* ignore */
      }
    })();
    return () => { cancel = true; };
  }, [item.id, token]);

  /** Toggle like/unlike with optimistic UI + rollback on failure */
  const toggle = useCallback(async () => {
    if (inFlightToggle.current) return;

    if (!token) {
      setError('You must be logged in to like posts.');
      return;
    }

    inFlightToggle.current = true;
    setError(undefined);

    const nextLiked = !liked;

    // Optimistic UI
    setLiked(nextLiked);
    setCount(c => Math.max(0, c + (nextLiked ? 1 : -1)));
    applyMeOptimistic(nextLiked);

    try {
      if (nextLiked) {
        await favoriteActivity(item.id, token);
      } else {
        await unfavoriteActivity(item.id, token);
      }

      // Optional: re-sync likers from server (if supported) to avoid drift
      // Don’t block the UI; fire and forget
      refreshLikers().catch(() => {});
    } catch (e) {
      // Rollback
      setLiked(!nextLiked);
      setCount(c => Math.max(0, c + (nextLiked ? -1 : 1)));
      applyMeOptimistic(!nextLiked);
      setError((e as Error).message);
    } finally {
      inFlightToggle.current = false;
    }
  }, [token, liked, item.id, applyMeOptimistic, refreshLikers]);

  /** Human-friendly summary like the website */
  const summaryText = useMemo(() => {
    if (count <= 0) return '';
    const names = likers.map(l => l.name).filter(Boolean) as string[];

    // Prefer “You” if current user liked
    if (me && liked && !names.includes('You')) names.unshift('You');

    const uniq = Array.from(new Set(names));
    if (uniq.length === 0) return count === 1 ? 'liked this' : `${count} people liked this`;
    if (uniq.length === 1) return `${uniq[0]} liked this`;
    if (uniq.length === 2) return `${uniq[0]} and ${uniq[1]} liked this`;
    const others = Math.max(0, count - 2);
    return `${uniq[0]}, ${uniq[1]}${others ? `, and ${others} others` : ''} liked this`;
  }, [count, likers, liked, me]);

  return { liked, count, likers, error, toggle, refreshLikers, summaryText };
}