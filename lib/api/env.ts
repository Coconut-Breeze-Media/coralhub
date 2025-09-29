/**
 * env.ts
 * -----------------------------------------------------------------------------
 * Purpose
 *  - Centralized environment configuration for API calls.
 *  - Reads from Expo's EXPO_PUBLIC_* variables (safe to expose to client).
 *  - Normalizes URLs (removes trailing slashes).
 *
 * Key exports
 *  - API: WordPress REST API base URL (required).
 *  - WP:  WordPress site URL (optional, used for linking).
 *  - config: object holding all env-based config for future extension.
 * -----------------------------------------------------------------------------
 */

function normalizeUrl(u: string | undefined): string | undefined {
    if (!u) return undefined;
    return u.endsWith('/') ? u.slice(0, -1) : u;
  }
  
  export const API = normalizeUrl(process.env.EXPO_PUBLIC_WP_API);
  export const WP  = normalizeUrl(process.env.EXPO_PUBLIC_WP_URL);
  
  if (!API) {
    throw new Error('Missing EXPO_PUBLIC_WP_API (must be set in app config)');
  }
  if (!WP) {
    console.warn('[env] EXPO_PUBLIC_WP_URL is not set (ok if unused yet)');
  }
  
  export const config = {
    API,
    WP,
    // Add other EXPO_PUBLIC_* vars here if needed
    debug: process.env.EXPO_PUBLIC_DEBUG === 'true',
  };