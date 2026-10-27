// lib/api.ts
import { Platform } from 'react-native';
import type {
  JWTPayload,
  TokenRefreshPayload,
  MembershipResponse,
  PremiumResource,
  WPPage,
  WPPost,
  WPUser,
  MembershipLevel,
  BPMember,
  UpdateMemberPayload,
  BPAvatar,
  BPCoverImage,
  XProfileFieldData,
  UpdateXProfilePayload,
  BPActivity,
  BPConversationsResponse,
  BPConversationSummary,
  BPMessageThreadResult,
  BPMessageMutationResponse,
  BPMessageDeleteResponse,
} from '../types';
import { encodeMessageForTransport } from './messagePresentation';
import { convertToJPEG } from './imageHelpers';
import { API_BASE_URL, SITE_URL } from './config';
import { createTokenRefreshCoordinator, isRefreshExemptPath, replacementBearer } from './tokenRefresh';

// Re-export so callers can `import { MembershipLevel } from '../lib/api'`.
export type { MembershipLevel, MembershipResponse, PremiumResource } from '../types';

const API = API_BASE_URL;
const WP = SITE_URL;

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

// ---------- helpers ----------
function stripHtml(raw: string): string {
  return raw?.replace?.(/<[^>]+>/g, '').trim?.() ?? '';
}

async function assertOk(res: Response) {
  if (res.ok) return res;

  // Read from a clone so the original response body remains readable
  const copy = res.clone();
  let msg = `HTTP ${res.status}`;

  try {
    const data = await copy.json();
    const raw = data?.message ?? data?.error ?? JSON.stringify(data);
    msg = stripHtml(String(raw));
  } catch {
    try {
      const text = await copy.text();
      msg = stripHtml(String(text));
    } catch {
      // ignore; keep default msg
    }
  }

  throw new ApiError(msg, res.status);
}

type SessionTokens = { token: string; refreshToken: string };

let readRefreshToken: () => string | null = () => null;
let publishSession: (next: SessionTokens | null) => void = () => {};
let accessRefreshInFlight: Promise<string | null> | null = null;

/**
 * AuthProvider registers the live refresh token and a callback that persists
 * a rotated pair (or clears the session when the refresh token itself is rejected).
 * authedFetch and every other bearer request share this so a mid-session 401
 * refreshes once and retries, instead of failing every screen until relaunch.
 */
export function registerAuthSession(handlers: {
  getRefreshToken: () => string | null;
  onSessionChange: (next: SessionTokens | null) => void;
}) {
  readRefreshToken = handlers.getRefreshToken;
  publishSession = handlers.onSessionChange;
}

function requestUrl(input: RequestInfo | URL): string {
  if (typeof input === 'string') return input;
  if (input instanceof URL) return input.toString();
  return input.url;
}

function isAuthExemptUrl(input: RequestInfo | URL): boolean {
  return isRefreshExemptPath(requestUrl(input));
}

function bearerFrom(init?: RequestInit): string | null {
  if (!init?.headers) return null;
  const value = new Headers(init.headers).get('Authorization');
  if (!value?.toLowerCase().startsWith('bearer ')) return null;
  return value.slice(7).trim();
}

function withBearer(init: RequestInit | undefined, token: string): RequestInit {
  const headers = new Headers(init?.headers);
  headers.set('Authorization', `Bearer ${token}`);
  return { ...init, headers };
}

async function refreshAccessToken(): Promise<string | null> {
  if (accessRefreshInFlight) return accessRefreshInFlight;

  const current = readRefreshToken();
  if (!current) return null;

  accessRefreshInFlight = (async () => {
    try {
      const refreshed = await refreshCoralToken(current);
      const refreshToken = refreshed.refresh_token ?? current;
      publishSession({ token: refreshed.token, refreshToken });
      return refreshed.token;
    } catch (error) {
      if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
        publishSession(null);
      }
      return null;
    } finally {
      accessRefreshInFlight = null;
    }
  })();

  return accessRefreshInFlight;
}

/**
 * True when a native FormData body carries React Native's `{ uri, name, type }`
 * file parts. Expo's WinterCG `fetch` (the global `fetch` since Expo SDK 52+)
 * cannot serialise those parts and throws "Unsupported FormDataPart
 * implementation", so such uploads must go through XMLHttpRequest instead,
 * which streams `uri` parts natively on iOS and Android.
 */
function hasNativeFileParts(body: unknown): boolean {
  if (Platform.OS === 'web' || !body || typeof body !== 'object') return false;
  const parts = (body as { _parts?: unknown })._parts;
  if (!Array.isArray(parts)) return false;
  return parts.some((part) => {
    const value = Array.isArray(part) ? part[1] : null;
    return Boolean(value && typeof value === 'object' && typeof (value as { uri?: unknown }).uri === 'string');
  });
}

function abortError(): Error {
  const error = new Error('Aborted');
  error.name = 'AbortError';
  return error;
}

/** Minimal fetch-compatible multipart upload over React Native's XMLHttpRequest. */
function xhrFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open(init.method || 'POST', requestUrl(input));

    // Never set Content-Type: XHR adds multipart/form-data with the boundary.
    new Headers(init.headers).forEach((value, key) => {
      if (key.toLowerCase() !== 'content-type') xhr.setRequestHeader(key, value);
    });

    const signal = init.signal;
    const onAbort = () => xhr.abort();
    if (signal) {
      if (signal.aborted) {
        reject(abortError());
        return;
      }
      signal.addEventListener('abort', onAbort);
    }
    const cleanup = () => signal?.removeEventListener('abort', onAbort);

    xhr.onload = () => {
      cleanup();
      const headers = new Headers();
      (xhr.getAllResponseHeaders() || '')
        .trim()
        .split(/[\r\n]+/)
        .forEach((line) => {
          const index = line.indexOf(':');
          if (index > 0) headers.append(line.slice(0, index).trim(), line.slice(index + 1).trim());
        });
      const status = xhr.status >= 200 && xhr.status <= 599 ? xhr.status : 500;
      const bodyText = status === 204 || status === 205 ? null : xhr.responseText;
      resolve(new Response(bodyText, { status, headers }));
    };
    xhr.onerror = () => {
      cleanup();
      reject(new TypeError('Network request failed'));
    };
    xhr.ontimeout = () => {
      cleanup();
      reject(new TypeError('Network request timed out'));
    };
    xhr.onabort = () => {
      cleanup();
      reject(abortError());
    };

    xhr.send(init.body as XMLHttpRequestBodyInit);
  });
}

const UPLOADABLE_IMAGE_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'gif']);

/**
 * On native, convert images whose extension is not JPEG/PNG/GIF (e.g. HEIC
 * from iOS, or extension-less content:// URIs on Android) to a local JPEG so
 * the BuddyPress / WordPress upload handlers accept the file type.
 */
async function ensureUploadableImageUri(imageUri: string): Promise<string> {
  if (Platform.OS === 'web' || imageUri.startsWith('blob:') || imageUri.startsWith('data:')) {
    return imageUri;
  }
  const lastSegment = imageUri.split(/[?#]/)[0].split('/').pop() || '';
  const extension = lastSegment.includes('.') ? lastSegment.split('.').pop()!.toLowerCase() : '';
  if (UPLOADABLE_IMAGE_EXTENSIONS.has(extension)) return imageUri;
  return convertToJPEG(imageUri, 0.85);
}

function fetchWithTimeout(input: RequestInfo | URL, init?: RequestInit, ms = 15000) {
  const exec = (nextInit?: RequestInit) => {
    const ctrl = new AbortController();
    const id = setTimeout(() => ctrl.abort(), ms);
    if (hasNativeFileParts(nextInit?.body)) {
      return xhrFetch(input, { ...nextInit, signal: ctrl.signal }).finally(() => clearTimeout(id));
    }
    // The WP host sends long-lived Cache-Control headers on some REST responses
    // (e.g. `public, max-age=604800`). Without this, the device's own HTTP cache
    // can silently serve a stale response for up to a week, so force every
    // request to hit the network and ignore any cached copy.
    return fetch(input, { cache: 'no-store', ...nextInit, signal: ctrl.signal }).finally(() =>
      clearTimeout(id)
    );
  };

  const bearer = bearerFrom(init);
  return exec(init).then(async (res) => {
    // Login, validate, and refresh must not recurse into another refresh.
    if (isAuthExemptUrl(input) || res.status !== 401 || !bearer) return res;
    const next = await refreshAccessToken();
    if (!replacementBearer(res.status, bearer, requestUrl(input), next)) return res;
    return exec(withBearer(init, next!));
  });
}

const sharePostRequestsInFlight = new Map<string, Promise<import('../types').BPActivity>>();

/**
 * BuddyPress REST v1 returns create/update results as a one-item array
 * (`[activity]`), not the activity object. Callers prepend the result to the
 * cached feeds, so always hand back the activity itself — an array in the
 * feed cache rendered a post with no id/content and crashed the screen.
 */
function firstActivity(
  result: import('../types').BPActivity | import('../types').BPActivity[]
): import('../types').BPActivity {
  return Array.isArray(result) ? result[0] : result;
}

// ---------- auth ----------
export async function wpLogin(username: string, password: string): Promise<JWTPayload> {
  const body = JSON.stringify({ username, password });
  const coralAuthRes = await fetchWithTimeout(`${API}/coral-auth/v1/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
  });

  if (coralAuthRes.ok) {
    return coralAuthRes.json();
  }

  if (coralAuthRes.status !== 404 && coralAuthRes.status !== 405) {
    await assertOk(coralAuthRes);
  }

  const jwtAuthRes = await fetchWithTimeout(`${API}/jwt-auth/v1/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
  });
  await assertOk(jwtAuthRes);       // throws ApiError with clean message if not OK
  return jwtAuthRes.json();         // safe: body not consumed by assertOk
}

export async function validateJwtToken(token: string): Promise<boolean> {
  const res = await fetchWithTimeout(`${API}/jwt-auth/v1/token/validate`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });

  if (res.ok) return true;
  if (res.status === 401 || res.status === 403) return false;

  await assertOk(res);
  return true;
}

const refreshCoordinator = createTokenRefreshCoordinator(async (refreshToken: string) => {
  const res = await fetchWithTimeout(`${API}/coral-auth/v1/token/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh_token: refreshToken }),
  });
  await assertOk(res);
  return res.json() as Promise<TokenRefreshPayload>;
});

export function refreshCoralToken(refreshToken: string): Promise<TokenRefreshPayload> {
  return refreshCoordinator.refresh(refreshToken);
}

// ---------- taxonomies ----------
export async function getCategoryIdBySlug(slug: string): Promise<number | null> {
  const res = await fetchWithTimeout(`${API}/wp/v2/categories?slug=${encodeURIComponent(slug)}`);
  await assertOk(res);
  const arr = await res.json();
  return arr?.[0]?.id ?? null;
}

export async function getTagIdBySlug(slug: string): Promise<number | null> {
  const res = await fetchWithTimeout(`${API}/wp/v2/tags?slug=${encodeURIComponent(slug)}`);
  await assertOk(res);
  const arr = await res.json();
  return arr?.[0]?.id ?? null;
}

// ---------- posts ----------
export async function getPosts(page = 1): Promise<WPPost[]> {
  const res = await fetchWithTimeout(`${API}/wp/v2/posts?per_page=10&page=${page}&_embed=1`);
  await assertOk(res);
  return res.json();
}

// ---------- UI helpers ----------
export function getFeaturedImageUrl(post: WPPost): string | undefined {
  const media = post?._embedded?.['wp:featuredmedia']?.[0];
  return (
    media?.media_details?.sizes?.medium_large?.source_url ||
    media?.media_details?.sizes?.medium?.source_url ||
    media?.source_url
  );
}

export function stripHtmlPublic(html: string): string {
  // keep export for any callers already using it
  return stripHtml(html);
}

// ---------- membership check (protected) ----------
export async function getMembershipStatus(token: string): Promise<MembershipResponse> {
  const res = await fetchWithTimeout(`${API}/coral/v1/membership`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  await assertOk(res);
  return res.json();
}

// =========================
// Membership Levels (public)
// =========================
export async function getMembershipLevels(): Promise<MembershipLevel[]> {
  const res = await fetchWithTimeout(`${API}/coral/v1/levels`);
  await assertOk(res);
  const data = await res.json();

  const list = Array.isArray(data?.levels) ? data.levels : [];
  return list.map((l: any) => ({
    id: Number(l?.id ?? 0),
    name: String(l?.name ?? ''),
    price: String(l?.price ?? ''),
    note: String(l?.note ?? ''),
    description: String(l?.description ?? ''),
    benefits: Array.isArray(l?.benefits) ? l.benefits.map((b: any) => String(b)) : [],
    checkout_url:
      String(
        l?.checkout_url ??
          `${WP}/membership-account/membership-checkout/?level=${Number(l?.id ?? 0)}`
      ),
  }));
}

/**
 * Get a single-use checkout link that signs the browser into the logged-in
 * app user's WordPress account before showing PMPro checkout (coral-app-checkout
 * v1.1+). Without it, PMPro treats an upgrading member as a new registrant.
 * POST /coral-checkout/v1/link { level }
 */
export async function getAppCheckoutLink(token: string, levelId: number): Promise<string> {
  const data = await authedFetch<{ url?: string }>('/coral-checkout/v1/link', token, {
    method: 'POST',
    body: JSON.stringify({ level: levelId }),
  });
  if (!data?.url) throw new ApiError('Checkout link unavailable', 500);
  return data.url;
}

// =========================
// Premium Resources (protected)
// =========================
/**
 * Fetch the premium-resource catalog with per-user lock state from the
 * server (coral-membership v1.4+). Throws 404 on older plugin versions —
 * callers fall back to the client-side catalog in constants/premiumResources.
 */
export async function getPremiumResources(token: string): Promise<PremiumResource[]> {
  const res = await fetchWithTimeout(`${API}/coral/v1/premium-resources`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  await assertOk(res);
  const data = await res.json();

  const list = Array.isArray(data?.resources) ? data.resources : [];
  return list.map((r: any) => ({
    key: String(r?.key ?? ''),
    title: String(r?.title ?? ''),
    required_tiers: Array.isArray(r?.required_tiers)
      ? r.required_tiers.map((t: any) => String(t))
      : [],
    unlocked: Boolean(r?.unlocked),
    url: String(r?.url ?? ''),
  })) as PremiumResource[];
}

// =========================
// PMPro built-in REST API (live on the site today)
// =========================
/**
 * GET /pmpro/v1/me — PMPro's own endpoint returning the *current* user's
 * membership info. Used to derive the tier when the coral-membership plugin
 * on the server is the old v1.3 (which only returns { is_member }).
 * Response shape varies across PMPro versions, so callers parse defensively.
 */
export async function getPmproMe(token: string): Promise<any> {
  return authedFetch<any>('/pmpro/v1/me', token);
}

/**
 * Pull a PMPro level id/name out of a /pmpro/v1/me response, tolerating the
 * shape differences between PMPro versions (membership_level object,
 * membership_levels array, or flat fields).
 */
export function extractPmproLevel(me: any): { id: number | null; name: string | null } {
  const lvl =
    me?.membership_level ??
    (Array.isArray(me?.membership_levels) ? me.membership_levels[0] : null) ??
    me?.level ??
    null;

  const id = Number(lvl?.id ?? lvl?.ID ?? me?.membership_level_id ?? NaN);
  const name = lvl?.name ?? me?.membership_level_name ?? null;

  return {
    id: Number.isFinite(id) && id > 0 ? id : null,
    name: typeof name === 'string' && name.trim() !== '' ? name : null,
  };
}

/**
 * Exchange the app's JWT for a one-time website sign-in URL.
 * POST /coral/v1/auth/web-session (coral-membership plugin >= 1.5).
 * Loading the returned URL in a WebView sets the WordPress login cookie and
 * lands on `redirectTo`. The URL is single use and expires after ~60s, so
 * request a fresh one for every load. Throws ApiError (404 = plugin route
 * not deployed yet).
 */
export async function getWebSessionUrl(
  token: string,
  redirectTo: string
): Promise<{ url: string; expires_in?: number }> {
  return authedFetch<{ url: string; expires_in?: number }>('/coral/v1/auth/web-session', token, {
    method: 'POST',
    body: JSON.stringify({ redirect_to: redirectTo }),
  });
}

// ---------- authedFetch + /users/me ----------
export async function authedFetch<T = any>(path: string, token: string, init: RequestInit = {}) {
  const res = await fetchWithTimeout(`${API}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init.headers || {}),
      Authorization: `Bearer ${token}`,
    },
  });
  await assertOk(res);
  return res.json() as Promise<T>;
}

export function getMe(token: string) {
  return authedFetch<WPUser>('/wp/v2/users/me', token);
}

// ---------- Push Notifications ----------
/**
 * Register a push notification token for the current user
 * @param {string} token - JWT authentication token
 * @param {string} pushToken - Expo push token
 * @param {string} deviceId - Unique device identifier
 * @returns {Promise<{success: boolean, message: string}>}
 */
export async function registerPushToken(
  token: string,
  pushToken: string,
  deviceId: string
): Promise<{ success: boolean; message: string }> {
  return authedFetch('/coral/v1/push-token', token, {
    method: 'POST',
    body: JSON.stringify({ 
      push_token: pushToken,
      device_id: deviceId,
      platform: 'expo'
    }),
  });
}

/**
 * Remove a push notification token for the current user
 * @param {string} token - JWT authentication token
 * @param {string} deviceId - Unique device identifier
 * @returns {Promise<{success: boolean, message: string}>}
 */
export async function removePushToken(
  token: string,
  deviceId: string
): Promise<{ success: boolean; message: string }> {
  return authedFetch('/coral/v1/push-token', token, {
    method: 'DELETE',
    body: JSON.stringify({ device_id: deviceId }),
  });
}

// ---------- BuddyPress Notifications ----------

/** Get the current user's unread BuddyPress notifications. */
export async function getBuddyPressNotifications(
  userId: number,
  token: string
): Promise<import('../types').BPNotification[]> {
  const params = new URLSearchParams({
    user_id: String(userId),
    is_new: 'true',
    per_page: '100',
    order_by: 'date_notified',
    sort_order: 'DESC',
  });

  return authedFetch<import('../types').BPNotification[]>(
    `/buddypress/v1/notifications?${params.toString()}`,
    token
  );
}

/** Mark a BuddyPress notification as read. */
export async function markBuddyPressNotificationRead(
  notificationId: number,
  token: string
): Promise<import('../types').BPNotification> {
  return authedFetch<import('../types').BPNotification>(
    `/buddypress/v1/notifications/${notificationId}`,
    token,
    {
      method: 'PATCH',
      body: JSON.stringify({ is_new: 0 }),
    }
  );
}

/** Get pending group invitations addressed to the current user. */
export async function getGroupInvites(
  userId: number,
  token: string
): Promise<import('../types').BPGroupInvite[]> {
  const params = new URLSearchParams({
    user_id: String(userId),
    invite_sent: 'sent',
    per_page: '100',
  });

  return authedFetch<import('../types').BPGroupInvite[]>(
    `/buddypress/v1/groups/invites?${params.toString()}`,
    token
  );
}

/** Accept a group invitation. */
export async function acceptGroupInvite(
  inviteId: number,
  token: string
): Promise<import('../types').BPGroupInvite> {
  return authedFetch<import('../types').BPGroupInvite>(
    `/buddypress/v1/groups/invites/${inviteId}`,
    token,
    { method: 'PUT', body: JSON.stringify({}) }
  );
}

/** Reject a group invitation. */
export async function rejectGroupInvite(inviteId: number, token: string): Promise<void> {
  return authedFetch(`/buddypress/v1/groups/invites/${inviteId}`, token, {
    method: 'DELETE',
  });
}

// ---------- BuddyPress Profile API ----------

/**
 * Get current user's BuddyPress member profile
 * @param {string} token - JWT authentication token
 * @returns {Promise<BPMember>}
 */
export async function getCurrentMember(token: string): Promise<BPMember> {
  return authedFetch<BPMember>('/buddypress/v1/members/me', token);
}

/**
 * Get a BuddyPress member by ID
 * @param {number} userId - User ID
 * @param {string} token - JWT authentication token
 * @returns {Promise<BPMember>}
 */
export async function getMemberById(userId: number, token: string): Promise<BPMember> {
  return authedFetch<BPMember>(`/buddypress/v1/members/${userId}`, token);
}

/**
 * Get a list of BuddyPress members with optional search and pagination
 * Uses buddypress/v1/members endpoint and populate_extras=true to include friendship_status_slug
 * @param token - JWT authentication token
 * @param options - Query options (search, page, perPage)
 */
export async function getMembers(
  token: string,
  options?: { search?: string; page?: number; perPage?: number; exclude?: number[] }
): Promise<BPMember[]> {
  const params = new URLSearchParams();
  if (options?.search) params.set('search', options.search);
  const exclude = (options?.exclude ?? []).filter((id) => Number.isFinite(id) && id > 0);
  if (exclude.length > 0) params.set('exclude', exclude.join(','));
  params.set('page', String(options?.page ?? 1));
  params.set('per_page', String(options?.perPage ?? 20));
  params.set('type', 'active');
  params.set('populate_extras', 'true');
  return authedFetch<BPMember[]>(`/buddypress/v1/members?${params}`, token);
}

/**
 * Load many members in one request per 100 ids (`members?include=`).
 * Used to seed the per-member cache without an N+1 fan-out on the feed.
 */
export async function getMembersByIds(token: string, ids: number[]): Promise<BPMember[]> {
  const unique = Array.from(new Set(ids.filter((id) => Number.isFinite(id) && id > 0)));
  const members: BPMember[] = [];

  for (let i = 0; i < unique.length; i += 100) {
    const chunk = unique.slice(i, i + 100);
    const params = new URLSearchParams({
      include: chunk.join(','),
      populate_extras: 'true',
      per_page: String(chunk.length),
      page: '1',
    });
    const batch = await authedFetch<BPMember[]>(`/buddypress/v1/members?${params}`, token);
    members.push(...(Array.isArray(batch) ? batch : []));
  }

  return members;
}

/**
 * Update current user's profile
 * @param {string} token - JWT authentication token
 * @param {UpdateMemberPayload} payload - Profile update data
 * @returns {Promise<BPMember>}
 */
export async function updateCurrentMember(
  token: string,
  payload: UpdateMemberPayload
): Promise<BPMember> {
  return authedFetch<BPMember>('/buddypress/v1/members/me', token, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

/**
 * Get user avatar
 * @param {number} userId - User ID
 * @param {string} token - JWT authentication token
 * @returns {Promise<BPAvatar>}
 */
export async function getUserAvatar(userId: number, token: string): Promise<BPAvatar> {
  const res = await fetchWithTimeout(`${API}/buddypress/v1/members/${userId}/avatar`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  await assertOk(res);
  const data = await res.json();
  // BuddyPress returns media resources in a one-item array.
  const avatar = Array.isArray(data) ? data[0] : data;
  return {
    full: avatar?.full || '',
    thumb: avatar?.thumb || '',
  };
}

/**
 * Upload user avatar using Coral API endpoint
 * @param {number} userId - User ID
 * @param {string} token - JWT authentication token
 * @param {string} imageUri - Local URI of the selected image
 * @returns {Promise<BPAvatar>} Object with avatar URLs (full and thumb)
 */
export async function uploadUserAvatar(
  userId: number,
  token: string,
  imageUri: string
): Promise<BPAvatar> {
  const formData = new FormData();
  const endpoint = `${API}/buddypress/v1/members/${userId}/avatar`;

  console.log('[ProfileMedia][avatar][api] Preparing request', {
    userId,
    platform: Platform.OS,
    endpoint,
  });
  
  if (Platform.OS === 'web') {
    const response = await fetch(imageUri);
    const blob = await response.blob();
    
    // Detect actual MIME type from blob
    const mimeType = blob.type || 'image/jpeg';
    const extension = mimeType.split('/')[1] || 'jpg';
    
    const file = new File([blob], `avatar.${extension}`, { type: mimeType });
    
    formData.append('file', file);

    console.log('[ProfileMedia][avatar][api] Web file added to FormData', {
      name: file.name,
      type: file.type,
      size: file.size,
    });
  } else {
    imageUri = await ensureUploadableImageUri(imageUri);
    const uriParts = imageUri.split(/[?#]/)[0].split('.');
    const fileType = uriParts[uriParts.length - 1] || 'jpg';
    
    // Map common extensions to proper MIME types
    const mimeMap: { [key: string]: string } = {
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'png': 'image/png',
      'gif': 'image/gif',
      'heic': 'image/heic',
      'heif': 'image/heif',
    };
    
    const mimeType = mimeMap[fileType.toLowerCase()] || 'image/jpeg';
    
    // @ts-ignore - React Native FormData accepts this format
    formData.append('file', {
      uri: imageUri,
      name: `avatar.${fileType}`,
      type: mimeType,
    });

    console.log('[ProfileMedia][avatar][api] Native file added to FormData', {
      name: `avatar.${fileType}`,
      type: mimeType,
    });
  }

  // BP_Attachment_Avatar validates this multipart action before accepting the file.
  formData.append('action', 'bp_avatar_upload');
  console.log('[ProfileMedia][avatar][api] Added required BuddyPress upload action', {
    action: 'bp_avatar_upload',
  });

  try {
    console.log('[ProfileMedia][avatar][api] Sending POST request', {
      endpoint,
      timeoutMs: 30000,
    });

    const res = await fetchWithTimeout(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        // Don't set Content-Type - browser/RN sets it automatically with boundary
      },
      body: formData,
    }, 30000);

    console.log('[ProfileMedia][avatar][api] Response received', {
      status: res.status,
      ok: res.ok,
    });

    await assertOk(res);
    const data = await res.json();
    console.log('[ProfileMedia][avatar][api] Response body', data);
    const avatar = Array.isArray(data) ? data[0] : data;

    return {
      full: avatar?.full || '',
      thumb: avatar?.thumb || '',
    };
  } catch (error) {
    console.error('[ProfileMedia][avatar][api] Request failed', {
      endpoint,
      error,
    });
    throw error;
  }
}

/**
 * Delete user avatar
 * @param {number} userId - User ID
 * @param {string} token - JWT authentication token
 * @returns {Promise<{deleted: boolean}>}
 */
export async function deleteUserAvatar(
  userId: number,
  token: string
): Promise<{ deleted: boolean }> {
  return authedFetch<{ deleted: boolean }>(`/buddypress/v1/members/${userId}/avatar`, token, {
    method: 'DELETE',
  });
}

/**
 * Get user cover image
 * @param {number} userId - User ID
 * @param {string} token - JWT authentication token
 * @returns {Promise<BPCoverImage>}
 */
export async function getUserCover(userId: number, token: string): Promise<BPCoverImage> {
  const res = await fetchWithTimeout(`${API}/buddypress/v1/members/${userId}/cover`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  await assertOk(res);
  const data = await res.json();
  // BuddyPress returns media resources in a one-item array.
  const cover = Array.isArray(data) ? data[0] : data;
  return {
    image: cover?.image || '',
  };
}

/**
 * Upload user cover image
 * @param {number} userId - User ID
 * @param {string} token - JWT authentication token
 * @param {FormData} formData - Form data with image file
 * @returns {Promise<BPCoverImage>}
 */
export async function uploadUserCover(
  userId: number,
  token: string,
  formData: FormData
): Promise<BPCoverImage> {
  const endpoint = `${API}/buddypress/v1/members/${userId}/cover`;

  // BP_Attachment_Cover_Image validates this multipart action before accepting the file.
  formData.append('action', 'bp_cover_image_upload');
  console.log('[ProfileMedia][cover][api] Added required BuddyPress upload action', {
    action: 'bp_cover_image_upload',
  });

  try {
    console.log('[ProfileMedia][cover][api] Sending POST request', {
      userId,
      platform: Platform.OS,
      endpoint,
      timeoutMs: 15000,
    });

    const res = await fetchWithTimeout(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        // Don't set Content-Type - let browser set it with boundary for multipart/form-data
      },
      body: formData,
    });

    console.log('[ProfileMedia][cover][api] Response received', {
      status: res.status,
      ok: res.ok,
    });

    await assertOk(res);
    const data = await res.json();
    console.log('[ProfileMedia][cover][api] Response body', data);
    const cover = Array.isArray(data) ? data[0] : data;

    return {
      image: cover?.image || '',
    };
  } catch (error) {
    console.error('[ProfileMedia][cover][api] Request failed', {
      endpoint,
      error,
    });
    throw error;
  }
}

/**
 * Delete user cover image
 * @param {number} userId - User ID
 * @param {string} token - JWT authentication token
 * @returns {Promise<{deleted: boolean}>}
 */
export async function deleteUserCover(
  userId: number,
  token: string
): Promise<{ deleted: boolean }> {
  return authedFetch<{ deleted: boolean }>(`/buddypress/v1/members/${userId}/cover`, token, {
    method: 'DELETE',
  });
}

/**
 * Update XProfile field data
 * @param {number} fieldId - XProfile field ID
 * @param {number} userId - User ID
 * @param {string} token - JWT authentication token
 * @param {UpdateXProfilePayload} payload - Field value update
 * @returns {Promise<XProfileFieldData>}
 */
export async function updateXProfileField(
  fieldId: number,
  userId: number,
  token: string,
  payload: UpdateXProfilePayload
): Promise<XProfileFieldData> {
  return authedFetch<XProfileFieldData>(
    `/buddypress/v1/xprofile/${fieldId}/data/${userId}`,
    token,
    {
      method: 'POST',
      body: JSON.stringify(payload),
    }
  );
}

/**
 * Get every xprofile field group with its fields, options and the given
 * user's saved values (used by the "Edit My Profile" screen).
 * GET /buddypress/v1/xprofile/groups?fetch_fields=true&fetch_field_data=true&user_id=
 */
export async function getXProfileGroupsForUser(
  userId: number,
  token: string
): Promise<import('../types').BPXProfileGroup[]> {
  const params = new URLSearchParams({
    fetch_fields: 'true',
    fetch_field_data: 'true',
    fetch_visibility_level: 'true',
    hide_empty_fields: 'false',
    user_id: String(userId),
    per_page: '100',
  });
  const result = await authedFetch<import('../types').BPXProfileGroup[]>(
    `/buddypress/v1/xprofile/groups?${params.toString()}`,
    token
  );
  return Array.isArray(result) ? result : [];
}

/**
 * Get user activity from BuddyPress
 * @param {number} userId - User ID
 * @param {string} token - JWT authentication token
 * @returns {Promise<any[]>} - Array of activity items
 */
export async function getUserActivity(
  userId: number,
  token: string
): Promise<any[]> {
  return authedFetch<any[]>(`/buddypress/v1/activity?user_id=${userId}`, token);
}

// ---------- BuddyPress Friends API ----------

/**
 * Get friendship relationships for a user
 * Returns raw friendship data (relationships, not user details)
 * @param {number} userId - User ID
 * @param {string} token - JWT authentication token
 * @returns {Promise<BPFriendship[]>}
 */
export async function getFriendshipRelationships(
  userId: number,
  token: string,
  confirmed: 0 | 1 = 1
): Promise<import('../types').BPFriendship[]> {
  // BuddyPress defaults to 10 per page, so fetch every page (100 per page).
  // Don't trust X-WP-Total / X-WP-TotalPages here: the BP friends endpoint
  // sets them from the size of the *current page*, so they always say one
  // page — which capped Connections at 100 and Requests at 50. Keep reading
  // until a short (or repeated) page comes back.
  const perPage = 100;
  const all: import('../types').BPFriendship[] = [];
  const seen = new Set<number>();
  for (let page = 1; page <= 50; page++) {
    const res = await fetchWithTimeout(
      `${API}/buddypress/v1/friends?user_id=${userId}&is_confirmed=${confirmed}&per_page=${perPage}&page=${page}`,
      {
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      }
    );
    await assertOk(res);
    const batch = (await res.json()) as import('../types').BPFriendship[];
    const list = Array.isArray(batch) ? batch : [];
    let added = 0;
    for (const friendship of list) {
      if (seen.has(friendship.id)) continue;
      seen.add(friendship.id);
      all.push(friendship);
      added++;
    }
    // A short page is the last one; a page with nothing new means the server
    // ignored `page` and keeps returning the same rows.
    if (list.length < perPage || added === 0) break;
  }
  return all;
}

/**
 * Get friends list with full user details (OPTIMAL APPROACH)
 * This uses the members endpoint which already filters friends
 * and includes all member data in one efficient request
 * @param {number} userId - User ID
 * @param {string} token - JWT authentication token
 * @param {number} page - Page number for pagination
 * @param {number} perPage - Items per page
 * @returns {Promise<import('../types').FriendsListResponse>}
 */
export async function getFriendsList(
  userId: number,
  token: string,
  page: number = 1,
  perPage: number = 20
): Promise<import('../types').FriendsListResponse> {
  const friendships = await getFriendshipRelationships(userId, token);

  const total = friendships.length;
  const pages = Math.max(1, Math.ceil(total / perPage));
  const start = (page - 1) * perPage;
  const pagedFriendships = friendships.slice(start, start + perPage);
  const friendIds = pagedFriendships
    .map((friendship) => friendship.initiator_id === userId ? friendship.friend_id : friendship.initiator_id)
    .filter((friendId) => friendId && friendId !== userId);

  // Step 2: Get friends with full member details. BuddyPress members does not
  // accept user_id as a friendship filter, so request the related member IDs.
  let validMembers: import('../types').BPMember[] = [];

  for (let i = 0; i < friendIds.length; i += 100) {
    const chunk = friendIds.slice(i, i + 100);
    const params = new URLSearchParams({
      include: chunk.join(','),
      populate_extras: 'true',
      per_page: String(chunk.length),
      page: '1',
    });
    const batchRes = await fetchWithTimeout(`${API}/buddypress/v1/members?${params.toString()}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (batchRes.ok) {
      validMembers = validMembers.concat(await batchRes.json());
    } else {
      const members = await Promise.all(
        chunk.map((friendId) => getMemberById(friendId, token).catch(() => null))
      );
      validMembers = validMembers.concat(
        members.filter((member): member is import('../types').BPMember => !!member)
      );
    }
  }

  // Step 3: Merge friendship dates with member data
  const friendsWithDetails: import('../types').FriendWithDetails[] = validMembers.map((member) => {
    // Find the friendship relationship for this member
    const friendship = friendships.find(
      (f) => 
        (f.initiator_id === userId && f.friend_id === member.id) ||
        (f.friend_id === userId && f.initiator_id === member.id)
    );
    
    return {
      ...member,
      friendship_id: friendship?.id || 0,
      friendship_date: friendship?.date_created || '',
      friendship_date_gmt: friendship?.date_created_gmt,
    };
  });
  
  return {
    friends: friendsWithDetails,
    total,
    pages,
  };
}

/**
 * Get friend details by ID
 * @param {number} friendId - Friend user ID
 * @param {string} token - JWT authentication token
 * @returns {Promise<BPMember>}
 */
export async function getFriendById(friendId: number, token: string): Promise<import('../types').BPMember> {
  return getMemberById(friendId, token);
}

/**
 * Remove a friend (delete friendship)
 * Uses the production Coral Social API endpoint which requires authentication
 * @param {number} friendUserId - Friend's user ID to remove
 * @param {string} token - JWT authentication token
 * @param {number} friendshipId - Optional friendship ID (not used by current endpoint)
 * @returns {Promise<{success: boolean; message: string}>}
 */
export async function removeFriend(
  friendUserId: number,
  token: string,
  friendshipId?: number
): Promise<{ success: boolean; message: string }> {
  
  const url = `${API}/coral/v1/users/${friendUserId}/remove-friendship`;
  
  const res = await fetchWithTimeout(url, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
  });
  
  await assertOk(res);
  const result = await res.json();
  return result;
}

/**
 * Get pending friend requests (both received and sent)
 * @param {number} userId - Current user ID
 * @param {string} token - JWT authentication token
 * @returns {Promise<BPFriendship[]>}
 */
export async function getPendingFriendRequests(
  userId: number,
  token: string
): Promise<import('../types').BPFriendship[]> {
  return getFriendshipRelationships(userId, token, 0);
}

/**
 * Accept a friend request by updating the friendship with the other user
 * @param {number} otherUserId - ID of the other user in the friendship (initiator)
 * @param {string} token - JWT authentication token (must be from the user accepting the request)
 * @returns {Promise<BPFriendship>}
 */
export async function acceptFriendRequest(
  otherUserId: number,
  token: string
): Promise<import('../types').BPFriendship> {
  // PUT /friends/{initiator user id}: BuddyPress looks up the friendship
  // between that user and the logged-in user (the receiver) and confirms it.
  //
  // Accepting runs BuddyPress' friends_friendship_accepted hooks on the
  // server (activity item, notification and an email to the initiator),
  // which can outlast the default 15s client timeout. The app then aborted
  // the request ("FetchRequestCanceledException") even though the server
  // usually completed it. Allow more time, and if the request still fails
  // without an HTTP answer, ask the server whether the friendship is now
  // confirmed before reporting an error.
  let res: Response;
  try {
    res = await fetchWithTimeout(
      `${API}/buddypress/v1/friends/${otherUserId}`,
      {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ context: 'edit' }),
      },
      45000
    );
  } catch (networkError) {
    const confirmed = await getConfirmedFriendship(otherUserId, token);
    if (confirmed) return confirmed;
    throw new Error(
      'The server took too long to respond. Please check your connection and try again.'
    );
  }

  if (!res.ok) {
    // Already accepted (double tap, or accepted on the website meanwhile).
    const confirmed = await getConfirmedFriendship(otherUserId, token);
    if (confirmed) return confirmed;
  }
  await assertOk(res);
  const result = await res.json();
  return Array.isArray(result) ? result[0] : result;
}

/**
 * The friendship between the logged-in user and `otherUserId`, if it is
 * confirmed; null if it is still pending, missing, or can't be checked.
 */
async function getConfirmedFriendship(
  otherUserId: number,
  token: string
): Promise<import('../types').BPFriendship | null> {
  try {
    const data = await authedFetch<any>(`/buddypress/v1/friends/${otherUserId}`, token);
    const friendship = (Array.isArray(data) ? data[0] : data) as
      | import('../types').BPFriendship
      | undefined;
    if (!friendship) return null;
    const confirmed =
      friendship.is_confirmed === true || Number(friendship.is_confirmed) === 1;
    return confirmed ? friendship : null;
  } catch {
    return null;
  }
}

/**
 * Reject or cancel a friend request
 * @param {number} otherUserId - User ID of the other person in the friendship
 * @param {string} token - JWT authentication token
 * @returns {Promise<{deleted: boolean; previous: BPFriendship}>}
 */
export async function rejectFriendRequest(
  otherUserId: number,
  token: string
): Promise<{ deleted: boolean; previous: import('../types').BPFriendship }> {
  
  // DELETE /friends/{user_id} - the id is the OTHER user's ID, not friendship_id
  const res = await fetchWithTimeout(
    `${API}/buddypress/v1/friends/${otherUserId}?force=true`,
    {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
    }
  );
  
  await assertOk(res);
  const result = await res.json();
  return result;
}

/**
 * Send a friend request to another user
 * @param {number} currentUserId - Current user's ID (initiator)
 * @param {number} friendId - ID of the user to send request to
 * @param {string} token - JWT authentication token
 * @returns {Promise<BPFriendship>}
 */
export async function sendFriendRequest(
  currentUserId: number,
  friendId: number,
  token: string
): Promise<import('../types').BPFriendship> {
  // Prefer the Coral endpoint (also guarantees the recipient's website
  // notification); fall back to the BuddyPress REST route if unavailable.
  const coralRes = await fetchWithTimeout(`${API}/coral/v1/users/${friendId}/friend-request`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
  });
  if (coralRes.ok) {
    return coralRes.json();
  }
  if (coralRes.status !== 404 && coralRes.status !== 405) {
    await assertOk(coralRes);
  }

  const res = await fetchWithTimeout(`${API}/buddypress/v1/friends`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      initiator_id: currentUserId,
      friend_id: friendId,
    }),
  });
  
  await assertOk(res);
  return res.json();
}

// ---------- BuddyPress Activity API ----------

/**
 * Get activity feed from BuddyPress
 * @param {string} token - JWT authentication token
 * @param {object} options - Query options
 * @param {string} options.scope - 'just-me' for user's posts, 'friends' for friends' posts, or undefined for all
 * @param {number} options.user_id - Filter by specific user ID
 * @param {number} options.page - Page number for pagination
 * @param {number} options.per_page - Items per page
 * @returns {Promise<import('../types').ActivityFeedResponse>}
 */
export async function getActivityFeed(
  token: string,
  options: {
    scope?: 'just-me' | 'friends' | 'groups';
    user_id?: number;
    page?: number;
    per_page?: number;
    component?: string;
  } = {}
): Promise<import('../types').ActivityFeedResponse> {
  const { scope, user_id, page = 1, per_page = 20, component } = options;
  
  const params = new URLSearchParams({
    page: String(page),
    per_page: String(per_page),
    display_comments: 'threaded',
  });
  
  if (scope) params.append('scope', scope);
  if (user_id) params.append('user_id', String(user_id));
  if (component) params.append('component', component);
  
  const url = `/buddypress/v1/activity?${params.toString()}`;
  
  const res = await fetchWithTimeout(`${API}${url}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  
  await assertOk(res);
  const activities: import('../types').BPActivity[] = await res.json();

  const total = parseInt(res.headers.get('X-WP-Total') || '0', 10);
  const pages = parseInt(res.headers.get('X-WP-TotalPages') || '1', 10);

  console.log(`[FEED] page ${page} — options=${JSON.stringify(options)} — ${activities.length}/${total} activities (${pages} pages)`);
  console.log(
    '[FEED] activities:',
    activities.map((a) => ({
      id: a.id,
      user: a.user_name,
      type: a.type,
      component: a.component,
      status: (a as any).status,
      date: a.date,
      excerpt:
        (typeof a.content === 'string' ? a.content : a.content?.rendered || '')
          .replace(/<[^>]+>/g, '')
          .slice(0, 60),
    }))
  );

  return {
    activities,
    total,
    pages,
  };
}

/**
 * Get a single activity from BuddyPress.
 * @param {number} activityId - BuddyPress activity ID
 * @param {string} token - JWT authentication token
 * @returns {Promise<import('../types').BPActivity>}
 */
export async function getActivityById(
  activityId: number,
  token: string
): Promise<import('../types').BPActivity> {
  const result = await authedFetch<import('../types').BPActivity | import('../types').BPActivity[]>(
    `/buddypress/v1/activity/${activityId}`,
    token
  );

  return Array.isArray(result) ? result[0] : result;
}

/**
 * Upload image to WordPress Media Library
 * @param {string} token - JWT authentication token
 * @param {string} imageUri - Local image URI from device or blob URI
 * @param {string} fileName - Name for the uploaded file
 * @returns {Promise<{source_url: string, id: number}>} - Returns the public URL and media ID
 */
export async function uploadImage(
  token: string,
  imageUri: string,
  fileName: string = 'post-image.jpg'
): Promise<{ source_url: string; id: number }> {
  try {

    // Create FormData for multipart upload
    const formData = new FormData();

    // WordPress rejects HEIC/HEIF and other formats outside its allowed mime
    // list, so normalise anything that is not JPEG/PNG/GIF to JPEG first.
    imageUri = await ensureUploadableImageUri(imageUri);

    // Detect file extension and MIME type
    const fileExtension = imageUri.split(/[?#]/)[0].split('.').pop()?.toLowerCase() || 'jpg';
    const mimeType = fileExtension === 'png' ? 'image/png' : 
                     fileExtension === 'gif' ? 'image/gif' : 
                     'image/jpeg';

    // Check if it's a blob URI (for web/Expo Web)
    if (imageUri.startsWith('blob:')) {
      
      // Convert blob URI to actual Blob
      const blobResponse = await fetch(imageUri);
      const blob = await blobResponse.blob();
      
      // Append blob to FormData
      formData.append('file', blob, fileName);
    } else {
      // For React Native native (file:// URIs). Keep the file name's
      // extension consistent with the MIME type so WordPress accepts it.
      const extension = mimeType === 'image/png' ? 'png' : mimeType === 'image/gif' ? 'gif' : 'jpg';
      const nativeFileName = fileName.replace(/\.[a-z0-9]+$/i, '') + `.${extension}`;
      // @ts-ignore - React Native FormData accepts this format
      formData.append('file', {
        uri: imageUri,
        type: mimeType,
        name: nativeFileName,
      });
    }

    const res = await fetchWithTimeout(`${API}/wp/v2/media`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        // Don't set Content-Type - let the browser/RN set it with boundary
      },
      body: formData,
    });

    await assertOk(res);
    const data = await res.json();

    return {
      source_url: data.source_url,
      id: data.id,
    };
  } catch (error) {
    throw error;
  }
}

/**
 * Create a new activity post
 * @param {string} token - JWT authentication token
 * @param {import('../types').CreateActivityPayload} payload - Post content and metadata
 * @returns {Promise<import('../types').BPActivity>}
 */
export async function createPost(
  token: string,
  payload: import('../types').CreateActivityPayload
): Promise<import('../types').BPActivity> {
  const data = {
    content: payload.content,
    component: payload.component || 'activity',
    type: payload.type || 'activity_update',
    ...(payload.primary_item_id && { primary_item_id: payload.primary_item_id }),
  };

  const result = await authedFetch<import('../types').BPActivity | import('../types').BPActivity[]>(
    '/buddypress/v1/activity',
    token,
    {
      method: 'POST',
      body: JSON.stringify(data),
    }
  );
  return firstActivity(result);
}

/**
 * Like/favorite an activity post
 * @param {number} activityId - Activity ID to favorite
 * @param {string} token - JWT authentication token
 * @returns {Promise<{favorited: boolean}>}
 */
export async function likePost(
  activityId: number,
  token: string
): Promise<{ favorited: boolean }> {
  
  return authedFetch<{ favorited: boolean }>(
    `/buddypress/v1/activity/${activityId}/favorite`,
    token,
    {
      method: 'POST',
    }
  );
}

/**
 * Remove a favorite from an activity post.
 * BuddyPress toggles the favorite state using the same POST endpoint.
 * @param {number} activityId - Activity ID to unfavorite
 * @param {string} token - JWT authentication token
 * @returns {Promise<{favorited: boolean}>}
 */
export async function unlikePost(
  activityId: number,
  token: string
): Promise<{ favorited: boolean }> {
  
  return authedFetch<{ favorited: boolean }>(
    `/buddypress/v1/activity/${activityId}/favorite`,
    token,
    {
      method: 'POST',
    }
  );
}

/**
 * Share an activity post (create a new post referencing the original)
 * @param {number} originalActivityId - Original activity ID to share
 * @param {string} content - Optional message to add when sharing
 * @param {string} token - JWT authentication token
 * @returns {Promise<import('../types').BPActivity>}
 */
export async function sharePost(
  originalActivityId: number,
  postUrl: string,
  token: string,
  content?: string
): Promise<import('../types').BPActivity> {
  const trimmedContent = content?.trim() || '';
  const requestKey = JSON.stringify([token, originalActivityId, postUrl, trimmedContent]);
  const existingRequest = sharePostRequestsInFlight.get(requestKey);

  if (existingRequest) {
    return existingRequest;
  }

  // The website's share feature stores the original activity in
  // `secondary_item_id`; earlier app builds only set `primary_item_id`, so
  // the website could not resolve app shares. Send both.
  const data: {
    component: 'activity';
    type: 'activity_share';
    primary_item_id: number;
    secondary_item_id: number;
    link: string;
    content?: string;
  } = {
    component: 'activity',
    type: 'activity_share',
    primary_item_id: originalActivityId,
    secondary_item_id: originalActivityId,
    link: postUrl,
  };

  if (trimmedContent) {
    data.content = trimmedContent;
  }

  const request = (async () => {
    const res = await fetchWithTimeout(`${API}/buddypress/v1/activity`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(data),
    });

    await assertOk(res);
    return firstActivity(await res.json());
  })();

  sharePostRequestsInFlight.set(requestKey, request);

  try {
    return await request;
  } finally {
    sharePostRequestsInFlight.delete(requestKey);
  }
}

/**
 * Delete an activity post (only works for own posts or admin)
 * @param {number} activityId - Activity ID to delete
 * @param {string} token - JWT authentication token
 * @returns {Promise<{deleted: boolean; previous: import('../types').BPActivity}>}
 */
export async function deletePost(
  activityId: number,
  token: string
): Promise<{ deleted: boolean; previous: import('../types').BPActivity }> {
  
  return authedFetch<{ deleted: boolean; previous: import('../types').BPActivity }>(
    `/buddypress/v1/activity/${activityId}`,
    token,
    {
      method: 'DELETE',
    }
  );
}

/**
 * Edit/update an activity post
 * @param {number} activityId - Activity ID to update
 * @param {string} content - New content for the post
 * @param {string} token - JWT authentication token
 * @param {object} options - Optional fields to maintain context (component, primary_item_id)
 * @returns {Promise<import('../types').BPActivity>}
 */
export async function updatePost(
  activityId: number,
  content: string,
  token: string,
  options?: { component?: string; primary_item_id?: number }
): Promise<import('../types').BPActivity> {
  
  const data: any = {
    content,
    type: 'activity_update',
  };
  
  // Preserve group context if provided
  if (options?.component) {
    data.component = options.component;
  }
  if (options?.primary_item_id) {
    data.primary_item_id = options.primary_item_id;
  }
  
  const result = await authedFetch<import('../types').BPActivity | import('../types').BPActivity[]>(
    `/buddypress/v1/activity/${activityId}`,
    token,
    {
      method: 'PATCH',
      body: JSON.stringify(data),
    }
  );
  return firstActivity(result);
}

/**
 * Create a post in a group
 * @param {number} groupId - Group ID
 * @param {string} content - Post content
 * @param {string} token - JWT authentication token
 * @returns {Promise<import('../types').BPActivity>}
 */
export async function createGroupPost(
  groupId: number,
  content: string,
  token: string
): Promise<import('../types').BPActivity> {
  const data = {
    content,
    component: 'groups',
    type: 'activity_update',
    primary_item_id: groupId,
  };

  const result = await authedFetch<import('../types').BPActivity | import('../types').BPActivity[]>(
    '/buddypress/v1/activity',
    token,
    {
      method: 'POST',
      body: JSON.stringify(data),
    }
  );
  return firstActivity(result);
}

// ---------- BuddyPress Groups API ----------

/**
 * Get current user's groups
 * @param {string} token - JWT authentication token
 * @param {object} params - Query parameters
 * @param {number} params.max - Maximum number of groups to return (0 = all)
 * @param {'view'|'edit'} params.context - Context for the request
 * @returns {Promise<import('../types').BPGroup[]>}
 */
export async function getMyGroups(
  token: string,
  params?: { max?: number; context?: 'view' | 'edit' }
): Promise<import('../types').BPGroup[]> {
  const queryParams = new URLSearchParams();
  
  if (params?.max) {
    queryParams.append('max', params.max.toString());
  }
  
  if (params?.context) {
    queryParams.append('context', params.context);
  }
  
  const queryString = queryParams.toString();
  const endpoint = `/buddypress/v1/groups/me${queryString ? `?${queryString}` : ''}`;
  
  return authedFetch<import('../types').BPGroup[]>(endpoint, token);
}

/**
 * Groups a member belongs to, most recently active first, with the extras
 * (`total_member_count`, `last_activity`, `last_activity_diff`) that
 * BuddyPress only fills in when `populate_extras=true`. `/groups/me` does not
 * honour that flag, which is why My Groups showed "0 members" everywhere.
 *
 * `show_hidden` is allowed for the logged-in user's own groups; if the site
 * refuses it, retry without so the list still loads.
 */
export async function getMemberGroupsWithExtras(
  userId: number,
  token: string,
  perPage: number = 100
): Promise<import('../types').BPGroup[]> {
  const params = new URLSearchParams({
    user_id: String(userId),
    type: 'active',
    populate_extras: 'true',
    per_page: String(perPage),
  });
  try {
    return await authedFetch<import('../types').BPGroup[]>(
      `/buddypress/v1/groups?${params.toString()}&show_hidden=true`,
      token
    );
  } catch (error) {
    if (error instanceof ApiError && error.status >= 400 && error.status < 500) {
      return authedFetch<import('../types').BPGroup[]>(
        `/buddypress/v1/groups?${params.toString()}`,
        token
      );
    }
    throw error;
  }
}

/**
 * Get all groups (public exploration)
 * @param {string} token - JWT authentication token
 * @param {object} params - Query parameters
 * @param {number} params.per_page - Number of groups per page (default 20)
 * @param {number} params.page - Page number
 * @param {string} params.search - Search term to filter groups by name
 * @returns {Promise<import('../types').BPGroup[]>}
 */
export async function getAllGroups(
  token: string,
  params?: { per_page?: number; page?: number; search?: string; user_id?: number }
): Promise<import('../types').BPGroup[]> {
  const queryParams = new URLSearchParams();

  queryParams.append('per_page', (params?.per_page ?? 20).toString());
  queryParams.append('populate_extras', 'true');

  if (params?.page) {
    queryParams.append('page', params.page.toString());
  }

  if (params?.search) {
    queryParams.append('search', params.search);
  }

  if (params?.user_id) {
    queryParams.append('user_id', params.user_id.toString());
  }

  const endpoint = `/buddypress/v1/groups?${queryParams.toString()}`;

  return authedFetch<import('../types').BPGroup[]>(endpoint, token);
}

/**
 * Create a new BuddyPress group
 * @param {string} token - JWT authentication token
 * @param {object} data - New group fields
 * @param {string} data.name - Group name (required)
 * @param {string} data.description - Group description (required)
 * @param {'public'|'private'|'hidden'} data.status - Privacy level (default 'public')
 * @param {string[]} data.types - Group types, e.g. ['research','community']
 * @returns {Promise<import('../types').BPGroup>}
 */
export async function createGroup(
  token: string,
  data: {
    name: string;
    description: string;
    status?: 'public' | 'private' | 'hidden';
    types?: string[];
    enable_forum?: boolean;
  }
): Promise<import('../types').BPGroup> {
  const body: Record<string, any> = {
    name: data.name,
    description: data.description,
    status: data.status || 'public',
  };
  if (data.types && data.types.length > 0) {
    body.types = data.types.join(',');
  }
  if (typeof data.enable_forum === 'boolean') {
    body.enable_forum = data.enable_forum;
  }

  const response = await authedFetch<any>('/buddypress/v1/groups', token, {
    method: 'POST',
    body: JSON.stringify(body),
  });

  // Same BuddyPress REST quirk as getGroupById: this site sometimes wraps
  // a single group in an array instead of returning the object directly,
  // which made newGroup.name / newGroup.id read as undefined right after
  // creating a group.
  if (Array.isArray(response) && response.length > 0) {
    return response[0] as import('../types').BPGroup;
  }

  return response as import('../types').BPGroup;
}

/**
 * Delete a BuddyPress group. Creator/admin only — the server enforces this;
 * the app just checks group.creator_id before showing the delete UI.
 * @param {number} groupId - Group ID to delete
 * @param {string} token - JWT authentication token
 */
export async function deleteGroup(groupId: number, token: string): Promise<void> {
  await authedFetch(`/buddypress/v1/groups/${groupId}`, token, {
    method: 'DELETE',
  });
}

/**
 * Upload a group's avatar image
 * @param {number} groupId - Group ID
 * @param {string} token - JWT authentication token
 * @param {string} imageUri - Local URI of the selected image (file:// on native, blob: on web)
 * @returns {Promise<{ full: string; thumb: string }>}
 */
export async function uploadGroupAvatar(
  groupId: number,
  token: string,
  imageUri: string
): Promise<{ full: string; thumb: string }> {
  const formData = new FormData();

  if (imageUri.startsWith('blob:') || Platform.OS === 'web') {
    const blobResponse = await fetch(imageUri);
    const blob = await blobResponse.blob();
    const mimeType = blob.type || 'image/jpeg';
    const extension = mimeType.split('/')[1] || 'jpg';
    const file = new File([blob], `group-avatar.${extension}`, { type: mimeType });
    formData.append('file', file);
  } else {
    const fileExtension = imageUri.split('.').pop()?.toLowerCase() || 'jpg';
    const mimeMap: { [key: string]: string } = {
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      png: 'image/png',
      gif: 'image/gif',
      heic: 'image/heic',
      heif: 'image/heif',
    };
    const mimeType = mimeMap[fileExtension] || 'image/jpeg';

    // @ts-ignore - React Native FormData accepts this format
    formData.append('file', {
      uri: imageUri,
      name: `group-avatar.${fileExtension}`,
      type: mimeType,
    });
  }

  // "Invalid form submission." (HTTP 500) is WordPress core's
  // wp_handle_upload() rejecting the request because it doesn't see a
  // POST field matching the "action" it expects — a check normally
  // satisfied by the hidden <input name="action"> on the classic
  // wp-admin upload form. BuddyPress's group-avatar REST handler apparently
  // doesn't disable that check (unlike the custom coral user-avatar
  // endpoint, which has no such issue), so a REST/multipart client has to
  // supply it manually.
  formData.append('action', 'bp_avatar_upload');

  const res = await fetchWithTimeout(`${API}/buddypress/v1/groups/${groupId}/avatar`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      // Don't set Content-Type - RN/browser sets it automatically with boundary
    },
    body: formData,
  }, 30000);

  await assertOk(res);
  const data = await res.json();
  const avatar = Array.isArray(data) ? data[0] : data;

  return {
    full: avatar?.full || avatar?.avatar_urls?.full || '',
    thumb: avatar?.thumb || avatar?.avatar_urls?.thumb || '',
  };
}

/**
 * Get groups for a specific user
 * @param {number} userId - User ID
 * @param {string} token - JWT authentication token
 * @param {object} params - Query parameters
 * @param {number} params.per_page - Number of groups per page (default 20)
 * @param {number} params.page - Page number
 * @returns {Promise<import('../types').BPGroup[]>}
 */
export async function getUserGroups(
  userId: number,
  token: string,
  params?: { per_page?: number; page?: number }
): Promise<import('../types').BPGroup[]> {
  const queryParams = new URLSearchParams();
  
  queryParams.append('user_id', userId.toString());
  
  if (params?.per_page) {
    queryParams.append('per_page', params.per_page.toString());
  }
  
  if (params?.page) {
    queryParams.append('page', params.page.toString());
  }
  
  const queryString = queryParams.toString();
  const endpoint = `/buddypress/v1/groups?${queryString}`;
  
  return authedFetch<import('../types').BPGroup[]>(endpoint, token);
}

/**
 * Get group details by ID
 * @param {number} groupId - Group ID
 * @param {string} token - JWT authentication token
 * @param {boolean} populateExtras - Whether to populate extra data like member count, last activity, etc.
 * @returns {Promise<import('../types').BPGroup>}
 */
export async function getGroupById(
  groupId: number,
  token: string,
  populateExtras: boolean = true
): Promise<import('../types').BPGroup> {
  const queryParams = populateExtras ? '?populate_extras=true' : '';
  const endpoint = `/buddypress/v1/groups/${groupId}${queryParams}`;
  
  const response = await authedFetch<any>(endpoint, token);
  
  // BuddyPress API returns an array with single group, extract first element
  if (Array.isArray(response) && response.length > 0) {
    return response[0] as import('../types').BPGroup;
  }
  
  return response as import('../types').BPGroup;
}

/**
 * Get group activity feed
 * @param {number} groupId - Group ID
 * @param {string} token - JWT authentication token
 * @param {object} params - Query parameters
 * @param {number} params.per_page - Number of activities per page (default 20)
 * @param {number} params.page - Page number
 * @param {'desc'|'asc'} params.order - Sort order (default 'desc')
 * @returns {Promise<import('../types').ActivityFeedResponse>}
 */
export async function getGroupActivity(
  groupId: number,
  token: string,
  params?: { per_page?: number; page?: number; order?: 'desc' | 'asc' }
): Promise<import('../types').ActivityFeedResponse> {
  const queryParams = new URLSearchParams();

  queryParams.append('group_id', groupId.toString());
  queryParams.append('per_page', (params?.per_page || 20).toString());
  queryParams.append('order', params?.order || 'desc');

  if (params?.page) {
    queryParams.append('page', params.page.toString());
  }

  // Without this, the group's "recent activity" (page joins, promotions, etc.)
  // fills the first page(s) and can push actual posts off the results
  // entirely for active groups. Only ask the server for real, postable
  // activity types — both known types real user posts can have (BuddyPress
  // saves group posts made via this REST API as "activity_status" instead of
  // "activity_update", regardless of what the client requests).
  ['activity_update', 'activity_status', 'activity_comment'].forEach((type) => {
    queryParams.append('type[]', type);
  });

  const queryString = queryParams.toString();
  const endpoint = `/buddypress/v1/activity?${queryString}`;

  // Use fetchWithTimeout directly (not authedFetch) so we can read the
  // X-WP-Total / X-WP-TotalPages headers — authedFetch discards headers and
  // only returns the parsed JSON, which previously made `total` silently
  // fall back to the fetched page size (e.g. always "20") instead of the
  // real server-side count.
  const res = await fetchWithTimeout(`${API}${endpoint}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  await assertOk(res);
  const response = (await res.json()) as any;

  const headerTotal = parseInt(res.headers.get('X-WP-Total') || '', 10);
  const headerPages = parseInt(res.headers.get('X-WP-TotalPages') || '', 10);

  // Handle both array response and paginated response format
  const result: import('../types').ActivityFeedResponse = Array.isArray(response)
    ? {
        activities: response,
        total: Number.isFinite(headerTotal) ? headerTotal : response.length,
        pages: Number.isFinite(headerPages) ? headerPages : 1,
      }
    : (response as import('../types').ActivityFeedResponse);

  return result;
}

/**
 * Get group members
 * @param {number} groupId - Group ID
 * @param {string} token - JWT authentication token
 * @param {object} params - Query parameters
 * @param {number} params.per_page - Number of members per page (default 20)
 * @param {number} params.page - Page number
 * @returns {Promise<import('../types').BPMember[]>}
 */
export interface GroupMembersResponse {
  members: import('../types').BPMember[];
  total: number;
  pages: number;
}

export async function getGroupMembers(
  groupId: number,
  token: string,
  params?: {
    per_page?: number;
    page?: number;
    /**
     * BuddyPress member-list ordering. 'group_activity' sorts by the
     * member's most recent activity within the group (i.e. "most active
     * members first"), which is what the member list should default to.
     */
    type?: 'group_activity' | 'last_joined' | 'first_joined' | 'alphabetical' | 'online' | 'random' | 'popular';
  }
): Promise<GroupMembersResponse> {
  const queryParams = new URLSearchParams();

  queryParams.append('per_page', (params?.per_page || 50).toString());
  queryParams.append('exclude_admins', 'false'); // Include admins in the list
  queryParams.append('type', params?.type || 'group_activity');

  if (params?.page) {
    queryParams.append('page', params.page.toString());
  }

  const queryString = queryParams.toString();
  const endpoint = `/buddypress/v1/groups/${groupId}/members?${queryString}`;

  // Use fetchWithTimeout directly (not authedFetch) so we can read the
  // X-WP-Total / X-WP-TotalPages headers for pagination — same fix as
  // getGroupActivity. Without it we have no reliable way to know whether
  // there's another page of members to fetch.
  const res = await fetchWithTimeout(`${API}${endpoint}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  await assertOk(res);
  const members = (await res.json()) as import('../types').BPMember[];

  const headerTotal = parseInt(res.headers.get('X-WP-Total') || '', 10);
  const headerPages = parseInt(res.headers.get('X-WP-TotalPages') || '', 10);

  return {
    members,
    total: Number.isFinite(headerTotal) ? headerTotal : members.length,
    pages: Number.isFinite(headerPages) ? headerPages : 1,
  };
}

// ---------- BuddyPress Group Membership Requests ----------

/**
 * Send a membership request for a private group
 */
export async function requestGroupMembership(
  groupId: number,
  userId: number,
  token: string
): Promise<{ id: number; user_id: number; group_id: number; status: string }> {
  return authedFetch('/buddypress/v1/groups/membership-requests', token, {
    method: 'POST',
    body: JSON.stringify({ group_id: groupId, user_id: userId }),
  });
}

/**
 * Get pending membership requests for a group (admin/creator only)
 */
export async function getGroupMembershipRequests(
  groupId: number,
  token: string
): Promise<Array<{ id: number; user_id: number; group_id: number; status: string; date_modified: string }>> {
  return authedFetch(`/buddypress/v1/groups/membership-requests?group_id=${groupId}&per_page=50`, token);
}

/**
 * Check if the current user has a pending request for a specific group
 */
export async function getMyMembershipRequest(
  userId: number,
  groupId: number,
  token: string
): Promise<Array<{ id: number; user_id: number; group_id: number; status: string }>> {
  return authedFetch(
    `/buddypress/v1/groups/membership-requests?user_id=${userId}&group_id=${groupId}`,
    token
  );
}

/**
 * Accept a membership request (admin/creator only)
 */
export async function acceptMembershipRequest(
  _groupId: number,
  requestId: number,
  token: string
): Promise<void> {
  return authedFetch(
    `/buddypress/v1/groups/membership-requests/${requestId}`,
    token,
    { method: 'PUT', body: JSON.stringify({}) }
  );
}

/**
 * Reject or cancel a membership request
 */
export async function rejectMembershipRequest(
  _groupId: number,
  requestId: number,
  token: string
): Promise<void> {
  return authedFetch(
    `/buddypress/v1/groups/membership-requests/${requestId}`,
    token,
    { method: 'DELETE' }
  );
}

// ---------- BuddyPress Group Membership ----------

/**
 * Join a BuddyPress group
 * @param groupId - Group ID to join
 * @param userId  - User ID joining the group
 * @param token   - JWT authentication token
 */
export async function joinGroup(
  groupId: number,
  userId: number,
  token: string
): Promise<{ id: number; user_id: number; roles: string[] }> {
  return authedFetch(`/buddypress/v1/groups/${groupId}/members`, token, {
    method: 'POST',
    body: JSON.stringify({ user_id: userId, role: 'member' }),
  });
}

/**
 * Leave a BuddyPress group
 * @param groupId - Group ID to leave
 * @param userId  - User ID leaving the group
 * @param token   - JWT authentication token
 */
export async function leaveGroup(
  groupId: number,
  userId: number,
  token: string
): Promise<void> {
  return authedFetch(`/buddypress/v1/groups/${groupId}/members/${userId}`, token, {
    method: 'DELETE',
  });
}

// ---------- BuddyPress Activity Comments API ----------

/**
 * Fetch activity comments for a BuddyPress activity
 * @param activityId - The BuddyPress activity ID
 * @param token      - JWT authentication token
 */
export async function getPostComments(
  activityId: number,
  token: string
): Promise<import('../types').BPActivity[]> {
  const url = `/buddypress/v1/activity/${activityId}?display_comments=threaded`;
  const result = await authedFetch<any>(url, token);
  const activity = Array.isArray(result) ? result[0] : result;
  const rawComments = activity?.comments;
  const comments: import('../types').BPActivity[] = rawComments
    ? Array.isArray(rawComments)
      ? rawComments
      : Object.values(rawComments)
    : [];
  return comments;
}

/**
 * Create a BuddyPress activity comment
 * @param activityId - The parent activity ID
 * @param content    - Plain text content of the comment
 * @param token      - JWT authentication token
 */
export async function createComment(
  activityId: number,
  content: string,
  token: string,
  parentCommentId?: number
): Promise<import('../types').BPActivity> {
  const result = await authedFetch<import('../types').BPActivity | import('../types').BPActivity[]>(
    '/buddypress/v1/activity',
    token,
    {
      method: 'POST',
      body: JSON.stringify({
        component: 'activity',
        type: 'activity_comment',
        primary_item_id: activityId,
        secondary_item_id: parentCommentId ?? activityId,
        content,
      }),
    }
  );
  return firstActivity(result);
}

/**
 * Update (edit) an existing BuddyPress activity comment
 * @param commentId - The comment activity ID to update
 * @param content   - New plain text content
 * @param token     - JWT authentication token
 */
export async function updateComment(
  commentId: number,
  content: string,
  token: string,
  primaryItemId?: number,
  secondaryItemId?: number
): Promise<import('../types').BPActivity> {
  return authedFetch<import('../types').BPActivity>(`/buddypress/v1/activity/${commentId}`, token, {
    method: 'PUT',
    body: JSON.stringify({
      component: 'activity',
      type: 'activity_comment',
      content,
      ...(primaryItemId !== undefined && { primary_item_id: primaryItemId }),
      ...(secondaryItemId !== undefined && { secondary_item_id: secondaryItemId }),
    }),
  });
}

/**
 * Permanently delete a BuddyPress activity comment
 * @param commentId - The comment activity ID to delete
 * @param token     - JWT authentication token
 */
export async function deleteComment(
  commentId: number,
  token: string
): Promise<{ deleted: boolean }> {
  return authedFetch<{ deleted: boolean }>(
    `/buddypress/v1/activity/${commentId}?force=true`,
    token,
    { method: 'DELETE' }
  );
}

// ---------- User Search (for @mention autocomplete) ----------

export interface UserSearchResult {
  id: number;
  name: string;
  mention_name: string;
  avatar_urls?: { full: string; thumb: string };
}

/**
 * Search users by partial name/login for @mention autocomplete
 * @param query - Partial name or username to search
 * @param token - JWT authentication token
 */
export async function searchUsers(query: string, token: string): Promise<UserSearchResult[]> {
  const params = new URLSearchParams({ search: query, per_page: '10' });
  const results = await authedFetch<BPMember[]>(
    `/buddypress/v1/members?${params}`,
    token
  );
  return results.map((m) => ({
    id: m.id,
    name: m.name,
    mention_name: m.mention_name || m.name,
    avatar_urls: m.avatar_urls,
  }));
}

// ---------- Messages API ----------
//
// The website inbox is the Better Messages plugin, which keeps its own tables.
// Messages written through BuddyPress (/buddypress/v1/messages) never appear
// there. When the coral-social-api bridge (/coral/v1/messages/threads) is
// deployed and Better Messages is active, every call below goes through it;
// otherwise (route 404 / 501) the app keeps using BuddyPress as before. The
// bridge answers in BuddyPress' response shape, so callers don't change.

type MessagingBackend = 'better-messages' | 'buddypress';

let messagingBackend: MessagingBackend | null = null;
let messagingBackendProbe: Promise<MessagingBackend> | null = null;

const BM_THREADS_PATH = '/coral/v1/messages/threads';

async function resolveMessagingBackend(token: string): Promise<MessagingBackend> {
  if (messagingBackend) return messagingBackend;
  if (messagingBackendProbe) return messagingBackendProbe;

  messagingBackendProbe = (async () => {
    try {
      const res = await fetchWithTimeout(`${API}${BM_THREADS_PATH}?per_page=1`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${token}` },
      });
      // 404 = route not deployed, 501 = Better Messages not active.
      if (res.status === 404 || res.status === 501) {
        messagingBackend = 'buddypress';
        return messagingBackend;
      }
      await assertOk(res);
      messagingBackend = 'better-messages';
      return messagingBackend;
    } finally {
      messagingBackendProbe = null;
    }
  })();

  return messagingBackendProbe;
}

async function usesBetterMessages(token: string): Promise<boolean> {
  return (await resolveMessagingBackend(token)) === 'better-messages';
}

async function bmFetch<T>(
  token: string,
  path: string,
  init: RequestInit = {}
): Promise<{ data: T; res: Response }> {
  const res = await fetchWithTimeout(`${API}${BM_THREADS_PATH}${path}`, {
    ...init,
    headers: {
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...(init.headers || {}),
      Authorization: `Bearer ${token}`,
    },
  });
  await assertOk(res);
  return { data: (await res.json()) as T, res };
}

async function replyWithBetterMessages(
  token: string,
  threadId: number,
  message: string
): Promise<BPMessageMutationResponse> {
  const { data } = await bmFetch<BPMessageMutationResponse>(token, `/${threadId}`, {
    method: 'POST',
    body: JSON.stringify({ message: encodeMessageForTransport(message) }),
  });
  return data;
}

async function getBetterMessagesConversations(token: string): Promise<BPConversationSummary[]> {
  const all: BPConversationSummary[] = [];
  let totalPages = 1;
  for (let page = 1; page <= totalPages && page <= 20; page++) {
    const { data, res } = await bmFetch<BPConversationSummary[]>(
      token,
      `?${new URLSearchParams({ page: String(page), per_page: String(CONVERSATIONS_PER_PAGE) })}`
    );
    const batch = Array.isArray(data) ? data : [];
    all.push(...batch);
    const headerPages = parseInt(res.headers.get('X-WP-TotalPages') || '', 10);
    if (Number.isFinite(headerPages) && headerPages > 0) {
      totalPages = headerPages;
    } else {
      break;
    }
  }
  return all;
}

/** BuddyPress caps `per_page` at 100; request close to the max so the inbox is not truncated. */
const CONVERSATIONS_PER_PAGE = 99;
/** Without this the `recipients` array is truncated, which breaks name + reply-target resolution. */
const CONVERSATION_RECIPIENTS_PER_PAGE = 50;

function getConversationItemsFromResponse(
  data: BPConversationsResponse | null | undefined
): BPConversationSummary[] {
  if (Array.isArray(data)) return data;
  if (!data) return [];
  if (Array.isArray(data.threads)) return data.threads;
  if (Array.isArray(data.messages)) return data.messages;
  if (Array.isArray(data.items)) return data.items;
  return [];
}

function getConversationKey(item: BPConversationSummary): string | null {
  const rawId = item.id ?? item.thread_id;
  if (rawId == null) return null;
  const parsed = Number(rawId);
  return Number.isFinite(parsed) ? String(parsed) : String(rawId);
}

async function getConversationBox(
  token: string,
  box: 'inbox' | 'sentbox',
  userId?: number | null
): Promise<BPConversationSummary[]> {
  const params = new URLSearchParams({
    box,
    type: 'all',
    per_page: String(CONVERSATIONS_PER_PAGE),
    recipients_per_page: String(CONVERSATION_RECIPIENTS_PER_PAGE),
  });

  // The endpoint declares `user_id` as required with a default of 0. Leaving it
  // unset makes the box query unscoped, which surfaces threads the current user
  // is not part of (and which then fail to render).
  if (userId != null && Number.isFinite(userId)) {
    params.set('user_id', String(userId));
  }

  const all: BPConversationSummary[] = [];
  let totalPages = 1;
  for (let page = 1; page <= totalPages && page <= 20; page++) {
    params.set('page', String(page));
    const res = await fetchWithTimeout(`${API}/buddypress/v1/messages?${params}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    await assertOk(res);
    const batch = getConversationItemsFromResponse(
      (await res.json()) as BPConversationsResponse
    );
    all.push(...batch);

    const headerPages = parseInt(res.headers.get('X-WP-TotalPages') || '', 10);
    if (Number.isFinite(headerPages) && headerPages > 0) {
      totalPages = headerPages;
    } else if (batch.length >= CONVERSATIONS_PER_PAGE) {
      totalPages = page + 1;
    } else {
      break;
    }
  }

  return all;
}

/**
 * BuddyPress defaults to `box=inbox`, which hides threads the current user started
 * (and never got a reply to). Fetch inbox and sentbox and merge them by thread id so
 * the list reflects the user's full conversation history.
 */
export async function getConversations(
  token: string,
  userId?: number | null
): Promise<BPConversationsResponse> {
  if (await usesBetterMessages(token)) {
    return getBetterMessagesConversations(token);
  }

  const [inbox, sentbox] = await Promise.all([
    getConversationBox(token, 'inbox', userId),
    // A failing sentbox must not blank out the whole list.
    getConversationBox(token, 'sentbox', userId).catch(
      () => [] as BPConversationSummary[]
    ),
  ]);

  const merged = new Map<string, BPConversationSummary>();

  // Seed with sentbox, then let inbox win: the inbox copy carries the accurate
  // unread_count for the current user.
  for (const item of sentbox) {
    const key = getConversationKey(item);
    if (key) merged.set(key, item);
  }

  for (const item of inbox) {
    const key = getConversationKey(item);
    if (!key) continue;
    const existing = merged.get(key);
    merged.set(key, existing ? { ...existing, ...item } : item);
  }

  return Array.from(merged.values());
}
export async function getMessages(
  threadId: number,
  token: string,
  page = 1,
  pageSize = 20,
  userId?: number | null
): Promise<BPMessageThreadResult> {
  if (await usesBetterMessages(token)) {
    const { data } = await bmFetch<BPMessageThreadResult>(
      token,
      `/${threadId}?${new URLSearchParams({
        page: String(page),
        per_page: String(pageSize),
        order: 'desc',
      })}`
    );
    return data;
  }

  const params = new URLSearchParams({
    messages_page: String(page),
    messages_per_page: String(pageSize),
    // Without this the recipients array comes back truncated, which breaks both
    // sender-name resolution and the reply recipient list.
    recipients_per_page: String(CONVERSATION_RECIPIENTS_PER_PAGE),
    order: 'desc',
  });

  // Scopes the thread (and its read state) to the current user.
  if (userId != null && Number.isFinite(userId)) {
    params.set('user_id', String(userId));
  }
  const url = `${API}/buddypress/v1/messages/${threadId}?${params}`;
  const res = await fetchWithTimeout(url, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  await assertOk(res);

  return (await res.json()) as BPMessageThreadResult;
}

export async function sendMessage(
  token: string,
  recipients: number[],
  subject: string,
  message: string
): Promise<BPMessageMutationResponse> {
  if (await usesBetterMessages(token)) {
    const { data } = await bmFetch<BPMessageMutationResponse>(token, '', {
      method: 'POST',
      body: JSON.stringify({
        recipients,
        subject,
        message: encodeMessageForTransport(message),
      }),
    });
    return data;
  }

  const url = `${API}/buddypress/v1/messages`;
  const res = await fetchWithTimeout(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      recipients,
      subject,
      message: encodeMessageForTransport(message),
    }),
  });

  await assertOk(res);

  return res.json() as Promise<BPMessageMutationResponse>;
}

export async function replyToThread(
  token: string,
  threadId: number,
  message: string,
  recipients: number[]
): Promise<BPMessageMutationResponse> {
  if (await usesBetterMessages(token)) {
    return replyWithBetterMessages(token, threadId, message);
  }

  const url = `${API}/buddypress/v1/messages`;
  const res = await fetchWithTimeout(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      id: threadId,
      message: encodeMessageForTransport(message),
      recipients,
    }),
  });

  await assertOk(res);

  return (await res.json()) as BPMessageMutationResponse;
}

export async function replyToConversation(
  token: string,
  threadId: number,
  message: string
): Promise<BPMessageMutationResponse> {
  if (await usesBetterMessages(token)) {
    return replyWithBetterMessages(token, threadId, message);
  }

  const url = `${API}/buddypress/v1/messages`;

  const res = await fetchWithTimeout(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      context: 'edit',
      id: threadId,
      message: encodeMessageForTransport(message),
    }),
  });

  await assertOk(res);

  const data = (await res.json()) as BPMessageMutationResponse;

  return data;
}

export async function markConversationAsRead(
  threadId: number,
  token: string
): Promise<BPMessageMutationResponse> {
  if (await usesBetterMessages(token)) {
    const { data } = await bmFetch<BPMessageMutationResponse>(token, `/${threadId}/read`, {
      method: 'POST',
    });
    return data;
  }

  const url = `${API}/buddypress/v1/messages/${threadId}`;

  try {
    const res = await fetchWithTimeout(url, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ context: 'edit', read: true }),
    });

    await assertOk(res);

    const data = (await res.json()) as BPMessageMutationResponse;

    return data;
  } catch (error) {

    throw error;
  }
}

export async function deleteConversation(
  threadId: number,
  token: string,
  userId?: number | null
): Promise<BPMessageDeleteResponse> {
  if (await usesBetterMessages(token)) {
    const { data } = await bmFetch<BPMessageDeleteResponse>(token, `/${threadId}`, {
      method: 'DELETE',
    });
    return data;
  }

  // `user_id` ("the user ID to remove from the thread") is declared required with a
  // default of 0. Without it the delete is not scoped to the current user.
  const params = new URLSearchParams();
  if (userId != null && Number.isFinite(userId)) {
    params.set('user_id', String(userId));
  }
  const query = params.toString();

  const res = await fetchWithTimeout(
    `${API}/buddypress/v1/messages/${threadId}${query ? `?${query}` : ''}`,
    {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  await assertOk(res);
  const raw = await res.text();

  if (!raw.trim()) {
    return {
      deleted: true,
    };
  }

  try {
    return JSON.parse(raw) as BPMessageDeleteResponse;
  } catch {
    return {
      deleted: true,
      raw,
    };
  }
}

// ---------- password reset ----------
/**
 * Ask the site to email a password reset link.
 * Backed by POST /coral/v1/auth/lost-password (coral-social-api plugin).
 * Always resolves with a generic message when the endpoint exists; throws
 * ApiError otherwise (404 = plugin endpoint not deployed, 429 = rate limited).
 */
export async function requestPasswordReset(
  userLogin: string
): Promise<{ success: boolean; message: string }> {
  const res = await fetchWithTimeout(`${API}/coral/v1/auth/lost-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_login: userLogin }),
  });
  await assertOk(res);
  return res.json();
}

// ---------- member public profile ----------
/**
 * Get a member with extended profile (xprofile) data populated.
 * GET /buddypress/v1/members/{id}?populate_extras=true
 */
export async function getMemberProfile(userId: number, token: string): Promise<BPMember> {
  return authedFetch<BPMember>(`/buddypress/v1/members/${userId}?populate_extras=true`, token);
}

/**
 * Get a member's cover image URL, or null when none is set / endpoint 404s.
 */
export async function getMemberCoverOrNull(userId: number, token: string): Promise<string | null> {
  try {
    const cover = await getUserCover(userId, token);
    return cover.image || null;
  } catch {
    return null;
  }
}
