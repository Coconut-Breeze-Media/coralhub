# CoralHub Paywall + Stripe Tiers — Developer Implementation Spec

## Context

The client wants the **Premium Resources** dropdown items gated behind paid membership, with **different access per membership tier** (Monthly / Annual / Group-Institutional), and payments processed by **Stripe** — entirely within native WordPress + REST (no Zapier/Make/automation platforms).

The app (Expo/React Native + WordPress/PMPro/BuddyPress backend) today only knows `is_member: true/false`. That is too coarse: e.g. Monthly users must NOT see Mentorships, CoRR Grants, or the Institutional Area; Annual users get Mentorships + CoRR Grants but not the Institutional Area; Institutional gets everything.

**Decisions locked with the client:**
- **Payments:** use **PMPro's built-in native Stripe gateway** (configured in WP admin) — not custom Stripe checkout/webhook code. PMPro already handles checkout, subscriptions, renewals, cancellations, and webhook signature verification.
- **Content delivery:** the 13 resources already exist as pages on the website under "Premium Resources." The app shows a **Premium Resources list**; unlocked items open the existing website page (gated WebView/browser); locked items show an upgrade CTA. No native rebuild of 13 content types.
- **Tier mapping:** make it **configurable** (the client is unsure which PMPro levels exist — see below), with a sensible name-based fallback.

### Confirmed: the four PMPro levels (IDs + pricing)
Verified from PMPro admin (Memberships → Settings → Levels). Users can hold only one level from this group.

| ID | PMPro level name    | Cost              | App tier        | Notes |
|----|---------------------|-------------------|-----------------|-------|
| 6  | Basic Membership    | Free              | `none`          | Free/community level, no paywall access |
| 2  | Monthly Membership  | $4.99 per Month   | `monthly`       |       |
| 1  | Annual Membership   | $49.99 per Year   | `annual`        |       |
| 3  | Group Membership    | $199.99 per Year  | `institutional` | The institutional tier — named "Group", **not** "Institutional" |

So `coral_level_tier_map` is: `{ "1": "annual", "2": "monthly", "3": "institutional", "6": "none" }`.

> ⚠️ The name-prefix fallback must map first word **`group` → `institutional`** (and `basic` → `none`). Do not assume a level literally named "Institutional" exists. Authoritative mapping is by ID via `coral_level_tier_map`; the name fallback is only a safety net.

---

## Canonical access model (single source of truth)

Tier hierarchy: `none` → `monthly` → `annual` → `institutional` (each tier inherits all lower-tier resources).

```
RESOURCE KEY            monthly  annual  institutional
opportunities             ✓        ✓         ✓
courses                   ✓        ✓         ✓
document_library          ✓        ✓         ✓
coral_matters             ✓        ✓         ✓
essays_articles           ✓        ✓         ✓
masterclasses             ✓        ✓         ✓
internships               ✓        ✓         ✓
partnerships_discounts    ✓        ✓         ✓
historical_archive        ✓        ✓         ✓
feedback                  ✓        ✓         ✓
mentorships                        ✓         ✓
corr_grants                        ✓         ✓
institutional_area                           ✓
```
Dashboard is intentionally excluded from the app (per client).

This map is defined **once** in the WordPress plugin and **re-derived** in the app from the API response (the app never hardcodes who-gets-what; it trusts `allowed_resources` from the server).

---

## Part A — WordPress (the real paywall)

All changes go in the existing plugin file **`coral-membership/coral-membership.php`** (currently v1.3). No new plugin needed.

### A1. Switch PMPro to the Stripe gateway (admin, no code) — ⚠️ this is a gateway MIGRATION
**Current state:** the site is live on **PayPal Express** (Gateway Environment: Live/Production), not Stripe.

WP Admin → Memberships → Settings → **Payment Gateway & SSL** → select **Stripe**, connect the account, enter live keys. Then for each paid level (Monthly, Annual, Group) set the recurring price and billing cycle. PMPro creates/manages the Stripe subscription and updates the user's level automatically on payment success/failure/cancellation. **No checkout-session or webhook code is written by us** — this is the whole point of choosing the PMPro gateway.

**Migration implications (decide before flipping the switch):**
- PMPro uses **one global gateway at a time**. Setting it to Stripe means all *new* checkouts go through Stripe.
- **Existing PayPal Express subscribers keep being billed by PayPal** — their recurring subscriptions do **not** transfer to Stripe automatically. They continue on PayPal until they cancel/expire, or are manually migrated.
- The four levels (Annual, Monthly, Group, Basic) **already exist** — do not recreate them. You only need to attach Stripe prices/billing to the three paid ones and grab their IDs.
- Recommended: test in Stripe test mode + PMPro on a staging copy before switching the live gateway, and have a plan for communicating the change to current PayPal subscribers.

### A2. Tier mapping config + helper
Add a configurable map from PMPro level ID → tier, stored as a WP option `coral_level_tier_map` (editable later without code). The IDs are known: `{ "1": "annual", "2": "monthly", "3": "institutional", "6": "none" }`. Provide a helper `coral_get_user_tier($user_id)`:
1. Get the user's active PMPro level via `pmpro_getMembershipLevelForUser($user_id)`.
2. If its ID is in `coral_level_tier_map`, return that tier.
3. Else fall back to first word of the level name: `annual`→`annual`, `monthly`→`monthly`, **`group`→`institutional`**, `basic`→`none`.
4. No active paid level → `none`.

Expose the map via a `coral_level_tier_map` filter too, so it can be overridden in code if preferred over the option.

### A3. Resource→tier map + helper
Define the canonical map (above) as a PHP array constant/function `coral_resource_tier_requirements()` returning `key => [required tiers]`, and `coral_allowed_resources_for_tier($tier)` returning the flat list of resource keys that tier can access (applying the hierarchy). This is the single source of truth.

### A4. Expand `GET /coral/v1/membership`
Replace the current bare `{ is_member }` response (`coral-membership.php` ~line 101) with:
```json
{
  "is_member": true,
  "user_id": 123,
  "tier": "monthly",
  "level_id": 2,
  "level_name": "Monthly",
  "allowed_resources": ["opportunities","courses","document_library", "..."],
  "subscription_status": "active",
  "expires_at": null
}
```
- `tier` from `coral_get_user_tier()`; `allowed_resources` from `coral_allowed_resources_for_tier($tier)`.
- Keep `is_member` for backward compatibility (`tier !== 'none'`).
- Keep the existing MemberPress/role fallbacks but route them through the tier helper.
- Keep `permission_callback => '__return_true'` (JWT validated upstream); when not logged in, return `tier: "none"`, `allowed_resources: []`.

### A5. New `GET /coral/v1/premium-resources` (protected)
Returns the full catalog with lock state + the website URL to open, computed against the caller's tier:
```json
{
  "resources": [
    { "key": "opportunities", "title": "Opportunities",
      "required_tiers": ["monthly","annual","institutional"],
      "unlocked": true,
      "url": "https://www.thecoralreefresearchhub.com/opportunities/" }
  ]
}
```
- Resource `key → title → website page URL` map lives here (the developer fills in the real page slugs/URLs for each of the 13 items; get these from the client's "Premium Resources" menu). Store URLs as a `coral_resource_urls` option so they're editable without code.
- `unlocked = in_array(key, allowed_resources_for_callers_tier)`.
- For locked resources, return metadata only (title, required_tiers, unlocked:false) — **never the content**.

### A6. Server-side enforcement (critical — the lock must be real)
The app lock is UX only. Real enforcement lives on the **website pages**:
- Each Premium Resource page must already be (or be) restricted in **PMPro per level** so that hitting the URL without the right level shows PMPro's "members only" page. Verify/assign level restrictions for all 13 pages, matching the access table above (Mentorships/CoRR Grants → Annual+Institutional; Institutional Area → Institutional only).
- This is existing PMPro page-restriction config (WP Admin → edit page → "Require Membership" box), not new code.

### A7. WebView session bridge (auto-login) — required for the gated-WebView UX to work
The app authenticates with a **JWT**; the website enforces access with a **WordPress cookie session**. Opening a restricted page in a WebView would otherwise show "members only" even for paid users, because the WebView has no WP cookie.
- Add `POST /coral/v1/app-login-link` (protected by JWT). It mints a short-lived, single-use token for the current user and returns a URL like `https://site/app-sso?token=...&redirect=<resource_url>`.
- Add a tiny front-end handler (a `template_redirect` hook or mu-plugin route at `/app-sso`) that validates the one-use token, calls `wp_set_auth_cookie($user_id)`, then 302-redirects to `redirect`. Tokens expire in ~60s and are deleted on use.
- The app calls this endpoint when opening any unlocked resource and loads the returned URL in the WebView, so the user lands authenticated.
- Security: bind token to user ID, store hashed in a transient, enforce single use + short TTL, and only allow same-origin `redirect` targets.

> If the client prefers to avoid the SSO bridge, the fallback is: the WebView shows the website's normal login once and the cookie persists. Recommend the SSO bridge for a seamless UX. Flag this for client sign-off.

---

## Part B — Expo app

### B0. Pre-req: fix the current compile blockers (independent of this feature)
- `node_modules` is stale — run `npm install` (declared deps `@tanstack/react-query`, `expo-notifications`, `expo-image-picker` are missing locally).
- `lib/auth.tsx` ~line 103: `MembershipResp` → `MembershipResponse`.
- `app/(auth)/membership-levels.tsx` line 14: `MembershipLevel` is imported from `../../lib/api` but is only a `type` there — import it from `../../types` (or add a re-export in `lib/api.ts`).
- Verify with `node node_modules/typescript/bin/tsc --noEmit` (the `.bin/tsc` shim is broken in this checkout).

### B1. Types — `types/index.ts`
Extend `MembershipResponse` (currently lines ~23-27) and add a tier type:
```ts
export type MembershipTier = 'none' | 'monthly' | 'annual' | 'institutional';

export interface MembershipResponse {
  is_member: boolean;
  user_id?: number;
  tier: MembershipTier;
  level_id?: number;
  level_name?: string;
  allowed_resources: string[];
  subscription_status?: string;
  expires_at?: string | null;
  roles?: string[];
}

export interface PremiumResource {
  key: string;
  title: string;
  required_tiers: MembershipTier[];
  unlocked: boolean;
  url: string;
}
```
Update `AuthContextState` (~lines 258-268) to carry `membership: MembershipResponse | null` (keep `isMember` as a derived convenience).

### B2. API client — `lib/api.ts`
- `getMembershipStatus` already targets `/coral/v1/membership` (line ~117) — its return type now picks up the richer shape automatically.
- Add `getPremiumResources(token): Promise<PremiumResource[]>` → `GET /coral/v1/premium-resources` via the existing `authedFetch` helper.
- Add `getAppLoginLink(token, redirectUrl): Promise<{ url: string }>` → `POST /coral/v1/app-login-link`.
- (Optional cleanup) re-export `MembershipLevel` from `lib/api.ts` to satisfy existing imports.

### B3. Auth context — `lib/auth.tsx`
- Store the full `membership` object from `getMembershipStatus`, not just `isMember`.
- `refreshMembership()` stays the same call; just persist the whole response. Derive `isMember = membership?.tier !== 'none'`.
- Expose a helper `canAccess(resourceKey): boolean` = `membership?.allowed_resources.includes(resourceKey)`.

### B4. Premium Resources screen — replace placeholder `app/(tabs)/resources.tsx`
- Fetch via `getPremiumResources(token)` (React Query hook in `hooks/useQueries.ts`, following existing patterns).
- Render the 13 items (NO Dashboard). Each row shows title + lock state:
  - **Unlocked:** tap → call `getAppLoginLink(token, resource.url)` → open returned URL in WebView (`expo-web-browser` `openBrowserAsync`, or `react-native-webview` screen). The existing app already uses `Linking.openURL` for external URLs (`membership-levels.tsx` line 202).
  - **Locked:** show a lock icon + tap → navigate to `app/(auth)/membership-levels` (upgrade CTA), optionally pre-highlighting the lowest tier that unlocks it (from `required_tiers`).
- **Institutional Area** appears in the list but is only `unlocked` for institutional users (server already returns this); locked for everyone else.
- Drive lock purely from `resource.unlocked` / `allowed_resources` returned by the server — do not hardcode the access table in the app.

### B5. Checkout flow (minor)
Keep the existing levels screen (`app/(auth)/membership-levels.tsx`) and its `Linking.openURL(checkout_url)` — the `checkout_url` already points at the PMPro app-checkout page, which now runs the Stripe gateway. After the WebView/browser checkout returns to the app, call `refreshMembership()` (e.g. on screen focus / app foreground) so the new tier and `allowed_resources` load.

### B6. Navigation/icons (small fixes noted during exploration)
In `constants/navigation.ts` the Resources/Networking tab icons appear swapped (Resources uses a people icon, Networking a book icon). Fix while touching this area.

---

## Part C — Config / env
- WordPress: Stripe keys live in PMPro settings (DB), not in the repo. Options added: `coral_level_tier_map`, `coral_resource_urls` (and optionally `coral_resource_tier_requirements` if you want it admin-editable).
- App `.env`: no new vars strictly required. If a WebView landing/return scheme is needed, reuse the existing `coralhub` deep-link scheme (already set in `app.config.js`).

---

## Verification (end-to-end)

**Backend (curl with a real JWT per tier):**
1. `GET /wp-json/coral/v1/levels` → confirms level IDs/names to fill `coral_level_tier_map`.
2. `GET /wp-json/coral/v1/membership` for a Monthly user → `tier:"monthly"`, `allowed_resources` excludes `mentorships`, `corr_grants`, `institutional_area`.
3. Same for Annual → includes `mentorships`+`corr_grants`, excludes `institutional_area`. Institutional → includes all.
4. `GET /wp-json/coral/v1/premium-resources` per tier → `unlocked` flags match the access table.
5. Hit a restricted website page URL directly **without** the right level → PMPro "members only" (proves server-side enforcement, A6).
6. `POST /coral/v1/app-login-link` → returns URL; loading it lands the user authenticated on the resource; reusing the token fails (single-use).

**App (run via Expo on a tier test account):**
1. `npm install` then `node node_modules/typescript/bin/tsc --noEmit` passes.
2. Premium Resources tab shows 13 items, no Dashboard; lock badges match the account's tier.
3. Locked item → upgrade screen; unlocked item → opens the page authenticated.
4. Complete a Stripe checkout (test mode), return to app → `refreshMembership()` flips the newly-purchased resources to unlocked.

**Acceptance criteria:**
- Monthly cannot access Mentorships, CoRR Grants, Institutional Area.
- Annual can access Mentorships + CoRR Grants, not Institutional Area.
- Institutional accesses everything.
- Logged-out / wrong-tier users cannot load protected content even by direct URL (PMPro enforces).
- Stripe (via PMPro) updates access automatically on payment/cancellation — no manual admin step, no automation platform.

---

## Resource page URLs (client-provided, wired into `coral_resource_urls` defaults)

| Resource key            | URL |
|-------------------------|-----|
| opportunities           | https://www.thecoralreefresearchhub.com/career-opportunities/ |
| courses                 | https://www.thecoralreefresearchhub.com/courses/ |
| mentorships             | https://www.thecoralreefresearchhub.com/mentorships/ |
| document_library        | https://www.thecoralreefresearchhub.com/document-library/ |
| coral_matters           | https://www.thecoralreefresearchhub.com/coralmatters/ |
| essays_articles         | https://www.thecoralreefresearchhub.com/articles/ |
| masterclasses           | https://www.thecoralreefresearchhub.com/masterclasses/ |
| internships             | https://www.thecoralreefresearchhub.com/internships/ |
| partnerships_discounts  | https://www.thecoralreefresearchhub.com/partners-and-discounts/ |
| historical_archive      | https://www.thecoralreefresearchhub.com/historical-archive/ |
| corr_grants             | https://www.thecoralreefresearchhub.com/research-grants/ |
| institutional_area      | https://www.thecoralreefresearchhub.com/institution-area/ |
| feedback                | ⚠️ **not provided** — placeholder `/feedback/`, confirm real URL |

(Dashboard — `/dashboard/` — is intentionally excluded from the app per client.)

## Open items needing client input
1. **Feedback page URL** — the only resource without a confirmed URL. Set it in the `coral_resource_urls` option (or update the default).
2. **Gateway migration decision (PayPal Express → Stripe):** the site currently bills via PayPal Express. Confirm we should switch PMPro's gateway to Stripe, provide **live Stripe keys**, and decide how existing PayPal subscribers are handled (let them ride out PayPal, or migrate). Levels and pricing are already set — Monthly $4.99/mo (ID 2), Annual $49.99/yr (ID 1), Group $199.99/yr (ID 3), Basic free (ID 6); the three paid ones just need their Stripe gateway/price wiring once Stripe is connected.
3. Sign-off on the **SSO/auto-login WebView bridge** (A7) vs. requiring a one-time website login inside the WebView.
