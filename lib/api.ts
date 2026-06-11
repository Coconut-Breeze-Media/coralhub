// lib/api.ts
import { Platform } from 'react-native';
import type {
  JWTPayload,
  TokenRefreshPayload,
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
  BPConversationsResponse,
  BPMessageThreadResult,
  BPMessageMutationResponse,
  BPMessageDeleteResponse,
} from '../types';
import { encodeMessageForTransport } from './messagePresentation';

const API = process.env.EXPO_PUBLIC_WP_API!;
const WP  = process.env.EXPO_PUBLIC_WP_URL!;

if (!API) throw new Error('Missing EXPO_PUBLIC_WP_API');

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

const sharePostRequestsInFlight = new Map<string, Promise<import('../types').BPActivity>>();

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

export async function refreshCoralToken(refreshToken: string): Promise<TokenRefreshPayload> {
  const res = await fetchWithTimeout(`${API}/coral-auth/v1/token/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh_token: refreshToken }),
  });
  await assertOk(res);
  return res.json();
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
 * Get a list of BuddyPress members with optional search and pagination
 * Uses buddypress/v1/members endpoint and populate_extras=true to include friendship_status_slug
 * @param token - JWT authentication token
 * @param options - Query options (search, page, perPage)
 */
export async function getMembers(
  token: string,
  options?: { search?: string; page?: number; perPage?: number }
): Promise<BPMember[]> {
  const params = new URLSearchParams();
  if (options?.search) params.set('search', options.search);
  params.set('page', String(options?.page ?? 1));
  params.set('per_page', String(options?.perPage ?? 20));
  params.set('populate_extras', 'true');
  return authedFetch<BPMember[]>(`/buddypress/v1/members?${params}`, token);
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
  
  const formData = new FormData();
  
  if (Platform.OS === 'web') {
    const response = await fetch(imageUri);
    const blob = await response.blob();
    
    // Detect actual MIME type from blob
    const mimeType = blob.type || 'image/jpeg';
    const extension = mimeType.split('/')[1] || 'jpg';
    
    const file = new File([blob], `avatar.${extension}`, { type: mimeType });
    
    formData.append('file', file);
  } else {
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
    
    // @ts-ignore - React Native FormData accepts this format
    formData.append('file', {
      uri: imageUri,
      name: `avatar.${fileType}`,
      type: mimeType,
    });
  }
  
  const res = await fetchWithTimeout(`${API}/coral/v1/users/${userId}/avatar`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      // Don't set Content-Type - browser/RN sets it automatically with boundary
    },
    body: formData,
  }, 30000);
  
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

  if (friendIds.length > 0) {
    const params = new URLSearchParams({
      include: friendIds.join(','),
      populate_extras: 'true',
      per_page: String(friendIds.length),
      page: '1',
    });
    const batchRes = await fetchWithTimeout(`${API}/buddypress/v1/members?${params.toString()}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (batchRes.ok) {
      validMembers = await batchRes.json();
    } else {
      const members = await Promise.all(
        friendIds.map((friendId) =>
          getMemberById(friendId, token).catch((error) => {
            return null;
          })
        )
      );
      validMembers = members.filter((member): member is import('../types').BPMember => !!member);
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
  
  const url = `${API}/coralhub/v1/remove-friend?friend_id=${friendUserId}`;
  
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
  const result = await authedFetch<import('../types').BPFriendship[]>(
    `/buddypress/v1/friends?user_id=${userId}&is_confirmed=0`,
    token
  );
  return result;
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
  
  // PUT on the other user's ID to accept their friendship request
  const res = await fetchWithTimeout(
    `${API}/buddypress/v1/friends/${otherUserId}`,
    {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        context: 'edit',
      }),
    }
  );
  
  await assertOk(res);
  const result = await res.json();
  return result;
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
    
    // Detect file extension and MIME type
    const fileExtension = imageUri.split('.').pop()?.toLowerCase() || 'jpg';
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
      // For React Native native (file:// URIs)
      // @ts-ignore - React Native FormData accepts this format
      formData.append('file', {
        uri: imageUri,
        type: mimeType,
        name: fileName,
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
  
  return authedFetch<import('../types').BPActivity>('/buddypress/v1/activity', token, {
    method: 'POST',
    body: JSON.stringify(data),
  });
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
 * Unlike/unfavorite an activity post
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
      method: 'DELETE',
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

  const data: {
    component: 'activity';
    type: 'activity_share';
    primary_item_id: number;
    link: string;
    content?: string;
  } = {
    component: 'activity',
    type: 'activity_share',
    primary_item_id: originalActivityId,
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
        'X-WP-Nonce': token,
      },
      body: JSON.stringify(data),
    });

    await assertOk(res);
    return res.json();
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
  
  return authedFetch<import('../types').BPActivity>(
    `/buddypress/v1/activity/${activityId}`,
    token,
    {
      method: 'PATCH',
      body: JSON.stringify(data),
    }
  );
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
  
  return authedFetch<import('../types').BPActivity>('/buddypress/v1/activity', token, {
    method: 'POST',
    body: JSON.stringify(data),
  });
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
  
  const queryString = queryParams.toString();
  const endpoint = `/buddypress/v1/activity?${queryString}`;
  
  const response = await authedFetch<any>(endpoint, token);
  
  // Handle both array response and paginated response format
  if (Array.isArray(response)) {
    return {
      activities: response,
      total: response.length,
      pages: 1
    };
  }
  
  return response as import('../types').ActivityFeedResponse;
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
export async function getGroupMembers(
  groupId: number,
  token: string,
  params?: { per_page?: number; page?: number }
): Promise<import('../types').BPMember[]> {
  const queryParams = new URLSearchParams();
  
  queryParams.append('per_page', (params?.per_page || 50).toString());
  queryParams.append('exclude_admins', 'false'); // Include admins in the list
  
  if (params?.page) {
    queryParams.append('page', params.page.toString());
  }
  
  const queryString = queryParams.toString();
  const endpoint = `/buddypress/v1/groups/${groupId}/members?${queryString}`;
  
  const response = await authedFetch<import('../types').BPMember[]>(endpoint, token);

  return response;
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
    { method: 'POST', body: JSON.stringify({ action: 'accept' }) }
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
    { method: 'POST', body: JSON.stringify({ action: 'reject' }) }
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
  return authedFetch<import('../types').BPActivity>('/buddypress/v1/activity', token, {
    method: 'POST',
    body: JSON.stringify({
      component: 'activity',
      type: 'activity_comment',
      primary_item_id: activityId,
      secondary_item_id: parentCommentId ?? activityId,
      content,
    }),
  });
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
export async function getConversations(token: string): Promise<BPConversationsResponse> {
  const url = `${API}/buddypress/v1/messages`;
  const res = await fetchWithTimeout(`${API}/buddypress/v1/messages`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  await assertOk(res);

  const data = (await res.json()) as BPConversationsResponse;

  return data;
}
export async function getMessages(
  threadId: number,
  token: string
): Promise<BPMessageThreadResult> {
  const url = `${API}/buddypress/v1/messages/${threadId}`;
  const res = await fetchWithTimeout(url, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  await assertOk(res);

  const data = (await res.json()) as BPMessageThreadResult;

  return data;
}

export async function sendMessage(
  token: string,
  recipients: number[],
  subject: string,
  message: string
): Promise<BPMessageMutationResponse> {
  const res = await fetchWithTimeout(`${API}/buddypress/v1/messages`, {
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

  const data = (await res.json()) as BPMessageMutationResponse;

  return data;
}

export async function replyToConversation(
  token: string,
  threadId: number,
  message: string
): Promise<BPMessageMutationResponse> {
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
      message,
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
  token: string
): Promise<BPMessageDeleteResponse> {
  const res = await fetchWithTimeout(`${API}/buddypress/v1/messages/${threadId}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

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
