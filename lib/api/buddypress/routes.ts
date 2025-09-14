// Detect which BuddyPress/BuddyBoss REST routes exist on this server.
import { API } from '../env';
import { fetchWithTimeout, assertOk } from '../http';

export type BpRouteSupport = {
  // GET replies
  hasBpRepliesGet: boolean;          // /buddypress/v1/activity/:id/replies
  // POST comment variants
  hasBpRepliesPost: boolean;         // /buddypress/v1/activity/:id/replies (POST)
  hasBpActivityPost: boolean;        // /buddypress/v1/activity (POST)
  hasBuddyBossCommentPost: boolean;  // /buddyboss/v1/activity/:id/comment (POST)
};

let cached: BpRouteSupport | null = null;
let inFlight: Promise<BpRouteSupport> | null = null;

export async function detectBpRoutes(): Promise<BpRouteSupport> {
  if (cached) return cached;
  if (inFlight) return inFlight;

  inFlight = (async () => {
    // WordPress REST index: `${API}/` (API already ends with /wp-json)
    const res = await fetchWithTimeout(`${API}/`);
    await assertOk(res);
    const idx = await res.json();

    // WP index has a "routes" object like: { "/namespace/route": { endpoints: [...] }, ... }
    const routes: Record<string, any> = idx?.routes ?? {};

    // Helper to find if a route key exists and supports a method (if given)
    const has = (pattern: RegExp, method?: string) => {
      const key = Object.keys(routes).find((k) => pattern.test(k));
      if (!key) return false;
      if (!method) return true;
      const eps = routes[key]?.endpoints;
      if (!Array.isArray(eps)) return false;
      return eps.some((ep: any) =>
        Array.isArray(ep?.methods) && ep.methods.includes(method.toUpperCase())
      );
    };

    const support: BpRouteSupport = {
      hasBpRepliesGet: has(/^\/buddypress\/v1\/activity\/\(\?P<id>.*\)\/replies$/, 'GET'),
      hasBpRepliesPost: has(/^\/buddypress\/v1\/activity\/\(\?P<id>.*\)\/replies$/, 'POST'),
      hasBpActivityPost: has(/^\/buddypress\/v1\/activity$/, 'POST'),
      hasBuddyBossCommentPost: has(/^\/buddyboss\/v1\/activity\/\(\?P<id>.*\)\/comment$/, 'POST'),
    };

    cached = support;
    inFlight = null;
    return support;
  })();

  return inFlight;
}

// Optional: expose a simple getter that returns the cached value synchronously
export function getCachedBpRoutes(): BpRouteSupport | null {
  return cached;
}