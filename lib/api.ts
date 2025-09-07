// lib/api.ts
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

async function assertOk(res: Response) {
  if (!res.ok) {
    try {
      const data = await res.json();
      const msg = data?.message || data?.error || JSON.stringify(data);
      throw new ApiError(msg || `HTTP ${res.status}`, res.status);
    } catch {
      const text = await res.text();
      throw new ApiError(text || `HTTP ${res.status}`, res.status);
    }
  }
  return res;
}

function fetchWithTimeout(input: RequestInfo | URL, init?: RequestInit, ms = 15000) {
  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort(), ms);
  return fetch(input, { ...init, signal: ctrl.signal }).finally(() => clearTimeout(id));
}

// ---- Types ----
export type JWTPayload = {
  token: string;
  user_email: string;
  user_nicename: string;
  user_display_name: string;
};

export type MembershipResp = { is_member: boolean; user_id?: number; roles?: string[] };
export type WPPage = { id: number; slug: string; content: { rendered: string } };
export type WPPost = { id: number; date: string; title: { rendered: string }; excerpt?: { rendered: string }; _embedded?: any };

// ---- Auth ----
export async function wpLogin(username: string, password: string): Promise<JWTPayload> {
  const res = await fetchWithTimeout(`${API}/jwt-auth/v1/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  await assertOk(res);
  return res.json();
}

// ---- Taxonomies → IDs ----
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

// ---- Posts: fetch posts with the newest at the top. ----
export async function getPosts(page = 1): Promise<WPPost[]> {
  const res = await fetchWithTimeout(
    `${API}/wp/v2/posts?per_page=10&page=${page}&_embed=1`
  );
  await assertOk(res);
  return res.json();
}

// ---- (Optional) helpers for card UI ----
export function getFeaturedImageUrl(post: WPPost): string | undefined {
  const media = post?._embedded?.['wp:featuredmedia']?.[0];
  return (
    media?.media_details?.sizes?.medium_large?.source_url ||
    media?.media_details?.sizes?.medium?.source_url ||
    media?.source_url
  );
}

export function stripHtml(html: string): string {
  return html?.replace?.(/<[^>]+>/g, '').trim?.() ?? '';
}

// ---- Membership check (protected) ----
export async function getMembershipStatus(token: string): Promise<MembershipResp> {
  const res = await fetchWithTimeout(`${API}/coral/v1/membership`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  await assertOk(res);
  return res.json();
}