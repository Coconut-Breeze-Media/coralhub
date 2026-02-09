// lib/api.ts
import { Platform } from 'react-native';
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
  BPActivity,
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
  console.log('🔍 Platform detected:', Platform.OS);
  console.log('📷 Image URI received:', imageUri);
  
  const formData = new FormData();
  
  if (Platform.OS === 'web') {
    // Web: Convert URI to Blob and then to File
    console.log('🌐 Processing for Web platform');
    const response = await fetch(imageUri);
    const blob = await response.blob();
    console.log('📦 Blob created - size:', blob.size, 'type:', blob.type);
    
    // Detect actual MIME type from blob
    const mimeType = blob.type || 'image/jpeg';
    const extension = mimeType.split('/')[1] || 'jpg';
    console.log('🎯 Detected MIME type:', mimeType, '- Extension:', extension);
    
    const file = new File([blob], `avatar.${extension}`, { type: mimeType });
    console.log('📄 File created - name:', file.name, 'type:', file.type, 'size:', file.size);
    
    formData.append('file', file);
    console.log('✅ FormData appended with file');
  } else {
    // React Native (iOS/Android)
    console.log('📱 Processing for Native platform');
    const uriParts = imageUri.split('.');
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
    console.log('🎯 Detected extension:', fileType, '- MIME type:', mimeType);
    
    // @ts-ignore - React Native FormData accepts this format
    formData.append('file', {
      uri: imageUri,
      name: `avatar.${fileType}`,
      type: mimeType,
    });
    console.log('✅ FormData appended with native file object');
  }
  
  console.log('🚀 Sending request to:', `${API}/coral/v1/users/${userId}/avatar`);
  
  const res = await fetchWithTimeout(`${API}/coral/v1/users/${userId}/avatar`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      // Don't set Content-Type - browser/RN sets it automatically with boundary
    },
    body: formData,
  }, 30000); // 30 second timeout for file uploads
  
  console.log('📡 Response status:', res.status);
  
  await assertOk(res);
  const data = await res.json();
  
  console.log('✅ Upload successful - Avatar URLs:', data);
  
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
  token: string
): Promise<import('../types').BPFriendship[]> {
  return authedFetch<import('../types').BPFriendship[]>(
    `/buddypress/v1/friends?user_id=${userId}&is_confirmed=1`,
    token
  );
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
  // Step 1: Get friendship relationships to get dates
  console.log('[getFriendsList] Fetching friendships for user:', userId);
  const friendships = await getFriendshipRelationships(userId, token);
  console.log('[getFriendsList] Friendships found:', friendships.length);
  console.log('[getFriendsList] Friendships data:', JSON.stringify(friendships, null, 2));
  
  // Step 2: Get friends with full member details
  const res = await fetchWithTimeout(
    `${API}/buddypress/v1/members?user_id=${userId}&populate_extras=true&per_page=${perPage}&page=${page}`,
    {
      headers: { Authorization: `Bearer ${token}` },
    }
  );
  await assertOk(res);
  const members: import('../types').BPMember[] = await res.json();
  console.log('[getFriendsList] Members found:', members.length);
  
  // Get pagination info from headers
  const total = parseInt(res.headers.get('X-WP-Total') || '0', 10);
  const pages = parseInt(res.headers.get('X-WP-TotalPages') || '1', 10);
  
  // Step 3: Merge friendship dates with member data
  const friendsWithDetails: import('../types').FriendWithDetails[] = members.map((member) => {
    // Find the friendship relationship for this member
    const friendship = friendships.find(
      (f) => 
        (f.initiator_id === userId && f.friend_id === member.id) ||
        (f.friend_id === userId && f.initiator_id === member.id)
    );
    
    console.log(`[getFriendsList] Mapping member ${member.id} (${member.name}):`, {
      friendship_id: friendship?.id,
      has_friendship: !!friendship,
    });
    
    return {
      ...member,
      friendship_id: friendship?.id || 0,
      friendship_date: friendship?.date_created || '',
      friendship_date_gmt: friendship?.date_created_gmt,
    };
  });
  
  console.log('[getFriendsList] Returning friends with details:', friendsWithDetails.length);
  
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
 * Uses the coralhub/v1/remove-friend endpoint which requires authentication
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
  console.log('[removeFriend] Attempting to remove friend:', {
    friendUserId,
    friendshipId,
  });
  
  const url = `${API}/coralhub/v1/remove-friend?friend_id=${friendUserId}`;
  console.log('[removeFriend] URL:', url);
  
  const res = await fetchWithTimeout(url, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
  });
  
  await assertOk(res);
  const result = await res.json();
  console.log('[removeFriend] SUCCESS:', result);
  return result;
}