// lib/api/buddypress/likes.ts
import { API } from '../env';
import { assertOk, fetchWithTimeout } from '../http';
import type { BPMember } from '../types';
import { getMembersByIds } from './activity';

/** GET helper with optional auth */
async function getJson(url: string, token?: string) {
  const res = await fetchWithTimeout(url, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
  await assertOk(res);
  return res.json();
}

/** Convert various “member-ish” objects to BPMember */
function normalizeMember(m: unknown): BPMember | null {
  if (!m || typeof m !== 'object') return null;
  const obj = m as Record<string, any>;

  const id =
    obj.id ?? obj.user_id ?? obj.userId ?? obj.ID ?? obj.uid;
  if (id == null) return null;

  const name =
    obj.name ?? obj.display_name ?? obj.user_display_name ?? obj.username ?? obj.nicename ?? obj.user_nicename;

  const avatar =
    obj.avatar_url ?? obj.avatar ?? obj.user_avatar ?? obj?.avatars?.full ?? obj?.avatars?.thumb;

  const thumb =
    obj?.avatar_urls?.thumb ?? obj?.avatar_urls?.thumbnail ?? obj?.avatar_urls?.thumbs ??
    (typeof avatar === 'string' ? avatar : undefined);

  const full =
    obj?.avatar_urls?.full ?? obj?.avatar_urls?.large ??
    (typeof avatar === 'string' ? avatar : undefined);

  return {
    id: Number(id),
    name: name ? String(name) : undefined,
    avatar_urls: thumb || full ? { thumb, full } : undefined,
  };
}

/** Normalize any of the common shapes into BPMember[] */
function toMembers(json: unknown): BPMember[] {
  if (!json) return [];

  // 1) Already an array of member-like objects?
  if (Array.isArray(json)) {
    const arr = json.map(normalizeMember).filter(Boolean) as BPMember[];
    if (arr.length) return arr;
  }

  // Some APIs wrap the payload
  const container =
    (json as any)?.data ??
    (json as any)?.items ??
    json;

  // 2) Named arrays we often see
  const candidates = [
    (container as any)?.users,
    (container as any)?.members,
    (container as any)?.likers,
    (container as any)?.favorites,
    (container as any)?.favourites,
    (container as any)?.likes,
  ].find(Array.isArray);

  if (Array.isArray(candidates)) {
    const arr = candidates.map(normalizeMember).filter(Boolean) as BPMember[];
    if (arr.length) return arr;
  }

  // 3) IDs array (no hydration here; could be added using getMembersByIds)
  const ids =
    Array.isArray((container as any)?.user_ids) ? (container as any).user_ids
    : Array.isArray((container as any)?.ids)      ? (container as any).ids
    : null;
  if (Array.isArray(ids) && ids.length) {
    // If you want: fetch getMembersByIds(ids) here and return those
    return [];
  }

  return [];
}

/** Try a GET that never throws — returns [] on any failure. */
async function tryMembers(fn: () => Promise<any>): Promise<BPMember[]> {
  try {
    const json = await fn();
    const arr = toMembers(json);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function uniqById(list: BPMember[]): BPMember[] {
  const map = new Map<number, BPMember>();
  for (const m of list) {
    if (m?.id != null) map.set(m.id, m);
  }
  return Array.from(map.values());
}

// optional: avoid repeated "no route" logs for same item
const noRouteLogged = new Set<number>();

/**
 * Return a list of BPMember who liked/favorited this activity item.
 * We try a few known/likely endpoints and return the first non-empty result.
 * If nothing works, we return [] (no error).
 */
export async function getActivityLikers(activityId: number, token?: string): Promise<BPMember[]> {
  // 1) BuddyPress favorites route
  const r1 = await tryMembers(() =>
    getJson(`${API}/buddypress/v1/activity/${activityId}/favorites`, token)
  );
  if (r1.length) {
    if (__DEV__) console.log('[likes] used buddypress favorites route');
    return uniqById(r1).slice(0, 12);
  }

  // 2) BuddyBoss variants
  const r2 = await tryMembers(() =>
    getJson(`${API}/buddyboss/v1/activity/${activityId}/likes`, token)
  );
  if (r2.length) {
    if (__DEV__) console.log('[likes] used buddyboss likes route');
    return uniqById(r2).slice(0, 12);
  }

  const r3 = await tryMembers(() =>
    getJson(`${API}/buddyboss/v1/activity/${activityId}/favourites`, token)
  );
  if (r3.length) {
    if (__DEV__) console.log('[likes] used buddyboss favourites route');
    return uniqById(r3).slice(0, 12);
  }

  // 3) Custom route
  const r4 = await tryMembers(() =>
    getJson(`${API}/coral/v1/activity/${activityId}/likers`, token)
  );
  if (r4.length) {
    if (__DEV__) console.log('[likes] used custom coral likers route');
    return uniqById(r4).slice(0, 12);
  }

  // ✨ 4) NEW fallback: fetch the activity item and hydrate IDs if present
  try {
    const act: any = await getJson(`${API}/buddypress/v1/activity/${activityId}`, token);
    // Common places arrays appear
    const idArrays: unknown[] = [
      act?.favorites,
      act?.favourites,
      act?.likes,
      act?.meta?.favorites,
      act?.meta?.favourites,
      act?.meta?.likes,
    ].filter(Array.isArray) as number[][];

    const ids = Array.from(new Set((idArrays.flat() as unknown[]).map(Number).filter(n => Number.isFinite(n))));
    if (ids.length) {
      const members = await getMembersByIds(ids.slice(0, 24)); // cap to avoid huge calls
      const list = ids
        .map(id => members[id])
        .filter(Boolean) as BPMember[];
      if (list.length) {
        if (__DEV__) console.log('[likes] used activity item ID hydration fallback');
        return uniqById(list).slice(0, 12);
      }
    }
  } catch {
    // ignore; we'll return []
  }

  if (__DEV__) console.log('[likes] no likers route responded with data');
  return [];
}