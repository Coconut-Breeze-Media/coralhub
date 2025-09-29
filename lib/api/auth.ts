/**
 * auth.ts
 * -----------------------------------------------------------------------------
 * Purpose
 *  - WordPress/JWT auth helpers + authenticated fetch wrappers.
 *  - Supports AbortSignal for reads.
 *  - Optional retry-once refresh flow (if you pass refresh helpers).
 *
 * Key exports
 *  - wpLogin(username, password, signal?) => Promise<JWTPayload>
 *  - coralLogin(username, password) => Promise<{ token, refresh_token, ... }>
 *  - refreshToken(refresh_token) => Promise<{ token, refresh_token }>
 *  - authedFetchRaw(path, token, init?, signal?) => Promise<Response>
 *  - authedFetch<T>(path, token, init?, signal?, refresh?) => Promise<T>
 *      (back-compat: you can omit signal/refresh)
 *  - getMe(token, signal?) => Promise<WPUserMe>
 *  - validateToken(token, signal?) => Promise<boolean>
 * -----------------------------------------------------------------------------
 */

import { API } from './env';
import { assertOk, fetchWithTimeout } from './http';
import type { JWTPayload, WPUserMe } from './types';

/* ────────────────────────────────────────────────────────────────────────────
   Types
──────────────────────────────────────────────────────────────────────────── */

export type RefreshHelpers = {
  /** Return the current refresh token or null if none. */
  getRefresh: () => Promise<string | null> | string | null;
  /** Persist newly issued tokens (called after a successful refresh). */
  saveNewTokens: (t: { token: string; refresh_token: string }) => Promise<void> | void;
};

/* ────────────────────────────────────────────────────────────────────────────
   Helpers
──────────────────────────────────────────────────────────────────────────── */

function buildUrl(path: string) {
  // accepts absolute or API-relative
  return path.startsWith('http') ? path : `${API}${path}`;
}

function withAuthHeaders(token: string, init: RequestInit = {}): RequestInit {
  const baseHeaders: Record<string, string> = {
    Authorization: `Bearer ${token}`,
  };
  const mergedHeaders = {
    ...baseHeaders,
    ...(init.headers as Record<string, string> | undefined),
  };
  return { ...init, headers: mergedHeaders };
}

/** Parse JSON safely only if content-type looks like JSON and body exists. */
async function parseJsonIfAny(res: Response): Promise<any> {
  const ct = (res.headers.get('content-type') || '').toLowerCase();
  if (!ct.includes('application/json')) return null;

  const clone = res.clone();
  const text = await clone.text();
  if (!text) return null;

  try {
    return JSON.parse(text);
  } catch {
    try {
      return await res.json();
    } catch {
      return null;
    }
  }
}

/* ────────────────────────────────────────────────────────────────────────────
   Public API
──────────────────────────────────────────────────────────────────────────── */

export async function wpLogin(
  username: string,
  password: string,
  signal?: AbortSignal
): Promise<JWTPayload> {
  const res = await fetchWithTimeout(buildUrl('/jwt-auth/v1/token'), {
    method: 'POST',
    signal,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  await assertOk(res);
  return res.json() as Promise<JWTPayload>;
}

/** If you added the custom refresh plugin endpoints. */
export async function coralLogin(username: string, password: string) {
  const res = await fetchWithTimeout(buildUrl('/coral-auth/v1/login'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password, label: 'mobile' }),
  });
  await assertOk(res);
  return res.json() as Promise<{
    token: string;
    refresh_token: string;
    user_email: string;
    user_display_name: string;
  }>;
}

export async function refreshToken(refresh_token: string) {
  const res = await fetchWithTimeout(buildUrl('/coral-auth/v1/token/refresh'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh_token }),
  });
  await assertOk(res);
  return res.json() as Promise<{ token: string; refresh_token: string }>;
}

/** Raw authed fetch (returns Response). */
export async function authedFetchRaw(
  path: string,
  token: string,
  init: RequestInit = {},
  signal?: AbortSignal
): Promise<Response> {
  const res = await fetchWithTimeout(buildUrl(path), withAuthHeaders(token, { ...init, signal }));
  await assertOk(res);
  return res;
}

/**
 * Authenticated JSON fetch with optional auto-refresh-on-401.
 *
 * Call shapes supported:
 *   authedFetch(path, token)
 *   authedFetch(path, token, init)
 *   authedFetch(path, token, init, signal)
 *   authedFetch(path, token, init, signal, { getRefresh, saveNewTokens })
 */
export async function authedFetch<T = any>(
  path: string,
  token: string,
  init: RequestInit = {},
  signal?: AbortSignal,
  refresh?: RefreshHelpers
): Promise<T> {
  const doFetch = async (bearer: string) =>
    fetchWithTimeout(buildUrl(path), withAuthHeaders(bearer, { ...init, signal }));

  let res = await doFetch(token);

  // If not 401, succeed or throw normally
  if (res.status !== 401) {
    await assertOk(res);
    const data = await parseJsonIfAny(res);
    return (data as T) ?? (null as unknown as T);
  }

  // 401 → attempt single refresh (if helpers provided)
  if (refresh) {
    const rt = typeof refresh.getRefresh === 'function'
      ? await refresh.getRefresh()
      : null;
    if (rt) {
      const fresh = await refreshToken(rt);
      await refresh.saveNewTokens(fresh);
      res = await doFetch(fresh.token);
      await assertOk(res);
      const data = await parseJsonIfAny(res);
      return (data as T) ?? (null as unknown as T);
    }
  }

  // No refresh available or refresh failed → throw original 401
  await assertOk(res); // will throw ApiError(401)
  const data = await parseJsonIfAny(res);
  return (data as T) ?? (null as unknown as T);
}

export function getMe(token: string, signal?: AbortSignal) {
  return authedFetch<WPUserMe>('/wp/v2/users/me', token, {}, signal);
}

export async function validateToken(token: string, signal?: AbortSignal): Promise<boolean> {
  try {
    const res = await fetchWithTimeout(buildUrl('/jwt-auth/v1/token/validate'), withAuthHeaders(token, { method: 'POST', signal }));
    await assertOk(res);
    return true;
  } catch {
    return false;
  }
}