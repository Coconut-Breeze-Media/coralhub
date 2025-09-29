/**
 * membership.ts
 * -----------------------------------------------------------------------------
 * Purpose
 *  - Membership status + levels from custom Coral endpoints.
 * Behavior
 *  - GETs are abortable via AbortSignal.
 * -----------------------------------------------------------------------------
 */

import { assertOk, fetchWithTimeout } from './http';
import { buildApiUrl } from './utils';
import type { MembershipResp } from './types';

export async function getMembershipStatus(
  token: string,
  signal?: AbortSignal
): Promise<MembershipResp> {
  const url = buildApiUrl('/coral/v1/membership');
  const res = await fetchWithTimeout(url, {
    signal,
    headers: { Authorization: `Bearer ${token}` },
  });
  await assertOk(res, { url, method: 'GET' });
  return res.json() as Promise<MembershipResp>;
}

export type MembershipLevel = {
  id: number;
  name: string;
  price: string;
  note: string;
  description: string;
  benefits: string[];
  checkout_url: string;
};

export async function getMembershipLevels(
  signal?: AbortSignal
): Promise<MembershipLevel[]> {
  const url = buildApiUrl('/coral/v1/levels');
  const res = await fetchWithTimeout(url, { signal });
  await assertOk(res, { url, method: 'GET' });
  const data = await res.json();

  const list = Array.isArray(data?.levels) ? data.levels : [];
  return list.map((l: any) => {
    const id = Number(l?.id ?? 0);
    return {
      id,
      name: String(l?.name ?? ''),
      price: String(l?.price ?? ''),
      note: String(l?.note ?? ''),
      description: String(l?.description ?? ''),
      benefits: Array.isArray(l?.benefits)
        ? l.benefits.map((b: any) => String(b))
        : [],
      checkout_url: String(
        l?.checkout_url ??
          // Fallback: construct from level id if backend didn’t include a URL
          buildApiUrl(
            // buildApiUrl handles API base; for a public site URL fallback you can inject WP base
            // If you prefer the original WP-page fallback, replace line below:
            // `${WP}/membership-account/membership-checkout/?level=${id}`
            '/coral/v1/checkout', // hypothetical API fallback; replace if you keep the WP-page fallback
            { level: id }
          )
      ),
    } as MembershipLevel;
  });
}