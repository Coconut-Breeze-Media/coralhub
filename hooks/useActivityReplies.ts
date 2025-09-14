// hooks/useActivityReplies.ts
import { useCallback, useMemo, useRef, useState } from 'react';
import { getActivityReplies, postActivityReply, type BPActivity } from '../lib/api';
import { useAuth } from '../lib/auth';

export function useActivityReplies() {
  const { token } = useAuth();

  const [open, setOpen] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState<Record<number, boolean>>({});
  const [replies, setReplies] = useState<Record<number, BPActivity[]>>({});
  const [drafts, setDrafts] = useState<Record<number, string>>({});
  // ❗ submitErrors are shown in the UI; load errors are only logged
  const [submitErrors, setSubmitErrors] = useState<Record<number, string | undefined>>({});

  const inflight = useRef<Record<number, Promise<void> | undefined>>({});

  const load = useCallback(async (id: number) => {
    if (inflight.current[id] || loading[id]) return;

    const p = (async () => {
      setLoading(prev => ({ ...prev, [id]: true }));
      try {
        const list = await getActivityReplies(id, 1);
        setReplies(prev => ({ ...prev, [id]: list }));
        // do NOT touch submitErrors here
      } catch (e) {
        // Just log; don’t show as a red error under the composer
        console.warn(`[useActivityReplies] load(${id}) failed:`, (e as Error).message);
      } finally {
        setLoading(prev => ({ ...prev, [id]: false }));
        inflight.current[id] = undefined;
      }
    })();

    inflight.current[id] = p;
    await p;
  }, [loading]);

  // Clear any previous submit error when opening; also kick off the load.
  const toggleOpen = useCallback((id: number) => {
    setOpen(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
        setSubmitErrors(prevErr => ({ ...prevErr, [id]: undefined })); // clear stale submit error
        Promise.resolve().then(() => load(id));
      }
      return next;
    });
  }, [load]);

  const setDraft = useCallback((id: number, v: string) => {
    setDrafts(prev => ({ ...prev, [id]: v }));
  }, []);

  const submit = useCallback(async (id: number, override?: string) => {
    if (!token) {
      setSubmitErrors(prev => ({ ...prev, [id]: 'You must be logged in to comment.' }));
      return;
    }
    const text = (override ?? drafts[id] ?? '').trim();
    if (!text) return;

    setSubmitErrors(prev => ({ ...prev, [id]: undefined })); // clear old submit error

    // optimistic clear
    setDraft(id, '');
    try {
      await postActivityReply(id, text, token);
      await load(id);
    } catch (e) {
      setSubmitErrors(prev => ({ ...prev, [id]: (e as Error).message }));
    }
  }, [token, drafts, setDraft, load]);

  return useMemo(() => ({
    isOpen: (id: number) => open.has(id),
    toggleOpen,
    isLoading: (id: number) => !!loading[id],
    getReplies: (id: number) => replies[id] || [],
    getDraft: (id: number) => drafts[id] || '',
    // Only expose submitErrors to the UI
    getError: (id: number) => submitErrors[id],
    setDraft,
    load,
    submit,
  }), [open, loading, replies, drafts, submitErrors, toggleOpen, setDraft, load, submit]);
}