/**
 * activity.ts
 * -----------------------------------------------------------------------------
 * Purpose
 *  - Fetch and normalize the BuddyPress/BuddyBoss activity feed for the app.
 *  - Provide helpers to create a status and toggle favorites (likes).
 *  - Be resilient to server schema variations (counts/flags spread across fields).
 *
 * Key exports
 *  - getActivity(page?, perPage?, includeComments?, signal?, opts?) => Promise<ActivityItem[]>
 *      Normalizes each item:
 *        • html (sanitized by default), date (ISO), ts (number),
 *        • favorited (did current user like),
 *        • favorite_count, comment_count.
 *      Accepts AbortSignal to cancel in-flight requests.
 *
 *  - postActivity(status, token) => Promise<any>
 *      Creates an activity status (authenticated). Not abortable (side-effects).
 *
 *  - favoriteActivity(id, token) / unfavoriteActivity(id, token) => Promise<any>
 *      Toggles favorite (like) state (authenticated). Not abortable.
 *
 *  - getMembersByIds(ids, signal?) => Promise<Record<number, BPMember>>
 *      Fetches member records in small batches with mild parallelism + cache. Abortable.
 *
 * Behavior & guarantees
 *  - Normalizes like/comment counts from multiple possible fields/arrays.
 *  - Prefers `date_gmt` (true UTC); otherwise uses `date` without forcing Z.
 *  - GETs are abortable; POSTs are not (let server side-effects complete).
 *  - Utilities (counts/dates/member normalization) live in ../utils.
 * -----------------------------------------------------------------------------
 */

import { assertOk, fetchWithTimeout } from '../http';
import { authedFetch } from '../auth';
import type { BPActivity, ActivityItem, BPMember } from '../types';
import { sanitizeBuddyHtml } from './sanitize';
import {
  buildApiUrl,
  normalizeWhitespace,
  normalizeDate,
  getFavCount,
  getCommentCount,
  getDidIFavorite,
  chunk,
} from '../utils';

/* ────────────────────────────────────────────────────────────────────────────
   Activity feed
──────────────────────────────────────────────────────────────────────────── */

type GetActivityOpts = {
  /** If false, skips sanitization (perf/debug). Default true. */
  sanitizeHtml?: boolean;
};

/**
 * Fetch the activity feed and normalize fields (likes, comments, html).
 */
export async function getActivity(
  page = 1,
  perPage = 20,
  includeComments = false,
  signal?: AbortSignal,
  opts: GetActivityOpts = { sanitizeHtml: true }
): Promise<ActivityItem[]> {
  const FEED_TYPES = ['activity_status', 'activity_update'].join(',');
  const url = buildApiUrl('/buddypress/v1/activity', {
    per_page: perPage,
    page,
    type: FEED_TYPES,
    orderby: 'date_recorded',
    order: 'desc',
    display_comments: includeComments ? 'stream' : undefined,
  });

  const res = await fetchWithTimeout(url, { signal });
  await assertOk(res, { url, method: 'GET' });
  const raw: BPActivity[] = await res.json();

  const sanitize = opts.sanitizeHtml ?? true;

  return raw
    .map((a: any) => {
      const rendered = typeof a.content === 'string' ? a.content : (a.content?.rendered ?? '');
      const htmlRaw = sanitize ? sanitizeBuddyHtml(rendered) : rendered;

      // Decide if this item has meaningful content after cleanup
      const textForFilter = normalizeWhitespace(
        htmlRaw.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ')
      );
      const hasContent = textForFilter.length > 0;

      const { dateISO, ts } = normalizeDate(a);

      // Consider promoting `ts` to the ActivityItem type if you rely on it widely.
      const item: ActivityItem & { ts?: number } = {
        id: a.id,
        user_id: a.user_id,
        date: dateISO,
        html: hasContent ? htmlRaw : '',
        favorited: getDidIFavorite(a),
        favorite_count: getFavCount(a),
        comment_count: getCommentCount(a),
        ts,
      };

      return item;
    })
    .filter(item => (item.html ?? '').trim().length > 0);
}

/* ────────────────────────────────────────────────────────────────────────────
   Create + like/unlike
──────────────────────────────────────────────────────────────────────────── */

export function postActivity(status: string, token: string) {
  return authedFetch('/buddypress/v1/activity', token, {
    method: 'POST',
    body: JSON.stringify({ content: status, type: 'activity_update' }),
  });
}

export function favoriteActivity(id: number, token: string) {
  return authedFetch(`/buddypress/v1/activity/${id}/favorite`, token, { method: 'POST' });
}

export function unfavoriteActivity(id: number, token: string) {
  return authedFetch(`/buddypress/v1/activity/${id}/unfavorite`, token, { method: 'POST' });
}

/* ────────────────────────────────────────────────────────────────────────────
   Members (batched + small parallelism + cache)
──────────────────────────────────────────────────────────────────────────── */

const memberCache = new Map<number, BPMember>();

async function fetchMembersBatch(ids: number[], signal?: AbortSignal) {
  const url = buildApiUrl('/buddypress/v1/members', {
    include: ids.join(','),
    per_page: ids.length,
  });
  const res = await fetchWithTimeout(url, { signal });
  await assertOk(res, { url, method: 'GET' });
  return (await res.json()) as BPMember[];
}

/**
 * Fetch member records in batches (more reliable than one giant request).
 * - De-dupes IDs
 * - Skips IDs already in a small in-memory cache
 * - Batches up to 20 per request
 * - Runs up to 3 batches in parallel
 */
export async function getMembersByIds(
  ids: number[],
  signal?: AbortSignal
): Promise<Record<number, BPMember>> {
  if (!ids.length) return {};

  const uniq = Array.from(new Set(ids)).filter(n => Number.isFinite(n));
  const need = uniq.filter(id => !memberCache.has(id));
  if (need.length) {
    const groups = chunk(need, 20);
    const concurrency = Math.min(3, groups.length);
    let i = 0;

    const runners = Array.from({ length: concurrency }).map(async () => {
      while (i < groups.length) {
        const g = groups[i++];
        const list = await fetchMembersBatch(g, signal);
        for (const m of list) memberCache.set(m.id, m);
      }
    });

    await Promise.all(runners);
  }

  const map: Record<number, BPMember> = {};
  for (const id of uniq) {
    const m = memberCache.get(id);
    if (m) map[id] = m;
  }
  return map;
}