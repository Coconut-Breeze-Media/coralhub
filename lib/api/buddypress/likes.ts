/**
 * likes.ts
 * -----------------------------------------------------------------------------
 * Purpose
 *  - Fetch the people who liked/favorited a BuddyPress/BuddyBoss activity item
 *    (for avatar strips) AND an accurate total like count (for badges).
 *  - Work across diverse WordPress/BuddyPress/BuddyBoss/custom APIs.
 *  - Be resilient, quick, and UI-friendly (small caps, TTL cache, parallel tries).
 *
 * Key exports
 *  - getActivityLikers(activityId, token?, signal?) => Promise<BPMember[]>  // up to 12
 *  - getActivityLikeCount(activityId, token?, signal?) => Promise<number>
 *
 * Notes
 *  - Likers list is intentionally capped for UI perf (avatars).
 *  - We probe multiple likely routes in PARALLEL and take the first non-empty.
 *  - For counts, we prefer collection totals (headers) when available.
 *  - Gracefully falls back to inspecting the activity object and hydrating IDs.
 *  - GETs are abortable. Writes (if any in the future) should not be aborted.
 * -----------------------------------------------------------------------------
 */

import { assertOk, fetchWithTimeout, getJson } from '../http';
import type { BPMember } from '../types';
import { getMembersByIds } from './activity';
import {
  buildApiUrl,
  normalizeMember,
  uniqById,
  toInt,
} from '../utils';

// === Tunables =================================================
const LIKERS_CAP = 12;           // Max avatars to render per card
const HYDRATE_ID_CAP = 24;       // Limit for getMembersByIds to avoid heavy calls
const LIKERS_TTL_MS = 30_000;    // Cache TTL for liker lists
const COUNT_TTL_MS  = 30_000;    // Cache TTL for counts

// === Local caches =============================================
const likersCache = new Map<number, { at: number; members: BPMember[] }>();
const countCache  = new Map<number, { at: number; count: number }>();

// optional: avoid repeated "no route" logs for the same item
const noRouteLogged = new Set<number>();

// === Internal helpers =========================================

/** GET JSON with optional Bearer token + AbortSignal */
async function authedGetJson<T = any>(
  url: string,
  token?: string,
  signal?: AbortSignal
): Promise<T> {
  const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
  return getJson<T>(url, { headers, signal });
}

/**
 * GET helper (WordPress `_envelope`) to read headers.
 * Returns `{ body, headers }`, where body is the actual response payload.
 */
async function getWithEnvelope(
  url: string,
  token?: string,
  signal?: AbortSignal
): Promise<{ body: any; headers: Record<string, string> }> {
  const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
  // Ensure we don’t create `...?&_envelope`, use URL builder:
  const u = new URL(url);
  u.searchParams.set('_envelope', '1');

  const res = await fetchWithTimeout(u.toString(), { headers, signal });
  await assertOk(res, { url: u.toString(), method: 'GET' });

  const json = await res.json();
  const body = json?.body ?? json;
  const hdrs: Record<string, string> = json?.headers ?? {};
  return { body, headers: hdrs };
}

/** Convert various possible payload shapes to BPMember[] */
function toMembers(json: unknown): BPMember[] {
  if (!json) return [];

  // 1) Already an array of member-like objects
  if (Array.isArray(json)) {
    const arr = json.map(normalizeMember).filter(Boolean) as BPMember[];
    if (arr.length) return arr;
  }

  // 2) Common containers
  const container = (json as any)?.data ?? (json as any)?.items ?? json;

  // 2a) Named arrays often used by different APIs
  const candidates = [
    (container as any)?.users,
    (container as any)?.members,
    (container as any)?.likers,
    (container as any)?.favorites,
    (container as any)?.favourites,
    (container as any)?.likes,
  ].find(Array.isArray);

  if (Array.isArray(candidates)) {
    const arr = candidates.map(normalizeMember).filter(Boolean) as BPMember[];
    if (arr.length) return arr;
  }

  // 3) Raw ID arrays (we prefer to hydrate via getMembersByIds in fallback)
  const ids = Array.isArray((container as any)?.user_ids) ? (container as any).user_ids
           : Array.isArray((container as any)?.ids)      ? (container as any).ids
           : null;
  if (Array.isArray(ids) && ids.length) {
    // If needed we could hydrate here, but we leave to fallback for now.
    return [];
  }

  return [];
}

/** Try a function that returns JSON; convert to BPMember[]; never throw */
async function tryMembers(
  fn: () => Promise<any>
): Promise<BPMember[]> {
  try {
    const json = await fn();
    const arr = toMembers(json);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

// === Counts ====================================================

/**
 * Get total like/favorite count for an activity item.
 * Tries collection headers/fields first, then the activity object, then falls back.
 */
export async function getActivityLikeCount(
  activityId: number,
  token?: string,
  signal?: AbortSignal
): Promise<number> {
  // Cache hit?
  const cached = countCache.get(activityId);
  if (cached && Date.now() - cached.at < COUNT_TTL_MS) return cached.count;

  // Candidate collection endpoints
  const endpoints = [
    buildApiUrl(`/buddypress/v1/activity/${activityId}/favorites`),
    buildApiUrl(`/buddyboss/v1/activity/${activityId}/likes`),
    buildApiUrl(`/buddyboss/v1/activity/${activityId}/favourites`),
    buildApiUrl(`/coral/v1/activity/${activityId}/likers`),
  ];

  // Helper: read X-WP-Total via _envelope=1 on collection endpoints (when supported)
  async function headCount(url: string): Promise<number | null> {
    try {
      const { headers } = await getWithEnvelope(url, token, signal);
      const total = (headers['x-wp-total'] ?? headers['X-WP-Total']) as unknown;
      const n = toInt(total);
      return n == null ? null : n;
    } catch {
      return null;
    }
  }

  // Try each for header total (in sequence; few calls and cheap)
  for (const url of endpoints) {
    const n = await headCount(url);
    if (n != null) {
      countCache.set(activityId, { at: Date.now(), count: n });
      return n;
    }
  }

  // Inspect single activity for explicit counts or arrays
  try {
    const actUrl = buildApiUrl(`/buddypress/v1/activity/${activityId}`);
    const act: any = await authedGetJson(actUrl, token, signal);
    const candidates = [
      act?.favorite_count, act?.favourite_count, act?.likes_count,
      act?.meta?._favorite_count, act?.meta?._favourite_count, act?.meta?._likes_count,
      Array.isArray(act?.favorites) && act.favorites.length,
      Array.isArray(act?.favourites) && act.favourites.length,
      Array.isArray(act?.likes) && act.likes.length,
      Array.isArray(act?.meta?.favorites) && act.meta.favorites.length,
      Array.isArray(act?.meta?.favourites) && act.meta.favourites.length,
      Array.isArray(act?.meta?.likes) && act.meta.likes.length,
    ]
      .map(toInt)
      .filter((v): v is number => v != null);

    if (candidates.length) {
      const n = candidates[0];
      countCache.set(activityId, { at: Date.now(), count: n });
      return n;
    }
  } catch {
    // ignore
  }

  // Last resort: small liker fetch (may undercount due to cap)
  try {
    const likers = await getActivityLikers(activityId, token, signal);
    const n = Array.isArray(likers) ? likers.length : 0;
    countCache.set(activityId, { at: Date.now(), count: n });
    return n;
  } catch {
    countCache.set(activityId, { at: Date.now(), count: 0 });
    return 0;
  }
}

// === Likers (avatars) =========================================

/**
 * Return up to LIKERS_CAP BPMember who liked/favorited this activity item.
 * Strategy
 *  - Fire possible routes in PARALLEL; pick first non-empty result.
 *  - If none return members, fetch the activity item and hydrate IDs.
 *  - Cache results briefly to smooth scrolling.
 */
export async function getActivityLikers(
  activityId: number,
  token?: string,
  signal?: AbortSignal
): Promise<BPMember[]> {
  // Cache hit?
  const cached = likersCache.get(activityId);
  if (cached && Date.now() - cached.at < LIKERS_TTL_MS) return cached.members;

  const bpFavoritesUrl   = buildApiUrl(`/buddypress/v1/activity/${activityId}/favorites`);
  const bbLikesUrl       = buildApiUrl(`/buddyboss/v1/activity/${activityId}/likes`);
  const bbFavouritesUrl  = buildApiUrl(`/buddyboss/v1/activity/${activityId}/favourites`);
  const coralLikersUrl   = buildApiUrl(`/coral/v1/activity/${activityId}/likers`);

  // Build parallel attempts (don’t execute fallback yet)
  const attempts: Array<Promise<{ src: string; members: BPMember[] }>> = [
    tryMembers(() => authedGetJson(bpFavoritesUrl, token, signal))
      .then(m => ({ src: 'bp:favorites',  members: uniqById(m).slice(0, LIKERS_CAP) })),
    tryMembers(() => authedGetJson(bbLikesUrl, token, signal))
      .then(m => ({ src: 'bb:likes',      members: uniqById(m).slice(0, LIKERS_CAP) })),
    tryMembers(() => authedGetJson(bbFavouritesUrl, token, signal))
      .then(m => ({ src: 'bb:favourites', members: uniqById(m).slice(0, LIKERS_CAP) })),
    tryMembers(() => authedGetJson(coralLikersUrl, token, signal))
      .then(m => ({ src: 'coral:likers',  members: uniqById(m).slice(0, LIKERS_CAP) })),
  ];

  const results = await Promise.allSettled(attempts);
  const first = results
    .filter(r => r.status === 'fulfilled')
    .map(r => (r as PromiseFulfilledResult<{ src: string; members: BPMember[] }>).value)
    .find(r => r.members.length);

  if (first?.members?.length) {
    if (__DEV__) console.log('[likes] route:', first.src);
    likersCache.set(activityId, { at: Date.now(), members: first.members });
    return first.members;
  }

  // Fallback: hydrate from activity object (IDs -> members)
  try {
    const actUrl = buildApiUrl(`/buddypress/v1/activity/${activityId}`);
    const act: any = await authedGetJson(actUrl, token, signal);
    const idArrays: unknown[] = [
      act?.favorites,
      act?.favourites,
      act?.likes,
      act?.meta?.favorites,
      act?.meta?.favourites,
      act?.meta?.likes,
    ].filter(Array.isArray) as number[][];

    const ids = Array.from(
      new Set(
        (idArrays.flat() as unknown[])
          .map(Number)
          .filter(n => Number.isFinite(n))
      )
    );

    if (ids.length) {
      // Cap hydration to avoid huge lookups
      const membersById = await getMembersByIds(ids.slice(0, HYDRATE_ID_CAP), signal);
      const list = ids.map(id => membersById[id]).filter(Boolean) as BPMember[];
      const uniq = uniqById(list).slice(0, LIKERS_CAP);
      likersCache.set(activityId, { at: Date.now(), members: uniq });
      if (__DEV__) console.log('[likes] fallback: hydrated from activity meta/arrays');
      return uniq;
    }
  } catch {
    // ignore; fall through to empty
  }

  if (__DEV__) {
    if (!noRouteLogged.has(activityId)) {
      console.log('[likes] no likers route responded with data for', activityId);
      noRouteLogged.add(activityId);
    }
  }

  const empty: BPMember[] = [];
  likersCache.set(activityId, { at: Date.now(), members: empty });
  return empty;
}