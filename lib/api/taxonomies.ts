/**
 * taxonomies.ts
 * -----------------------------------------------------------------------------
 * Purpose
 *  - Look up category/tag IDs by slug.
 * Behavior
 *  - GETs are abortable via AbortSignal.
 * -----------------------------------------------------------------------------
 */

import { assertOk, fetchWithTimeout } from './http';
import { buildApiUrl } from './utils';

export async function getCategoryIdBySlug(
  slug: string,
  signal?: AbortSignal
): Promise<number | null> {
  const url = buildApiUrl('/wp/v2/categories', { slug });
  const res = await fetchWithTimeout(url, { signal });
  await assertOk(res, { url, method: 'GET' });
  const arr = (await res.json()) as Array<{ id?: number }>;
  return (arr?.[0]?.id ?? null) as number | null;
}

export async function getTagIdBySlug(
  slug: string,
  signal?: AbortSignal
): Promise<number | null> {
  const url = buildApiUrl('/wp/v2/tags', { slug });
  const res = await fetchWithTimeout(url, { signal });
  await assertOk(res, { url, method: 'GET' });
  const arr = (await res.json()) as Array<{ id?: number }>;
  return (arr?.[0]?.id ?? null) as number | null;
}