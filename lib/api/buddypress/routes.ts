/**
 * routes.ts
 * -----------------------------------------------------------------------------
 * Purpose
 *  - Detect which BuddyPress/BuddyBoss REST routes exist on this server.
 *  - Used by replies.ts (and could be reused for likes in future) to decide
 *    which endpoints to call first.
 *
 * Behavior
 *  - Fetches the WordPress REST index (`${API}/`) once and caches results.
 *  - Returns a BpRouteSupport object with booleans for route/method availability.
 *  - Supports AbortSignal to cancel stale detection requests.
 *  - Provides a sync getter to check cached results without network.
 * -----------------------------------------------------------------------------
 */

import { API } from '../env';
import { fetchWithTimeout, assertOk } from '../http';

export type BpRouteSupport = {
  hasBpRepliesGet: boolean;          // /buddypress/v1/activity/{id}/replies (GET)
  hasBpRepliesPost: boolean;         // /buddypress/v1/activity/{id}/replies (POST)
  hasBpActivityPost: boolean;        // /buddypress/v1/activity (POST)
  hasBuddyBossCommentPost: boolean;  // /buddyboss/v1/activity/{id}/comment (POST)
};

let cached: BpRouteSupport | null = null;
let inFlight: Promise<BpRouteSupport> | null = null;

/**
 * Detect available BuddyPress/BuddyBoss routes by inspecting WP REST index.
 * Caches results for the session. Safe to call multiple times.
 */
export async function detectBpRoutes(signal?: AbortSignal): Promise<BpRouteSupport> {
  if (cached) return cached;
  if (inFlight) return inFlight;

  inFlight = (async () => {
    const res = await fetchWithTimeout(`${API}/`, { signal });
    await assertOk(res, { url: `${API}/`, method: 'GET' });
    const idx = await res.json();

    const routes: Record<string, any> = idx?.routes ?? {};

    const has = (pattern: RegExp, method?: string) => {
      const key = Object.keys(routes).find((k) => pattern.test(k));
      if (!key) return false;
      if (!method) return true;
      const eps = routes[key]?.endpoints;
      if (!Array.isArray(eps)) return false;
      return eps.some(
        (ep: any) => Array.isArray(ep?.methods) && ep.methods.includes(method.toUpperCase())
      );
    };

    const support: BpRouteSupport = {
      hasBpRepliesGet: has(/\/buddypress\/v1\/activity\/[^/]+\/replies$/, 'GET'),
      hasBpRepliesPost: has(/\/buddypress\/v1\/activity\/[^/]+\/replies$/, 'POST'),
      hasBpActivityPost: has(/\/buddypress\/v1\/activity$/, 'POST'),
      hasBuddyBossCommentPost: has(/\/buddyboss\/v1\/activity\/[^/]+\/comment$/, 'POST'),
    };

    if (__DEV__) console.log('[routes] detected BuddyPress routes:', support);

    cached = support;
    inFlight = null;
    return support;
  })();

  return inFlight;
}

/** Return cached value synchronously (null if not detected yet). */
export function getCachedBpRoutes(): BpRouteSupport | null {
  return cached;
}