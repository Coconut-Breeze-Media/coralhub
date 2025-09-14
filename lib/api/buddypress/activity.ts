import { API } from '../env';
import { assertOk, fetchWithTimeout } from '../http';
import { authedFetch } from '../auth';
import type { BPActivity, ActivityItem, BPMember } from '../types';
import { sanitizeBuddyHtml } from './sanitize';

// feed
export async function getActivity(page = 1, perPage = 20, includeComments = false): Promise<ActivityItem[]> {
  const FEED_TYPES = ['activity_status', 'activity_update'].join(',');
  let url =
    `${API}/buddypress/v1/activity?per_page=${perPage}` +
    `&page=${page}&type=${FEED_TYPES}&orderby=date_recorded&order=desc`;
  if (includeComments) url += `&display_comments=stream`;

  const res = await fetchWithTimeout(url);
  await assertOk(res);
  const raw: BPActivity[] = await res.json();

  const normalizeWhitespace = (s: string) =>
    s.replace(/\r\n|\r|\n/g, '\n').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();

  return raw.map((a: any) => {
    const rendered = typeof a.content === 'string'
      ? a.content
      : (a.content?.rendered ?? '');
    const html = sanitizeBuddyHtml(rendered);
    const textForFilter = normalizeWhitespace(html.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' '));
    return {
      id: a.id,
      user_id: a.user_id,
      date: a.date,
      html: textForFilter ? html : '',
      favorited: a.favorited,
      favorite_count: a.favorite_count,
      comment_count: a.comment_count,
    };
  }).filter(item => item.html.trim().length > 0);
}

// create activity
export function postActivity(status: string, token: string) {
  return authedFetch('/buddypress/v1/activity', token, {
    method: 'POST',
    body: JSON.stringify({ content: status, type: 'activity_update' }),
  });
}

// favorites
export function favoriteActivity(id: number, token: string) {
  return authedFetch(`/buddypress/v1/activity/${id}/favorite`, token, { method: 'POST' });
}
export function unfavoriteActivity(id: number, token: string) {
  return authedFetch(`/buddypress/v1/activity/${id}/unfavorite`, token, { method: 'POST' });
}

// members
function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

export async function getMembersByIds(ids: number[]): Promise<Record<number, BPMember>> {
  if (!ids.length) return {};
  const uniq = Array.from(new Set(ids));
  const groups = chunk(uniq, 20);
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