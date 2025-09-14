import { API } from '../env';
import { fetchWithTimeout, assertOk, ApiError } from '../http';
import { authedFetch } from '../auth';
import type { BPActivity } from '../types';
import { detectBpRoutes } from './routes';

/** Try helper that never throws — returns [] on failure */
async function tryGet<T>(fn: () => Promise<T>): Promise<T | []> {
  try {
    return await fn();
  } catch {
    return [];
  }
}

/** Fallback GET: try several shapes; never throw — return [] if all fail */
async function getRepliesViaActivity(id: number): Promise<BPActivity[]> {
  // 1) Item endpoint
  const r1 = await tryGet(async () => {
    const res = await fetchWithTimeout(`${API}/buddypress/v1/activity/${id}`);
    await assertOk(res);
    const item = await res.json();
    return (item?.comments ?? item?.replies ?? []) as BPActivity[];
  });
  if (Array.isArray(r1) && r1.length) return r1 as BPActivity[];
  
  // 2) Collection + display_comments=threaded
  const r2 = await tryGet(async () => {
    const res = await fetchWithTimeout(
      `${API}/buddypress/v1/activity?include=${id}&display_comments=threaded`
    );
    await assertOk(res);
    const list: any[] = await res.json();
    const item = Array.isArray(list) ? list[0] : null;
    return (item?.comments ?? item?.replies ?? []) as BPActivity[];
  });
  if (Array.isArray(r2) && r2.length) return r2 as BPActivity[];

  // 3) Collection + display_comments=true
  const r3 = await tryGet(async () => {
    const res = await fetchWithTimeout(
      `${API}/buddypress/v1/activity?include=${id}&display_comments=true`
    );
    await assertOk(res);
    const list: any[] = await res.json();
    const item = Array.isArray(list) ? list[0] : null;
    return (item?.comments ?? item?.replies ?? []) as BPActivity[];
  });
  if (Array.isArray(r3) && r3.length) return r3 as BPActivity[];

  // 4) Collection without display_comments as a last resort
  const r4 = await tryGet(async () => {
    const res = await fetchWithTimeout(`${API}/buddypress/v1/activity?include=${id}`);
    await assertOk(res);
    const list: any[] = await res.json();
    const item = Array.isArray(list) ? list[0] : null;
    return (item?.comments ?? item?.replies ?? []) as BPActivity[];
  });
  return (Array.isArray(r4) ? (r4 as BPActivity[]) : []);
}


/** Public GET with detection — never throws; returns [] */
export async function getActivityReplies(id: number, page = 1): Promise<BPActivity[]> {
  const routes = await detectBpRoutes();

  if (!routes.hasBpRepliesGet) {
    return getRepliesViaActivity(id);
  }

  // canonical present → try it, otherwise fall back quietly
  try {
    const res = await fetchWithTimeout(
      `${API}/buddypress/v1/activity/${id}/replies?per_page=20&page=${page}`
    );
    await assertOk(res);
    return res.json();
  } catch {
    return getRepliesViaActivity(id);
  }
}


/** POST a reply with detection + graceful fallbacks */
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

  // Final safety: if nothing was detected (very locked-down stacks), still try the common ones
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

  let lastErr: any;
  for (const fn of attempts) {
    try {
      return await fn();
    } catch (e) {
      lastErr = e;
      // Only keep looping on “route/method not allowed / bad request” type failures
      const status = (e as any)?.status;
      if (!(lastErr instanceof ApiError && [400, 401, 403, 404, 405].includes(status))) break;
    }
  }
  throw lastErr;
}