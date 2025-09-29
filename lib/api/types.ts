/**
 * types.ts
 * -----------------------------------------------------------------------------
 * Purpose
 *  - Centralized type definitions for WordPress + BuddyPress API payloads.
 *  - Separate raw API payloads from normalized app-facing shapes.
 *  - Encourage strong typing for safer component usage.
 * -----------------------------------------------------------------------------
 */

/** Generic WP "rendered" field */
export type RenderedField = { rendered: string };

/* ──────────────────────────────────
   Auth / Membership
────────────────────────────────── */
export type JWTPayload = {
  token: string;
  user_email: string;
  user_nicename: string;
  user_display_name: string;
};

export type MembershipResp = {
  is_member: boolean;
  user_id?: number;
  roles?: string[];
};

/* ──────────────────────────────────
   WordPress Content
────────────────────────────────── */
export type WPPage = {
  id: number;
  slug: string;
  content: RenderedField;
};

export type WPPost = {
  id: number;
  date: string;
  title: RenderedField;
  excerpt?: RenderedField;
  _embedded?: any; // TODO: refine if you use it
};

export type WPUserMe = {
  id: number;
  name: string;
  email?: string;
  username?: string;
  roles?: string[];
};

/* ──────────────────────────────────
   BuddyPress
────────────────────────────────── */

/** Raw BP activity item from API */
export type BPActivity = {
  id: number;
  user_id: number;
  component: string; // could refine: 'activity' | 'groups' | ...
  type: string;      // e.g. 'activity_update' | 'activity_comment'
  date: string;
  content?: RenderedField | string;
  meta?: Record<string, any>;
};

/** Normalized member object */
export type BPMember = {
  id: number;
  name?: string;
  avatar_urls?: {
    full?: string;
    thumb?: string;
  };
};

/** App-facing normalized activity item */
export type ActivityItem = {
  id: number;
  user_id: number;
  date: string;      // ISO
  html: string;      // sanitized HTML
  favorited?: boolean;
  favorite_count?: number;
  comment_count?: number;
};