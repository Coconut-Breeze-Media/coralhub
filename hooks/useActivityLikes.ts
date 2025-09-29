// hooks/useActivityLikes.ts
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  favoriteActivity,
  unfavoriteActivity,
  getActivityLikers,
  getActivityLikeCount,
  type BPMember,
  type ActivityItem,
} from '../lib/api';
import { useAuth } from '../lib/auth';

const AVATAR_CAP = 12;

export type UseActivityLikesOptions = {
  initialLikers?: BPMember[];
  me?: BPMember | null;
};

export type UseActivityLikesReturn = {
  liked: boolean;
  count: number;
  likers: BPMember[];
  error?: string;
  toggle(): Promise<void>;
  refreshLikers(): Promise<void>;
  refreshCount(): Promise<void>;
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

  // lifecycle / race guards
  const mountedRef = useRef(true);
  useEffect(() => () => { mountedRef.current = false; }, []);

  // in-flight guards
  const inFlightToggle = useRef(false);
  const likersAbortRef = useRef<AbortController | null>(null);
  const countAbortRef = useRef<AbortController | null>(null);

  // keep in sync with upstream refreshes
  useEffect(() => setLiked(!!item.favorited), [item.favorited]);
  useEffect(() => setCount(item.favorite_count ?? 0), [item.favorite_count]);

  // ✅ FIX: only seed likers when the ACTIVITY changes
  const lastSeededForId = useRef<number | null>(null);
  useEffect(() => {
    if (lastSeededForId.current !== item.id) {
      lastSeededForId.current = item.id;
      setLikers(opts.initialLikers ?? []);
      setError(undefined);
    }
    // NOTE: deliberately NOT depending on opts.initialLikers identity
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item.id]);

  const me = opts.me ?? null;
  const meId = me?.id;

  const applyMeOptimistic = useCallback(
    (nextLiked: boolean) => {
      if (!me) return;
      setLikers(prev => {
        const hasMe = prev.some(p => p.id === meId);
        if (nextLiked && !hasMe) return [me, ...prev].slice(0, AVATAR_CAP);
        if (!nextLiked && hasMe) return prev.filter(p => p.id !== meId);
        return prev;
      });
    },
    [me, meId]
  );

  const abortAndSet = (ref: React.MutableRefObject<AbortController | null>) => {
    ref.current?.abort();
    const ctrl = new AbortController();
    ref.current = ctrl;
    return ctrl;
  };

  const refreshCount = useCallback(async () => {
    const ctrl = abortAndSet(countAbortRef);
    try {
      const n = await getActivityLikeCount(item.id, token ?? undefined);
      if (!mountedRef.current || ctrl.signal.aborted) return;
      setCount(n);
    } catch {
      /* ignore */
    }
  }, [item.id, token]);

  const refreshLikers = useCallback(async () => {
    const ctrl = abortAndSet(likersAbortRef);
    try {
      const list = await getActivityLikers(item.id, token ?? undefined);
      if (!mountedRef.current || ctrl.signal.aborted) return;
      if (Array.isArray(list)) setLikers(list);
    } catch {
      /* ignore */
    }
  }, [item.id, token]);

  // initial fetch: do both in parallel (on id change)
  useEffect(() => {
    refreshLikers();
    refreshCount();
    return () => {
      likersAbortRef.current?.abort();
      countAbortRef.current?.abort();
    };
  }, [refreshLikers, refreshCount]);

  const toggle = useCallback(async () => {
    if (inFlightToggle.current) return;

    if (!token) {
      setError('You must be logged in to like posts.');
      return;
    }

    inFlightToggle.current = true;
    setError(undefined);

    const nextLiked = !liked;

    // optimistic UI
    setLiked(nextLiked);
    setCount(c => Math.max(0, c + (nextLiked ? 1 : -1)));
    applyMeOptimistic(nextLiked);

    try {
      if (nextLiked) await favoriteActivity(item.id, token);
      else await unfavoriteActivity(item.id, token);

      void refreshLikers();
      void refreshCount();
    } catch (e) {
      // rollback
      setLiked(!nextLiked);
      setCount(c => Math.max(0, c + (nextLiked ? -1 : 1)));
      applyMeOptimistic(!nextLiked);
      setError((e as Error).message);
    } finally {
      inFlightToggle.current = false;
    }
  }, [token, liked, item.id, applyMeOptimistic, refreshLikers, refreshCount]);

  const summaryText = useMemo(() => {
    if (count <= 0) return '';
    const names = (likers || []).map(l => l.name).filter(Boolean) as string[];
    if (me && liked && !names.includes('You')) names.unshift('You');
    const uniq = Array.from(new Set(names));
    if (uniq.length === 0) return count === 1 ? 'liked this' : `${count} people liked this`;
    if (uniq.length === 1) return `${uniq[0]} liked this`;
    if (uniq.length === 2) return `${uniq[0]} and ${uniq[1]} liked this`;
    const others = Math.max(0, count - 2);
    return `${uniq[0]}, ${uniq[1]}${others ? `, and ${others} others` : ''} liked this`;
  }, [count, likers, liked, me]);

  return { liked, count, likers, error, toggle, refreshLikers, refreshCount, summaryText };
}