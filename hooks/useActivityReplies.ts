// hooks/useActivityReplies.ts
import { useCallback, useMemo, useRef, useState } from 'react';
import { getActivityReplies, postActivityReply, type BPActivity } from '../lib/api';
import { useAuth } from '../lib/auth';

export function useActivityReplies() {
  const { token } = useAuth();

  // UI state
  const [open, setOpen] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState<Record<number, boolean>>({});
  const [replies, setReplies] = useState<Record<number, BPActivity[]>>({});
  const [drafts, setDrafts] = useState<Record<number, string>>({});
  const [errors, setErrors] = useState<Record<number, string | undefined>>({});

  // prevent overlapping loads per thread
  const inflight = useRef<Record<number, Promise<void> | undefined>>({});

  const toggleOpen = useCallback((id: number) => {
    setOpen(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }, []);

  const load = useCallback(async (id: number) => {
    if (inflight.current[id] || loading[id]) return;

    const p = (async () => {
      setLoading(prev => ({ ...prev, [id]: true }));
      try {
        const list = await getActivityReplies(id, 1);
        setReplies(prev => ({ ...prev, [id]: list }));
        setErrors(prev => ({ ...prev, [id]: undefined })); // clear error
      } catch (e) {
        setErrors(prev => ({ ...prev, [id]: (e as Error).message }));
      } finally {
        setLoading(prev => ({ ...prev, [id]: false }));
        inflight.current[id] = undefined;
      }
    })();

    inflight.current[id] = p;
    await p;
  }, [loading]);

  const setDraft = useCallback((id: number, v: string) => {
    setDrafts(prev => ({ ...prev, [id]: v }));
  }, []);

  const submit = useCallback(async (id: number, override?: string) => {
    if (!token) throw new Error('Must be logged in to comment');
    const text = (override ?? drafts[id] ?? '').trim();
    if (!text) return;

    // optimistic clear
    setDraft(id, '');
    try {
      await postActivityReply(id, text, token);
      await load(id);
    } catch (e) {
      setErrors(prev => ({ ...prev, [id]: (e as Error).message }));
    }
  }, [token, drafts, setDraft, load]);

  return useMemo(() => ({
    isOpen: (id: number) => open.has(id),
    toggleOpen,
    isLoading: (id: number) => !!loading[id],
    getReplies: (id: number) => replies[id] || [],
    getDraft: (id: number) => drafts[id] || '',
    getError: (id: number) => errors[id], // string | undefined
    setDraft,
    load,
    submit,
  }), [open, loading, replies, drafts, errors, toggleOpen, setDraft, load, submit]);
}