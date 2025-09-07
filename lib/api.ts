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

// ---------- types ----------
export type JWTPayload = {
  token: string;
  user_email: string;
  user_nicename: string;
  user_display_name: string;
};

export type MembershipResp = { is_member: boolean; user_id?: number; roles?: string[] };
export type WPPage = { id: number; slug: string; content: { rendered: string } };
export type WPPost = { id: number; date: string; title: { rendered: string }; excerpt?: { rendered: string }; _embedded?: any };

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
export async function getMembershipStatus(token: string): Promise<MembershipResp> {
  const res = await fetchWithTimeout(`${API}/coral/v1/membership`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  await assertOk(res);
  return res.json();
}

// =========================
// Membership Levels (public)
// =========================
export type MembershipLevel = {
  id: number;
  name: string;
  price: string;        // e.g. "$29.99" or "$0"
  note: string;         // e.g. "$29.99 per Year." or "Free"
  description: string;  // short text from WP (stripped)
  benefits: string[];   // optional; empty if none
  checkout_url: string; // PMPro checkout URL (our minimal page)
};

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

export type WPUserMe = { id: number; name: string; email?: string; username?: string; roles?: string[] };
export function getMe(token: string) {
  return authedFetch<WPUserMe>('/wp/v2/users/me', token);
}



// ---------- BuddyPress Activity API ----------

export type BPUser = {
  id: number;
  name: string;
  avatar_urls?: { thumb?: string; full?: string };
};

export type BPActivity = {
  id: number;
  user_id: number;
  component: string;
  type: string;
  date: string;
  content?: { rendered?: string } | string;
};

export type BPMember = {
  id: number;
  name?: string;
  avatar_urls?: { full?: string; thumb?: string };
};

export type ActivityItem = {
  id: number;
  user_id: number;
  date: string;
  html: string;
};

function decodeHtmlEntities(input: string): string {
  return input
    .replace(/&nbsp;/g, ' ')
    .replace(/&#8211;/g, '–')
    .replace(/&#8217;/g, '’')
    .replace(/&#8220;/g, '“')
    .replace(/&#8221;/g, '”')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

export async function getActivity(page = 1, perPage = 20): Promise<ActivityItem[]> {
  const res = await fetchWithTimeout(`${API}/buddypress/v1/activity?per_page=${perPage}&page=${page}`);
  await assertOk(res);
  const raw: BPActivity[] = await res.json();

  return raw.map((a) => {
    const rendered = typeof a.content === 'string' ? a.content : (a.content?.rendered ?? '');
    return {
      id: a.id,
      user_id: a.user_id,
      date: a.date,
      html: decodeHtmlEntities(rendered),
    };
  });
}

// Helper to chunk arrays
function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

// Fetch members in chunks (safer than one huge request)
export async function getMembersByIds(ids: number[]): Promise<Record<number, BPMember>> {
  if (!ids.length) return {};
  const uniq = Array.from(new Set(ids));
  const groups = chunk(uniq, 20); // many BP installs default per_page=20

  const map: Record<number, BPMember> = {};
  for (const g of groups) {
    const res = await fetchWithTimeout(
      `${API}/buddypress/v1/members?include=${g.join(',')}&per_page=${g.length}`
    );
    await assertOk(res);
    const list: BPMember[] = await res.json();
    for (const m of list) map[m.id] = m;
  }
  return map;
}

// Create a new activity (needs JWT)
export async function postActivity(status: string, token: string) {
  return authedFetch('/buddypress/v1/activity', token, {
    method: 'POST',
    body: JSON.stringify({
      content: status,
      type: 'activity_update', // default “status” post
    }),
  });
}

// Favorite / Unfavorite (BuddyPress core)
// If /unfavorite 404s on your stack, use the DELETE variation shown below.
export async function favoriteActivity(id: number, token: string) {
  return authedFetch(`/buddypress/v1/activity/${id}/favorite`, token, { method: 'POST' });
}
export async function unfavoriteActivity(id: number, token: string) {
  return authedFetch(`/buddypress/v1/activity/${id}/unfavorite`, token, { method: 'POST' });
  // Alternative some sites use:
  // return authedFetch(`/buddypress/v1/activity/${id}/favorite`, token, { method: 'DELETE' });
}

// Replies
export async function getActivityReplies(id: number, page = 1): Promise<BPActivity[]> {
  const res = await fetchWithTimeout(`${API}/buddypress/v1/activity/${id}/replies?per_page=20&page=${page}`);
  await assertOk(res);
  return res.json();
}
export async function postActivityReply(id: number, content: string, token: string) {
  return authedFetch(`/buddypress/v1/activity/${id}/replies`, token, {
    method: 'POST',
    body: JSON.stringify({ content }),
  });
}