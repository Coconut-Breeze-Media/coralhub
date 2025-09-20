// lib/api/buddypress/activity.ts

import { API } from '../env';
import { assertOk, fetchWithTimeout } from '../http';
import { authedFetch } from '../auth';
import type { BPActivity, ActivityItem, BPMember } from '../types';
import { sanitizeBuddyHtml } from './sanitize';

/** Collapse whitespace so we can drop empty/garbage items safely */
function normalizeWhitespace(s: string) {
  return s
    .replace(/\r\n|\r|\n/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** Safer numeric coercion */
function coerceCount(v: unknown): number {
  if (typeof v === 'number') return Math.max(0, v);
  if (typeof v === 'string') {
    const n = parseInt(v, 10);
    return Number.isNaN(n) ? 0 : Math.max(0, n);
  }
  return 0;
}

/** Extract a normalized like count */
function getFavCount(a: any): number {
  const direct =
    a.favorite_count ??
    a.favorites_count ??
    a.favourites_count ??
    a.total_favorites ??
    a.total_favourites ??
    a.favs ??
    a.likes_count ??
    a?.meta?.favorite_count ??
    a?.meta?.favorites ??
    a?.meta?.likes ??
    a?.meta?.total_favorites ??
    a?.meta?.total_favourites;

  if (direct != null) return coerceCount(direct);

  // Arrays of user ids
  if (Array.isArray(a.favorites))   return a.favorites.length;
  if (Array.isArray(a.favourites))  return a.favourites.length;
  if (Array.isArray(a.likes))       return a.likes.length;

  // Last-resort scan for numeric-ish “like/fav … count” keys
  const scan = (obj: any) => {
    if (!obj || typeof obj !== 'object') return 0;
    let best = 0;
    for (const [k, v] of Object.entries(obj)) {
      const lk = k.toLowerCase();
      if ((lk.includes('fav') || lk.includes('like')) && lk.includes('count')) {
        best = Math.max(best, coerceCount(v));
      }
    }
    return best;
  };
  return Math.max(scan(a), scan(a?.meta));
}

/** Determine if the current user has liked the item */
function getDidIFavorite(a: any): boolean {
  if (typeof a.favorited === 'boolean')     return a.favorited;
  if (typeof a.is_favorited === 'boolean')  return a.is_favorited;
  if (typeof a.i_like_this === 'boolean')   return a.i_like_this;

  // “Unfavorite” action present → already liked
  if (Array.isArray(a.actions) && a.actions.some((s: unknown) => /unfavou?rite/i.test(String(s)))) {
    return true;
  }

  // If payload exposes current user id + arrays
  const meId = a?.meta?.current_user_id;
  if (meId) {
    if (Array.isArray(a.favorites)  && a.favorites.includes(meId))  return true;
    if (Array.isArray(a.favourites) && a.favourites.includes(meId)) return true;
    if (Array.isArray(a.likes)      && a.likes.includes(meId))      return true;
  }
  return false;
}

/** Extract a normalized comment count */
function getCommentCount(a: any): number {
  const v = a.comment_count ?? a.comments_count ?? a?.meta?.comment_count;
  if (typeof v === 'number') return Math.max(0, v);
  if (typeof v === 'string') {
    const n = parseInt(v, 10);
    return Number.isNaN(n) ? 0 : Math.max(0, n);
  }
  // Some stacks return replies array on the root item
  if (Array.isArray(a.comments)) return a.comments.length;
  if (Array.isArray(a.replies)) return a.replies.length;
  return 0;
}

/** Fetch the activity feed and normalize fields (likes, comments, html) */

function normalizeDate(a: any) {
  // Prefer GMT if present
  const raw = a.date_gmt || a.date;
  if (!raw) return { dateISO: '', ts: 0 };

  // Accept both “YYYY-MM-DDTHH:mm:ss” and “YYYY-MM-DD HH:mm:ss”
  const iso = raw.includes('T') ? raw : `${raw.replace(' ', 'T')}Z`;
  const ts = Date.parse(iso) || 0;
  return { dateISO: iso, ts };
}

export async function getActivity(page = 1, perPage = 20, includeComments = false) {
  const FEED_TYPES = ['activity_status', 'activity_update'].join(',');
  let url =
    `${API}/buddypress/v1/activity?per_page=${perPage}` +
    `&page=${page}&type=${FEED_TYPES}&orderby=date_recorded&order=desc`;
  if (includeComments) url += `&display_comments=stream`;

  const res = await fetchWithTimeout(url);
  await assertOk(res);
  const raw: BPActivity[] = await res.json();

  return raw
    .map((a: any) => {
      const rendered = typeof a.content === 'string' ? a.content : (a.content?.rendered ?? '');
      const html = sanitizeBuddyHtml(rendered);
      const textForFilter = normalizeWhitespace(html.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' '));
      const hasContent = textForFilter.length > 0;

      const { dateISO, ts } = normalizeDate(a);

      return {
        id: a.id,
        user_id: a.user_id,
        date: dateISO,        // standardized ISO
        ts,                   // numeric for reliable sort
        html: hasContent ? html : '',
        favorited: getDidIFavorite(a),
        favorite_count: getFavCount(a),
        comment_count: getCommentCount(a),
      } as any; // (Extend ActivityItem to include `ts` if you can)
    })
    .filter(item => item.html.trim().length > 0);
}

/** Create a new status */
export function postActivity(status: string, token: string) {
  return authedFetch('/buddypress/v1/activity', token, {
    method: 'POST',
    body: JSON.stringify({ content: status, type: 'activity_update' }),
  });
}

/** Favorite / Unfavorite
 *  Note: some stacks implement DELETE on the same endpoint for “unfavorite”.
 *  If your server 404/405s on `/unfavorite`, consider switching to:
 *    authedFetch(`/buddypress/v1/activity/${id}/favorite`, token, { method: 'DELETE' })
 */
export function favoriteActivity(id: number, token: string) {
  return authedFetch(`/buddypress/v1/activity/${id}/favorite`, token, { method: 'POST' });
}
export function unfavoriteActivity(id: number, token: string) {
  return authedFetch(`/buddypress/v1/activity/${id}/unfavorite`, token, { method: 'POST' });
}

/** Utility: chunk requests */
function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

/** Fetch member records in batches (more reliable than one giant request) */
export async function getMembersByIds(ids: number[]): Promise<Record<number, BPMember>> {
  if (!ids.length) return {};
  const uniq = Array.from(new Set(ids));
  const groups = chunk(uniq, 20); // many BP installs default per_page=20
  const map: Record<number, BPMember> = {};

  for (const g of groups) {
    const res = await fetchWithTimeout(
      `${API}/buddypress/v1/members?include=${g.join(',')}&per_page=${g.length}`
    );
    await assertOk(res);
    const list: BPMember[] = await res.json();
    for (const m of list) map[m.id] = m;
  }
  return map;
}