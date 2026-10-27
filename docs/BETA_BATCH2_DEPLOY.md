# Beta batch 2 — WordPress deploy steps

Covers every batch 2 item that needs server code: 2.6, 2.7, 2.10, 2.13, 2.18,
2.20, 2.21, 2.22, 2.23, 2.24, 2.28. All other batch 2 items are app-only.

Upload all three plugins below. Order doesn't matter.

The app changes for these items ship in the app build, but each one depends on
PHP in this repo that has to be uploaded to the live WordPress site. Until it
is, the app falls back to the old behaviour (noted per item), so the upload can
happen before or after the app release.

## 1. `coral-membership` → v1.5 (2.28 resources open signed in — highest priority; 2.20 correct membership level)

Upload **`coral-membership/coral-membership.php`** over
`wp-content/plugins/coral-membership/coral-membership.php` and keep the plugin
active. Nothing to configure.

Adds `POST /wp-json/coral/v1/auth/web-session` and the `?coral_sso=` sign-in
handler. Full design, security notes and a curl check are in
`docs/PAYWALL_IMPLEMENTATION.md` → **A7**.

If a page cache or CDN sits in front of the site, exclude URLs whose query
string contains `coral_sso`.

Also resolves the member's level from all of their PMPro levels
(`pmpro_getMembershipLevelsForUser`, highest-ranked wins) and returns the real
`level_name` + billing cycle from `GET /coral/v1/membership` (2.20). If the
site uses custom level IDs that aren't matched by name, set the
`coral_level_tier_map` option.

*Without it:* resources still open on the website login page (the bug), and
annual members may still show as monthly.

## 1b. `coral-app-checkout` → v1.1 (2.24 "username already taken" on upgrade; 2.23 reCAPTCHA feedback)

Upload the whole **`coral-app-checkout/`** folder (`coral-app-checkout.php` and
`templates/app-checkout.php`) over `wp-content/plugins/coral-app-checkout/`.

Adds `POST /wp-json/coral-checkout/v1/link` (JWT) which returns a one-time,
120-second link that signs the browser into the member's existing account
before PMPro checkout, so upgrades no longer create a new account. The checkout
template now shows a clear error + "Try again" when reCAPTCHA fails or expires.

Exclude URLs containing `coral_checkout_token` and the `/app-checkout/` page
from any page cache/CDN.

*Without it:* the app warns logged-in members to sign in with their existing
account and opens the old checkout URL (the bug remains).

## 2. `coral-social-api` (items 2.6, 2.7, 2.10, 2.13, 2.18, 2.21, 2.22)

Upload the whole **`coral-social-api/`** folder over
`wp-content/plugins/coral-social-api/` (at least `coral-social-api.php` and
everything in `includes/`) and keep the plugin active. Files that are new or
changed in this batch:

| File | Item | Route |
|---|---|---|
| `includes/class-auth-endpoint.php` | 2.22 forgot password | `POST /coral/v1/auth/lost-password` (public) |
| `includes/class-search-endpoint.php` | 2.21 search | `GET /coral/v1/search?q=` |
| `includes/class-messages-endpoint.php` | 2.18 messages | `/coral/v1/messages/threads[/{id}[/read]]` |
| `includes/class-activity-enhancements.php` | 2.6 / 2.7 / 2.10 / 2.13 | emoji images→characters & emoji-safe storage, link previews (`link_preview` field, `_coral_link_preview` meta), share `secondary_item_id` normalization (one-time backfill runs on first wp-admin visit) |
| `coral-social-api.php` | all | loads the three new files |

If the site's JWT plugin blocks unauthenticated REST calls with a whitelist
(e.g. *JWT Auth* by Useful Team → `jwt_auth_whitelist` filter), whitelist
`/wp-json/coral/v1/auth/lost-password`.

*Without it:*
- 2.22 — the native screen shows "isn't available in the app right now" and
  offers the website reset page in the system browser.
- 2.21 — search falls back to WP core `/wp/v2/search` + `/wp/v2/media`
  (misses post types that are not exposed to the REST API, no lock badges).
- 2.18 — the app keeps sending through BuddyPress, i.e. the bug remains.

## Checks after upload

0. **2.20** — `GET /wp-json/coral/v1/membership` for an annual member returns the annual level; the app's profile settings shows it.
0. **2.24** — As a logged-in Basic member, upgrade from the app: checkout shows "signed in as …" with no username fields and the level changes on completion.
0. **2.10 / 2.13** — Post a link from the app: preview shows in the app and on the website. Share a post both ways: the original post is embedded on both sides.

1. **2.28** — In the app, open any unlocked Premium Resource: "Signing you in…"
   then the page, never the login form. Follow a link to another page on the
   site: still signed in. Basic member opening a premium page from search:
   PMPro "members only" message.
2. **2.22** — Sign in → Forgot password → enter an email: "Check your email";
   the reset e-mail arrives. An unknown e-mail shows the same message.
3. **2.21** — Profile → Search CoRR Hub → "Caribbean": pages, posts and PDFs
   with badges; tapping opens them in the app.
4. **2.18** — Send a message from the app to a test account; it appears in the
   recipient's website inbox (Better Messages) and the website reply appears
   in the app. `GET /wp-json/coral/v1/messages/threads` with a JWT returns
   threads (a 501 means Better Messages is not active).

## 2.18 assumptions to verify on the live site

The bridge was written without access to the live Better Messages install:

- Better Messages 2.x tables `{prefix}bm_threads`, `{prefix}bm_message_messages`,
  `{prefix}bm_message_recipients` (columns `thread_id`, `user_id`,
  `unread_count`, `is_deleted`, `sender_id`, `message`, `date_sent`), with
  `date_sent` in GMT. `bm_get_table()` is used when available.
- `Better_Messages()->functions->new_message()` takes BuddyPress-style args
  (`sender_id`, `thread_id` or `recipients` + `subject`, `content`,
  `error_type => 'wp_error'`). The bridge finds the new message by querying
  the table afterwards, so it does not rely on the return value.
- Only private threads (`type = 'thread'`) are listed; group chats and chat
  rooms stay website-only.
- Messages already sent from the app before this change live in BuddyPress'
  tables and will not appear in the Better Messages inbox (or in the app once
  it switches over). Check Better Messages' settings/tools for a BuddyPress
  import if those need to be brought across (not verified).
