// constants/premiumResources.ts
/**
 * Client-side premium-resource catalog and tier rules.
 *
 * This is the zero-deploy fallback for when the WordPress site is running the
 * old coral-membership plugin (v1.3), which only exposes { is_member }. The
 * app derives the user's tier from PMPro's built-in /pmpro/v1/me endpoint and
 * computes lock state locally. If the server is ever updated to v1.4 (rich
 * /coral/v1/membership + /coral/v1/premium-resources), the app automatically
 * prefers the server's answers — keep this table in sync with the plugin.
 */

import type { MembershipTier, PremiumResource } from '../types';

const WP = process.env.EXPO_PUBLIC_WP_URL ?? 'https://www.thecoralreefresearchhub.com';

/** Tier hierarchy: each tier includes everything below it. */
export const TIER_RANK: Record<MembershipTier, number> = {
  none: 0,
  monthly: 1,
  annual: 2,
  institutional: 3,
};

/** Confirmed live PMPro level IDs → app tier. */
export const LEVEL_ID_TIER_MAP: Record<number, MembershipTier> = {
  1: 'annual',        // Annual Membership  $49.99/yr
  2: 'monthly',       // Monthly Membership $4.99/mo
  3: 'institutional', // Group Membership   $199.99/yr
  6: 'none',          // Basic Membership   free
};

/** Name-prefix safety net when the level ID is unknown. */
export function tierFromLevelName(name?: string | null): MembershipTier | null {
  const first = String(name ?? '').trim().toLowerCase().split(/\s+/)[0];
  switch (first) {
    case 'annual':
      return 'annual';
    case 'monthly':
      return 'monthly';
    case 'group':
    case 'institutional':
      return 'institutional';
    case 'basic':
      return 'none';
    default:
      return null;
  }
}

interface CatalogItem {
  key: string;
  title: string;
  url: string;
  /** Minimum tier that unlocks this resource. */
  minTier: MembershipTier;
}

/** Client-provided live URLs. Dashboard is intentionally excluded from the app. */
export const PREMIUM_RESOURCE_CATALOG: ReadonlyArray<CatalogItem> = [
  { key: 'opportunities',          title: 'Opportunities',            url: `${WP}/career-opportunities/`,   minTier: 'monthly' },
  { key: 'courses',                title: 'Courses',                  url: `${WP}/courses/`,                minTier: 'monthly' },
  { key: 'mentorships',            title: 'Mentorships',              url: `${WP}/mentorships/`,            minTier: 'annual' },
  { key: 'document_library',       title: 'Document Library',         url: `${WP}/document-library/`,       minTier: 'monthly' },
  { key: 'coral_matters',          title: 'Coral Matters',            url: `${WP}/coralmatters/`,           minTier: 'monthly' },
  { key: 'essays_articles',        title: 'Essays and Articles',      url: `${WP}/articles/`,               minTier: 'monthly' },
  { key: 'masterclasses',          title: 'Masterclasses',            url: `${WP}/masterclasses/`,          minTier: 'monthly' },
  { key: 'internships',            title: 'Internships',              url: `${WP}/internships/`,            minTier: 'monthly' },
  { key: 'partnerships_discounts', title: 'Partnerships & Discounts', url: `${WP}/partners-and-discounts/`, minTier: 'monthly' },
  { key: 'historical_archive',     title: 'Historical Archive',       url: `${WP}/historical-archive/`,     minTier: 'monthly' },
  { key: 'corr_grants',            title: 'CoRR Grants',              url: `${WP}/research-grants/`,        minTier: 'annual' },
  { key: 'institutional_area',     title: 'Institutional Area',       url: `${WP}/institution-area/`,       minTier: 'institutional' },
  { key: 'feedback',               title: 'Feedback',                 url: `${WP}/feedback/`,               minTier: 'monthly' },
] as const;

/** Paid tiers that satisfy a resource's minimum tier. */
function requiredTiersFor(minTier: MembershipTier): MembershipTier[] {
  return (['monthly', 'annual', 'institutional'] as MembershipTier[]).filter(
    (t) => TIER_RANK[t] >= TIER_RANK[minTier]
  );
}

/** Flat list of resource keys a tier can access. */
export function allowedResourcesForTier(tier: MembershipTier): string[] {
  return PREMIUM_RESOURCE_CATALOG.filter(
    (r) => TIER_RANK[tier] >= TIER_RANK[r.minTier]
  ).map((r) => r.key);
}

/** Build the full catalog with lock state for a tier (mirrors the server shape). */
export function buildPremiumResources(tier: MembershipTier): PremiumResource[] {
  return PREMIUM_RESOURCE_CATALOG.map((r) => {
    const unlocked = TIER_RANK[tier] >= TIER_RANK[r.minTier];
    return {
      key: r.key,
      title: r.title,
      required_tiers: requiredTiersFor(r.minTier),
      unlocked,
      url: unlocked ? r.url : '',
    };
  });
}
