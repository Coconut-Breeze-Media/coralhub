/**
 * replies.ts
 * -----------------------------------------------------------------------------
 * Purpose
 *  - Read and write activity **replies/comments** across BuddyPress/BuddyBoss
 *    installs that expose different REST shapes.
 *  - Be resilient: read paths never throw (return []), write paths try multiple
 *    endpoints until one succeeds.
 *  - Support **AbortSignal** on reads so the UI can cancel stale requests.
 *
 * Key exports
 *  - getActivityReplies(id, page?, signal?) => Promise<BPActivity[]>
 *      Reads replies for an activity. Uses the canonical
 *      /buddypress/v1/activity/{id}/replies route when available; otherwise
 *      falls back to parsing replies from several activity GET variants.
 *      Never throws; returns [] on failure. Accepts optional AbortSignal.
 *
 *  - postActivityReply(id, content, token) => Promise<any>
 *      Posts a reply using whichever route the server supports. Attempts (in order):
 *        1) POST /buddypress/v1/activity/{id}/replies  (content or content_raw)
 *        2) POST /buddypress/v1/activity (type=activity_comment, parent/activity_id)
 *        3) POST /buddyboss/v1/activity/{id}/comment
 *      Throws on irrecoverable error. (Writes are not aborted.)
 *
 * Behavior & Guarantees
 *  - Reads:
 *      • Non-crashing: catch-all fallbacks, [] on failure.
 *      • Abortable: pass AbortSignal to cancel in-flight requests.
 *      • Compatible: handles sites exposing comments as `comments` or `replies`.
 *  - Writes:
 *      • Authenticated via `authedFetch` (Bearer token).
 *      • Tries multiple shapes; stops at first success.
 *      • Only continues on expected 4xx “route not allowed / bad request” cases.
 * -----------------------------------------------------------------------------
 */

import { fetchWithTimeout, assertOk, ApiError, getJson } from '../http';
import { authedFetch } from '../auth';
import type { BPActivity } from '../types';
import { detectBpRoutes } from './routes';
import { buildApiUrl } from '../utils';

/* ──────────────────────────────────
   Internal helpers (reads)
────────────────────────────────── */

/** Best-effort GET that never throws; returns [] on failure. */
async function safeGetReplies(url: string, signal?: AbortSignal): Promise<BPActivity[]> {
  try {
    const res = await fetchWithTimeout(url, { signal });
    await assertOk(res, { url, method: 'GET' });
    const json = await res.json();
    // Canonical route returns an array; fallbacks may return an item or array.
    if (Array.isArray(json)) return json as BPActivity[];
    if (json && typeof json === 'object') {
      const item = json as any;
      if (Array.isArray(item.comments)) return item.comments as BPActivity[];
      if (Array.isArray(item.replies))  return item.replies  as BPActivity[];
    }
    return [];
  } catch {
    return [];
  }
}

/**
 * Fallback GET: try several shapes that embed replies on activity items.
 * Never throws — returns [] if all fail.
 */
async function getRepliesViaActivity(id: number, signal?: AbortSignal): Promise<BPActivity[]> {
  // 1) Single item endpoint (comments/replies may be embedded)
  {
    const url = buildApiUrl(`/buddypress/v1/activity/${id}`);
    const list = await safeGetReplies(url, signal);
    if (Array.isArray(list) && list.length) return list;
  }

  // 2) Collection + display_comments=threaded
  {
    const url = buildApiUrl('/buddypress/v1/activity', {
      include: id,
      display_comments: 'threaded',
    });
    const list = await safeGetReplies(url, signal);
    if (Array.isArray(list) && list.length) return list;
  }

  // 3) Collection + display_comments=true
  {
    const url = buildApiUrl('/buddypress/v1/activity', {
      include: id,
      display_comments: 'true',
    });
    const list = await safeGetReplies(url, signal);
    if (Array.isArray(list) && list.length) return list;
  }

  // 4) Collection without display_comments as a last resort
  {
    const url = buildApiUrl('/buddypress/v1/activity', { include: id });
    const list = await safeGetReplies(url, signal);
    return Array.isArray(list) ? list : [];
  }
}

/* ──────────────────────────────────
   Public API
────────────────────────────────── */

/** Public GET with detection — never throws; returns []. */
export async function getActivityReplies(
  id: number,
  page = 1,
  signal?: AbortSignal
): Promise<BPActivity[]> {
  // If detectBpRoutes does network, consider adding a signal there later.
  const routes = await detectBpRoutes();

  // If canonical route is not present, fall back to activity parsing
  if (!routes.hasBpRepliesGet) {
    return getRepliesViaActivity(id, signal);
  }

  // Canonical present → try it, otherwise fall back quietly
  const url = buildApiUrl(`/buddypress/v1/activity/${id}/replies`, {
    per_page: 20,
    page,
  });

  try {
    // This route returns an array; use getJson for brevity
    return await getJson<BPActivity[]>(url, { signal });
  } catch {
    return getRepliesViaActivity(id, signal);
  }
}

/** POST a reply with detection + graceful fallbacks. */
export async function postActivityReply(id: number, content: string, token: string) {
  const routes = await detectBpRoutes();

  // Preferred order based on what the server claims to support:
  const attempts: Array<() => Promise<any>> = [];

  if (routes.hasBpRepliesPost) {
    attempts.push(() =>
      authedFetch(`/buddypress/v1/activity/${id}/replies`, token, {
        method: 'POST',
        body: JSON.stringify({ content }),
      })
    );
    // Some stacks expect content_raw
    attempts.push(() =>
      authedFetch(`/buddypress/v1/activity/${id}/replies`, token, {
        method: 'POST',
        body: JSON.stringify({ content_raw: content }),
      })
    );
  }

  if (routes.hasBpActivityPost) {
    attempts.push(() =>
      authedFetch(`/buddypress/v1/activity`, token, {
        method: 'POST',
        body: JSON.stringify({ content, type: 'activity_comment', parent: id }),
      })
    );
    attempts.push(() =>
      authedFetch(`/buddypress/v1/activity`, token, {
        method: 'POST',
        body: JSON.stringify({ content, type: 'activity_comment', activity_id: id }),
      })
    );
  }

  if (routes.hasBuddyBossCommentPost) {
    attempts.push(() =>
      authedFetch(`/buddyboss/v1/activity/${id}/comment`, token, {
        method: 'POST',
        body: JSON.stringify({ content }),
      })
    );
  }

  // Final safety: if nothing was detected, still try the common ones
  if (attempts.length === 0) {
    attempts.push(
      () =>
        authedFetch(`/buddypress/v1/activity/${id}/replies`, token, {
          method: 'POST',
          body: JSON.stringify({ content }),
        }),
      () =>
        authedFetch(`/buddypress/v1/activity`, token, {
          method: 'POST',
          body: JSON.stringify({ content, type: 'activity_comment', parent: id }),
        }),
      () =>
        authedFetch(`/buddyboss/v1/activity/${id}/comment`, token, {
          method: 'POST',
          body: JSON.stringify({ content }),
        })
    );
  }

  // Execute attempts; keep retrying only for "expected" 4xx route-shape failures.
  let lastErr: any;
  for (const fn of attempts) {
    try {
      return await fn();
    } catch (e) {
      lastErr = e;
      const status = (e as any)?.status;
      const recoverable =
        lastErr instanceof ApiError && [400, 401, 403, 404, 405].includes(status);
      if (!recoverable) break;
    }
  }
  throw lastErr;
}