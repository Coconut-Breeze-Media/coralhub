/**
 * utils.ts
 * -----------------------------------------------------------------------------
 * Purpose
 *  - Shared utilities for WordPress/BuddyPress API modules.
 *  - Centralize normalization (counts/dates/members), URL building, and helpers.
 *
 * Key exports
 *  - Text/HTML: normalizeWhitespace, stripHtmlLikeText
 *  - Numbers:   coerceCount, toInt
 *  - Dates:     normalizeDate (prefers date_gmt, safe ISO/ts)
 *  - Likes:     getFavCount, getCommentCount, getDidIFavorite
 *  - Members:   normalizeMember, uniqById
 *  - Arrays:    chunk
 *  - URLs:      buildApiUrl(path, params)
 * -----------------------------------------------------------------------------
 */

import { API } from './env';
import type { BPMember } from './types';

/* ──────────────────────────────────
   Text / HTML
────────────────────────────────── */

export function normalizeWhitespace(s: string) {
  return s
    .replace(/\r\n|\r|\n/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function stripHtmlLikeText(raw: string): string {
  return raw?.replace?.(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').trim?.() ?? '';
}

/* ──────────────────────────────────
   Numbers
────────────────────────────────── */

export function coerceCount(v: unknown): number {
  if (typeof v === 'number' && Number.isFinite(v)) return Math.max(0, v);
  if (typeof v === 'string') {
    const n = parseInt(v, 10);
    return Number.isNaN(n) ? 0 : Math.max(0, n);
  }
  return 0;
}

export function toInt(n: unknown): number | null {
  const v = Number(n);
  return Number.isFinite(v) ? v : null;
}

/* ──────────────────────────────────
   Dates
────────────────────────────────── */

export function normalizeDate(a: any) {
  // Prefer GMT (true UTC)
  const rawGmt: string | undefined = a?.date_gmt;
  if (rawGmt) {
    const isoGmt = rawGmt.includes('T') ? `${rawGmt}Z` : `${rawGmt.replace(' ', 'T')}Z`;
    return { dateISO: isoGmt, ts: Date.parse(isoGmt) || 0 };
  }

  // Fallback to `date` without forcing Z
  const raw = a?.date as string | undefined;
  if (!raw) return { dateISO: '', ts: 0 };

  const iso = raw.includes('T') ? raw : raw.replace(' ', 'T');
  return { dateISO: iso, ts: Date.parse(iso) || 0 };
}

/* ──────────────────────────────────
   Like / Comment counts & “did I favorite?”
────────────────────────────────── */

export function getFavCount(a: any): number {
  const direct =
    a?.favorite_count ??
    a?.favorites_count ??
    a?.favourites_count ??
    a?.total_favorites ??
    a?.total_favourites ??
    a?.favs ??
    a?.likes_count ??
    a?.meta?.favorite_count ??
    a?.meta?.favorites ??
    a?.meta?.likes ??
    a?.meta?.total_favorites ??
    a?.meta?.total_favourites;

  if (direct != null) return coerceCount(direct);

  if (Array.isArray(a?.favorites))  return a.favorites.length;
  if (Array.isArray(a?.favourites)) return a.favourites.length;
  if (Array.isArray(a?.likes))      return a.likes.length;

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

export function getCommentCount(a: any): number {
  const v = a?.comment_count ?? a?.comments_count ?? a?.meta?.comment_count;
  if (typeof v === 'number') return Math.max(0, v);
  if (typeof v === 'string') {
    const n = parseInt(v, 10);
    return Number.isNaN(n) ? 0 : Math.max(0, n);
  }
  if (Array.isArray(a?.comments)) return a.comments.length;
  if (Array.isArray(a?.replies))  return a.replies.length;
  return 0;
}

export function getDidIFavorite(a: any): boolean {
  if (typeof a?.favorited === 'boolean')    return a.favorited;
  if (typeof a?.is_favorited === 'boolean') return a.is_favorited;
  if (typeof a?.i_like_this === 'boolean')  return a.i_like_this;

  if (Array.isArray(a?.actions) && a.actions.some((s: unknown) => /unfavou?rite/i.test(String(s)))) {
    return true;
  }

  const meId = a?.meta?.current_user_id;
  if (meId) {
    if (Array.isArray(a?.favorites)  && a.favorites.includes(meId))  return true;
    if (Array.isArray(a?.favourites) && a.favourites.includes(meId)) return true;
    if (Array.isArray(a?.likes)      && a.likes.includes(meId))      return true;
  }
  return false;
}

/* ──────────────────────────────────
   Members
────────────────────────────────── */

export function normalizeMember(m: unknown): BPMember | null {
  if (!m || typeof m !== 'object') return null;
  const obj = m as Record<string, any>;

  const id =
    toInt(obj.id ?? obj.user_id ?? obj.userId ?? obj.ID ?? obj.uid);
  if (id == null) return null;

  const name =
    obj.name ??
    obj.display_name ??
    obj.user_display_name ??
    obj.username ??
    obj.nicename ??
    obj.user_nicename;

  const avatar =
    obj.avatar_url ?? obj.avatar ?? obj.user_avatar ?? obj?.avatars?.full ?? obj?.avatars?.thumb;

  const thumb =
    typeof obj?.avatar_urls?.thumb === 'string'      ? obj.avatar_urls.thumb
    : typeof obj?.avatar_urls?.thumbnail === 'string'? obj.avatar_urls.thumbnail
    : typeof obj?.avatar_urls?.thumbs === 'string'   ? obj.avatar_urls.thumbs
    : typeof avatar === 'string'                     ? avatar
    : undefined;

  const full =
    typeof obj?.avatar_urls?.full === 'string' ? obj.avatar_urls.full
    : typeof obj?.avatar_urls?.large === 'string'? obj.avatar_urls.large
    : typeof avatar === 'string'                ? avatar
    : undefined;

  return {
    id,
    name: name ? String(name) : undefined,
    avatar_urls: thumb || full ? { thumb, full } : undefined,
  };
}

export function uniqById<T extends { id?: number }>(list: T[]): T[] {
  const map = new Map<number, T>();
  for (const m of list) {
    if (m?.id != null) map.set(m.id, m);
  }
  return Array.from(map.values());
}

/* ──────────────────────────────────
   Arrays
────────────────────────────────── */

export function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

/* ──────────────────────────────────
   URLs
────────────────────────────────── */

/**
 * Build an API URL from a path and params against the configured API base.
 * `path` may be absolute (starting with http) or API-relative (starting with /).
 */
export function buildApiUrl(
  path: string,
  params?: Record<string, string | number | boolean | undefined | null>
): string {
  const base = (API as unknown as string) || '';
  const isAbs = /^https?:\/\//i.test(path);
  const u = new URL(isAbs ? path : `${base}${path.startsWith('/') ? '' : '/'}${path}`);
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (v === undefined || v === null) continue;
      u.searchParams.set(k, String(v));
    }
  }
  return u.toString();
}