// lib/api.ts
import type {
  JWTPayload,
  MembershipResponse,
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
} from '../types';

const API = process.env.EXPO_PUBLIC_WP_API!;
const WP  = process.env.EXPO_PUBLIC_WP_URL!;

if (!API) throw new Error('Missing EXPO_PUBLIC_WP_API');
if (!WP)  console.warn('EXPO_PUBLIC_WP_URL is not set (ok if unused yet)');

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

function fetchWithTimeout(input: RequestInfo | URL, init?: RequestInit, ms = 15000) {
  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort(), ms);
  return fetch(input, { ...init, signal: ctrl.signal }).finally(() => clearTimeout(id));
}

// ---------- auth ----------
export async function wpLogin(username: string, password: string): Promise<JWTPayload> {
  const res = await fetchWithTimeout(`${API}/jwt-auth/v1/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  await assertOk(res);       // throws ApiError with clean message if not OK
  return res.json();         // safe: body not consumed by assertOk
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
  return {
    full: data.full || '',
    thumb: data.thumb || '',
  };
}

/**
 * Upload user avatar
 * @param {number} userId - User ID
 * @param {string} token - JWT authentication token
 * @param {FormData} formData - Form data with image file
 * @returns {Promise<BPAvatar>}
 */
export async function uploadUserAvatar(
  userId: number,
  token: string,
  formData: FormData
): Promise<BPAvatar> {
  const res = await fetchWithTimeout(`${API}/buddypress/v1/members/${userId}/avatar`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      // Don't set Content-Type - let browser set it with boundary for multipart/form-data
    },
    body: formData,
  });
  await assertOk(res);
  const data = await res.json();
  return {
    full: data.full || '',
    thumb: data.thumb || '',
  };
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
  return {
    image: data.image || '',
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
  const res = await fetchWithTimeout(`${API}/buddypress/v1/members/${userId}/cover`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      // Don't set Content-Type - let browser set it with boundary for multipart/form-data
    },
    body: formData,
  });
  await assertOk(res);
  const data = await res.json();
  return {
    image: data.image || '',
  };
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