/**
 * posts.ts
 * -----------------------------------------------------------------------------
 * Purpose
 *  - Fetch WordPress posts with embedded media.
 *  - Provide helpers to extract featured image URLs.
 * Behavior
 *  - GETs are abortable via AbortSignal.
 * -----------------------------------------------------------------------------
 */

import { assertOk, fetchWithTimeout } from './http';
import { buildApiUrl } from './utils';
import type { WPPost } from './types';

export async function getPosts(
  page = 1,
  perPage = 10,
  signal?: AbortSignal
): Promise<WPPost[]> {
  const url = buildApiUrl('/wp/v2/posts', {
    per_page: perPage,
    page,
    _embed: 1,
  });

  const res = await fetchWithTimeout(url, { signal });
  await assertOk(res, { url, method: 'GET' });
  return res.json() as Promise<WPPost[]>;
}

export function getFeaturedImageUrl(post: WPPost): string | undefined {
  const media = post?._embedded?.['wp:featuredmedia']?.[0];
  return (
    media?.media_details?.sizes?.medium_large?.source_url ||
    media?.media_details?.sizes?.medium?.source_url ||
    media?.source_url
  );
}