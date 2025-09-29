// hooks/useActivityReplies.ts
import { useCallback, useMemo, useRef, useState, useEffect } from 'react';
import { getActivityReplies, postActivityReply, type BPActivity } from '../lib/api';
import { useAuth } from '../lib/auth';

type IdMap<T> = Record<number, T>;

export function useActivityReplies() {
  const { token } = useAuth();

  const [open, setOpen] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState<IdMap<boolean>>({});
  const [submitting, setSubmitting] = useState<IdMap<boolean>>({});
  const [replies, setReplies] = useState<IdMap<BPActivity[]>>({});
  const [drafts, setDrafts] = useState<IdMap<string>>({});
  const [submitErrors, setSubmitErrors] = useState<IdMap<string | undefined>>({});

  // guards / book-keeping
  const mountedRef = useRef(true);
  const inflight = useRef<IdMap<Promise<void> | undefined>>({});
  const seq = useRef<IdMap<number>>({});
  const aborters = useRef<IdMap<AbortController | undefined>>({}); // one per thread

  useEffect(() => {
    return () => {
      mountedRef.current = false;
      // abort any outstanding thread fetches
      Object.values(aborters.current).forEach(a => a?.abort?.());
    };
  }, []);

  const load = useCallback(
    async (id: number) => {
      if (inflight.current[id] || loading[id]) return;

      // sequence id to ignore stale results
      const mySeq = (seq.current[id] = (seq.current[id] ?? 0) + 1);

      // abort any previous request for this thread
      aborters.current[id]?.abort?.();
      const ac = new AbortController();
      aborters.current[id] = ac;

      const p = (async () => {
        setLoading(prev => ({ ...prev, [id]: true }));
        try {
          const list = await getActivityReplies(id, 1 /* page */, ac.signal);
          if (!mountedRef.current || seq.current[id] !== mySeq) return; // stale/umounted
          setReplies(prev => ({ ...prev, [id]: list }));
        } catch (e: any) {
          // swallow aborts; warn others
          if (e?.name !== 'AbortError') {
            console.warn(`[useActivityReplies] load(${id}) failed:`, (e as Error).message);
          }
        } finally {
          if (!mountedRef.current) return;
          if (seq.current[id] === mySeq) {
            setLoading(prev => ({ ...prev, [id]: false }));
            inflight.current[id] = undefined;
          }
        }
      })();

      inflight.current[id] = p;
      await p;
    },
    [loading]
  );

  const toggleOpen = useCallback(
    (id: number) => {
      setOpen(prev => {
        const next = new Set(prev);
        if (next.has(id)) {
          // closing: abort any inflight read & clear transient state
          next.delete(id);
          aborters.current[id]?.abort?.();
          setSubmitErrors(prevErr => ({ ...prevErr, [id]: undefined }));
          setDrafts(prevDrafts => ({ ...prevDrafts, [id]: '' }));
        } else {
          next.add(id);
          setSubmitErrors(prevErr => ({ ...prevErr, [id]: undefined }));
          // kick off load (don’t await)
          void load(id);
        }
        return next;
      });
    },
    [load]
  );

  const setDraft = useCallback((id: number, v: string) => {
    setDrafts(prev => ({ ...prev, [id]: v }));
  }, []);

  const submit = useCallback(
    async (id: number, override?: string) => {
      if (!token) {
        setSubmitErrors(prev => ({ ...prev, [id]: 'You must be logged in to comment.' }));
        return;
      }
      const text = (override ?? drafts[id] ?? '').trim();
      if (!text) return;

      setSubmitErrors(prev => ({ ...prev, [id]: undefined }));
      setSubmitting(prev => ({ ...prev, [id]: true }));

      // Optimistic append (temporary id; add minimal fields your UI expects)
      const tempId = -Date.now();
      const optimistic: BPActivity = {
        id: tempId,
        user_id: 0,
        component: 'activity',
        type: 'activity_comment',
        date: new Date().toISOString(),
        content: text,
      };

      setReplies(prev => {
        const curr = prev[id] || [];
        return { ...prev, [id]: [optimistic, ...curr] };
      });
      setDraft(id, '');

      try {
        await postActivityReply(id, text, token);
        // Re-sync to swap temp with real and pick up new replies
        await load(id);
      } catch (e) {
        // remove optimistic + restore draft + surface error
        setReplies(prev => {
          const curr = prev[id] || [];
          return { ...prev, [id]: curr.filter(r => r.id !== tempId) };
        });
        setDraft(id, text);
        setSubmitErrors(prev => ({ ...prev, [id]: (e as Error).message }));
      } finally {
        if (mountedRef.current) {
          setSubmitting(prev => ({ ...prev, [id]: false }));
        }
      }
    },
    [token, drafts, setDraft, load]
  );

  return useMemo(
    () => ({
      isOpen: (id: number) => open.has(id),
      toggleOpen,
      isLoading: (id: number) => !!loading[id],
      isSubmitting: (id: number) => !!submitting[id],
      getReplies: (id: number) => replies[id] || [],
      getDraft: (id: number) => drafts[id] || '',
      getError: (id: number) => submitErrors[id],
      setDraft,
      load,
      submit,
    }),
    [open, loading, submitting, replies, drafts, submitErrors, toggleOpen, setDraft, load, submit]
  );
}