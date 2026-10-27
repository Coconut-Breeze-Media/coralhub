<?php
/**
 * Plugin Name: Coral Membership API
 * Description: Exposes REST API endpoints used by the mobile app (membership check + membership levels + tiered premium-resource access + app-to-website session handoff).
 * Version: 1.5
 * Author: Coral Reef Research Hub
 */

///////////////////////////////////////////////
// Minimal checkout page URL (app-only view) //
///////////////////////////////////////////////
function coral_app_checkout_base_url() {
  // Try to find a page with slug "app-checkout"
  if (function_exists('get_page_by_path')) {
    $p = get_page_by_path('app-checkout');
    if ($p) {
      $url = get_permalink($p);
      if ($url) return $url;
    }
  }

  return home_url('/app-checkout/');
}


// ---------------------------------------------
// Helper: fetch benefits ONLY from WP (ACF/Option)
// ---------------------------------------------
if (!function_exists('coral_membership_get_benefits')) {
  /**
   * Resolve benefits from (in order): ACF repeater, ACF textarea, WP option.
   * Returns an array of strings. If nothing is set, returns [].
   *
   * ACF scope: "pmpro_level_{ID}"
   *  - Repeater field: benefits (rows with 'text')
   *  - Textarea field: benefits_text (newline-separated)
   *
   * WP Option fallback:
   *  - option_name = "coral_benefits_{ID}" (newline-separated)
   */
  function coral_membership_get_benefits($level_id) {
    $benefits = [];

    // --- ACF (repeater / textarea) ---
    if (function_exists('get_field')) {
      $scope = 'pmpro_level_' . intval($level_id);

      // Repeater: benefits -> row['text']
      $rep = get_field('benefits', $scope);
      if (is_array($rep)) {
        foreach ($rep as $row) {
          $txt = '';
          if (is_array($row) && isset($row['text'])) {
            $txt = wp_strip_all_tags($row['text']);
          } elseif (is_string($row)) {
            $txt = wp_strip_all_tags($row);
          }
          $txt = trim($txt);
          if ($txt !== '') {
            $benefits[] = $txt;
          }
        }
      }

      // Textarea: benefits_text (newline-separated)
      if (empty($benefits)) {
        $txt = get_field('benefits_text', $scope);
        if (is_string($txt) && trim($txt) !== '') {
          $lines = preg_split('/\r\n|\r|\n/', $txt);
          foreach ($lines as $line) {
            $line = trim(wp_strip_all_tags($line));
            if ($line !== '') {
              $benefits[] = $line;
            }
          }
        }
      }
    }

    // --- WP Option (newline-separated) ---
    if (empty($benefits)) {
      $opt = get_option('coral_benefits_' . intval($level_id));
      if (is_string($opt) && trim($opt) !== '') {
        $lines = preg_split('/\r\n|\r|\n/', $opt);
        foreach ($lines as $line) {
          $line = trim(wp_strip_all_tags($line));
          if ($line !== '') {
            $benefits[] = $line;
          }
        }
      }
    }

    return array_values($benefits);
  }
}

// ===================================================
// Tier + premium-resource access model
// (single source of truth — mirrored by the mobile app)
// ===================================================

/**
 * Map of PMPro level ID → app tier.
 * Authoritative. Editable in WP admin via option 'coral_level_tier_map'
 * (array of level_id => tier), or via the 'coral_level_tier_map' filter.
 *
 * Confirmed live levels:
 *   1 = Annual Membership   → annual
 *   2 = Monthly Membership  → monthly
 *   3 = Group Membership    → institutional
 *   6 = Basic Membership    → none (free/community)
 */
if (!function_exists('coral_level_tier_map')) {
  function coral_level_tier_map() {
    $default = [
      1 => 'annual',
      2 => 'monthly',
      3 => 'institutional',
      6 => 'none',
    ];

    $opt = get_option('coral_level_tier_map');
    if (is_array($opt) && !empty($opt)) {
      $map = [];
      foreach ($opt as $k => $v) {
        $map[(int) $k] = (string) $v;
      }
      $default = $map;
    }

    return apply_filters('coral_level_tier_map', $default);
  }
}

/** Numeric rank for tier hierarchy: none < monthly < annual < institutional. */
if (!function_exists('coral_tier_rank')) {
  function coral_tier_rank($tier) {
    $order = ['none' => 0, 'monthly' => 1, 'annual' => 2, 'institutional' => 3];
    return isset($order[$tier]) ? $order[$tier] : 0;
  }
}

/**
 * resource_key → minimum tier required (hierarchy applies, so a higher tier
 * also unlocks everything a lower tier can access). Editable via filter.
 */
if (!function_exists('coral_resource_tier_requirements')) {
  function coral_resource_tier_requirements() {
    return apply_filters('coral_resource_tier_requirements', [
      'opportunities'          => 'monthly',
      'courses'                => 'monthly',
      'document_library'       => 'monthly',
      'coral_matters'          => 'monthly',
      'essays_articles'        => 'monthly',
      'masterclasses'          => 'monthly',
      'internships'            => 'monthly',
      'partnerships_discounts' => 'monthly',
      'historical_archive'     => 'monthly',
      'feedback'               => 'monthly',
      'mentorships'            => 'annual',
      'corr_grants'            => 'annual',
      'institutional_area'     => 'institutional',
    ]);
  }
}

/** Display order of resources in the app (Dashboard intentionally excluded). */
if (!function_exists('coral_resource_order')) {
  function coral_resource_order() {
    return apply_filters('coral_resource_order', [
      'opportunities',
      'courses',
      'mentorships',
      'document_library',
      'coral_matters',
      'essays_articles',
      'masterclasses',
      'internships',
      'partnerships_discounts',
      'historical_archive',
      'corr_grants',
      'institutional_area',
      'feedback',
    ]);
  }
}

/** resource_key → human title. */
if (!function_exists('coral_resource_titles')) {
  function coral_resource_titles() {
    return apply_filters('coral_resource_titles', [
      'opportunities'          => 'Opportunities',
      'courses'                => 'Training Courses',
      'mentorships'            => 'Mentorships',
      'document_library'       => 'Document Library',
      'coral_matters'          => 'Coral Matters',
      'essays_articles'        => 'Essays and Articles',
      'masterclasses'          => 'Masterclasses',
      'internships'            => 'Internships',
      'partnerships_discounts' => 'Partnerships and Discounts',
      'historical_archive'     => 'Historical Archive',
      'corr_grants'            => 'CoRR Grants',
      'institutional_area'     => 'Institutional Area',
      'feedback'               => 'Feedback',
    ]);
  }
}

/**
 * resource_key → website page URL the app opens for that resource.
 * Defaults use best-guess slugs on the main site. Override in WP admin via
 * option 'coral_resource_urls' (array of resource_key => full URL) — no code
 * change needed — or via the 'coral_resource_urls' filter.
 */
if (!function_exists('coral_resource_urls')) {
  function coral_resource_urls() {
    // Client-provided live URLs (Dashboard is intentionally excluded from the app).
    $defaults = [
      'opportunities'          => home_url('/career-opportunities/'),
      'courses'                => home_url('/courses/'),
      'mentorships'            => home_url('/mentorships/'),
      'document_library'       => home_url('/document-library/'),
      'coral_matters'          => home_url('/coralmatters/'),
      'essays_articles'        => home_url('/articles/'),
      'masterclasses'          => home_url('/masterclasses/'),
      'internships'            => home_url('/internships/'),
      'partnerships_discounts' => home_url('/partners-and-discounts/'),
      'historical_archive'     => home_url('/historical-archive/'),
      'corr_grants'            => home_url('/research-grants/'),
      'institutional_area'     => home_url('/institution-area/'),
      'feedback'               => home_url('/feedback/'),
    ];

    $opt = get_option('coral_resource_urls');
    if (is_array($opt)) {
      // Only override keys that are actually set (non-empty).
      foreach ($opt as $k => $v) {
        if (is_string($v) && trim($v) !== '') {
          $defaults[$k] = esc_url_raw($v);
        }
      }
    }

    return apply_filters('coral_resource_urls', $defaults);
  }
}

/** Tiers (excluding 'none') that satisfy a resource's minimum tier. */
if (!function_exists('coral_required_tiers_for_resource')) {
  function coral_required_tiers_for_resource($min_tier) {
    $min_rank = coral_tier_rank($min_tier);
    $out = [];
    foreach (['monthly', 'annual', 'institutional'] as $t) {
      if (coral_tier_rank($t) >= $min_rank) {
        $out[] = $t;
      }
    }
    return $out;
  }
}

/** Flat list of resource keys a given tier can access (applies hierarchy). */
if (!function_exists('coral_allowed_resources_for_tier')) {
  function coral_allowed_resources_for_tier($tier) {
    $rank = coral_tier_rank($tier);
    $out = [];
    foreach (coral_resource_tier_requirements() as $key => $min_tier) {
      if ($rank >= coral_tier_rank($min_tier)) {
        $out[] = $key;
      }
    }
    return array_values($out);
  }
}

/**
 * Resolve the app tier for a user.
 *  1. PMPro active level → coral_level_tier_map (by ID).
 *  2. Fallback: first word of the level name (group → institutional).
 *  3. MemberPress / capability fallbacks → lowest paid tier.
 *  4. Otherwise 'none'.
 */
if (!function_exists('coral_get_user_tier')) {
  function coral_get_user_tier($user_id) {
    if (!$user_id) return 'none';

    if (function_exists('pmpro_getMembershipLevelForUser')) {
      $level = pmpro_getMembershipLevelForUser($user_id);
      if ($level) {
        $lid = (int) (!empty($level->id) ? $level->id : (!empty($level->ID) ? $level->ID : 0));
        $map = coral_level_tier_map();
        if ($lid && isset($map[$lid])) {
          return $map[$lid];
        }
        // Name-prefix safety net.
        $first = strtolower(trim(strtok((string) (isset($level->name) ? $level->name : ''), ' ')));
        $name_map = [
          'annual'        => 'annual',
          'monthly'       => 'monthly',
          'group'         => 'institutional',
          'institutional' => 'institutional',
          'basic'         => 'none',
        ];
        if ($first !== '' && isset($name_map[$first])) {
          return $name_map[$first];
        }
      }
    }

    if (class_exists('\MeprUser')) {
      $u = new \MeprUser($user_id);
      if ($u->is_active()) return 'monthly';
    }

    if (user_can($user_id, 'read_private_pages')) return 'monthly';

    return 'none';
  }
}

// ---------------------------------------------------
// /coral/v1/membership  → tier + allowed_resources
// ---------------------------------------------------
add_action('rest_api_init', function () {
  register_rest_route('coral/v1', '/membership', [
    'methods'  => 'GET',
    'callback' => function (WP_REST_Request $request) {
      $user_id = get_current_user_id();
      if (!$user_id) {
        return new WP_REST_Response([
          'is_member'         => false,
          'tier'              => 'none',
          'allowed_resources' => [],
          'reason'            => 'not_logged_in',
        ], 200);
      }

      $tier    = coral_get_user_tier($user_id);
      $allowed = coral_allowed_resources_for_tier($tier);

      // Best-effort level details for display / debugging.
      $level_id   = null;
      $level_name = null;
      $status     = ($tier !== 'none') ? 'active' : 'inactive';
      $expires_at = null;

      if (function_exists('pmpro_getMembershipLevelForUser')) {
        $level = pmpro_getMembershipLevelForUser($user_id);
        if ($level) {
          $level_id   = (int) (!empty($level->id) ? $level->id : (!empty($level->ID) ? $level->ID : 0));
          $level_name = isset($level->name) ? $level->name : null;
          if (!empty($level->enddate)) {
            $expires_at = is_numeric($level->enddate)
              ? gmdate('c', (int) $level->enddate)
              : (string) $level->enddate;
          }
        }
      }

      return new WP_REST_Response([
        'is_member'           => ($tier !== 'none'),
        'user_id'             => (int) $user_id,
        'tier'                => $tier,
        'level_id'            => $level_id,
        'level_name'          => $level_name,
        'allowed_resources'   => $allowed,
        'subscription_status' => $status,
        'expires_at'          => $expires_at,
      ], 200);
    },
    'permission_callback' => '__return_true',
  ]);
});


// ---------------------------------------------------
// /coral/v1/levels  → { levels: [...] }  (public)
// Shows recurring amount as the big price if present.
// ---------------------------------------------------
add_action('rest_api_init', function () {
  register_rest_route('coral/v1', '/levels', [
    'methods'  => 'GET',
    'callback' => function () {
      if (!function_exists('pmpro_getAllLevels')) {
        return new WP_REST_Response(['levels' => []], 200);
      }

      $levels = pmpro_getAllLevels(true, true);
      $out = [];

      // Resolve the minimal checkout page once
      $minimal_base = coral_app_checkout_base_url(); // e.g. https://site.com/app-checkout/

      foreach ($levels as $lvl) {
        // Price to show big (prefer recurring)
        $amount_for_badge = ($lvl->billing_amount > 0) ? $lvl->billing_amount : $lvl->initial_payment;
        $price = '$' . number_format((float)$amount_for_badge, 2);

        // Note text
        if ($lvl->billing_amount > 0 && !empty($lvl->cycle_number) && !empty($lvl->cycle_period)) {
          $note = sprintf('$%s per %s.', number_format((float)$lvl->billing_amount, 2), ucfirst($lvl->cycle_period));
        } elseif ((float)$lvl->initial_payment === 0.0) {
          $note = 'Free';
        } else {
          $note = sprintf('One-time $%s.', number_format((float)$lvl->initial_payment, 2));
        }

        // Build checkout URL, preferring the minimal page
        $checkout_url = add_query_arg(
          'level',
          (int) $lvl->id,
          $minimal_base ?: pmpro_url('checkout')
        );

        $out[] = [
          'id'               => (int) $lvl->id,
          'name'             => $lvl->name,
          'price'            => $price,
          'note'             => $note,
          'description'      => wp_strip_all_tags($lvl->description),
          'benefits'         => coral_membership_get_benefits($lvl->id),
          'checkout_url'     => $checkout_url,

          // Raw fields if needed client-side
          'recurring_amount' => (float) $lvl->billing_amount,
          'initial_payment'  => (float) $lvl->initial_payment,
          'cycle_period'     => $lvl->cycle_period,
          'cycle_number'     => (int) $lvl->cycle_number,
        ];
      }

      return new WP_REST_Response(['levels' => array_values($out)], 200);
    },
    'permission_callback' => '__return_true',
  ]);
});


// ---------------------------------------------------------
// /coral/v1/premium-resources  (protected)
// Full catalog with per-user lock state. Locked items never
// expose a content URL.
// ---------------------------------------------------------
add_action('rest_api_init', function () {
  register_rest_route('coral/v1', '/premium-resources', [
    'methods'  => 'GET',
    'callback' => function () {
      $user_id = get_current_user_id();
      $tier    = $user_id ? coral_get_user_tier($user_id) : 'none';
      $allowed = coral_allowed_resources_for_tier($tier);

      $titles = coral_resource_titles();
      $urls   = coral_resource_urls();
      $reqs   = coral_resource_tier_requirements();

      $resources = [];
      foreach (coral_resource_order() as $key) {
        $min_tier = isset($reqs[$key]) ? $reqs[$key] : 'monthly';
        $unlocked = in_array($key, $allowed, true);

        $resources[] = [
          'key'            => $key,
          'title'          => isset($titles[$key]) ? $titles[$key] : $key,
          'required_tiers' => coral_required_tiers_for_resource($min_tier),
          'unlocked'       => $unlocked,
          // Only expose the destination URL when the caller may access it.
          'url'            => ($unlocked && isset($urls[$key])) ? $urls[$key] : '',
        ];
      }

      return new WP_REST_Response([
        'tier'      => $tier,
        'resources' => $resources,
      ], 200);
    },
    'permission_callback' => function () {
      return is_user_logged_in();
    },
  ]);
});


// ---------------------------------------------------------
// App → website session handoff (SSO bridge)
//
// The app authenticates REST calls with a JWT, but the website
// enforces page access (PMPro restrictions, members-only pages)
// with the normal WordPress login cookie. The in-app WebView has
// no such cookie, so without this bridge every resource opens on
// the website login form.
//
// Flow:
//   1. App → POST /wp-json/coral/v1/auth/web-session  (Bearer JWT)
//      body: { redirect_to: "<same-site resource URL>" }
//      ← { url: "https://site/?coral_sso=<uid>.<secret>&redirect_to=…",
//          expires_in: 60 }
//   2. WebView loads that URL. On `init` the token is verified and
//      consumed, the WordPress auth cookie is set for that user, and
//      the browser is sent on to the resource. PMPro's own page
//      restrictions then apply normally (premium vs basic).
//
// Security properties:
//   - 256-bit random secret; only an HMAC of it is stored.
//   - Stored in a transient keyed to the user id → one active token
//     per user (minting a new one revokes the previous one).
//   - 60-second TTL, single use (deleted on first successful use;
//     delete_transient() must succeed, so two racing requests cannot
//     both log in).
//   - Constant-time compare (hash_equals).
//   - Redirect target must be on this site's host (www/non-www) —
//     never an open redirect.
//   - Minting is rate limited per user.
//   - The token is never written to logs, and the handoff response
//     sends no-store + no-referrer so it cannot leak via cache or
//     Referer headers.
// ---------------------------------------------------------

if (!defined('CORAL_SSO_TTL')) {
  define('CORAL_SSO_TTL', 60);
}
if (!defined('CORAL_SSO_MINT_LIMIT')) {
  // Max handoff URLs a single user may request per window.
  define('CORAL_SSO_MINT_LIMIT', 30);
}
if (!defined('CORAL_SSO_MINT_WINDOW')) {
  define('CORAL_SSO_MINT_WINDOW', 5 * MINUTE_IN_SECONDS);
}

/** Strip a leading "www." so www/non-www count as the same site. */
if (!function_exists('coral_sso_bare_host')) {
  function coral_sso_bare_host($host) {
    return preg_replace('/^www\./', '', strtolower((string) $host));
  }
}

/**
 * Return $url if it is an absolute http(s) URL on this site's host,
 * otherwise ''. Any coral_sso parameter is removed so a target can never
 * loop back into the handoff.
 */
if (!function_exists('coral_sso_same_site_url')) {
  function coral_sso_same_site_url($url) {
    if (!is_string($url) || $url === '') return '';
    $url = esc_url_raw(trim($url), ['http', 'https']);
    if ($url === '') return '';

    $parts = wp_parse_url($url);
    if (!is_array($parts) || empty($parts['host']) || empty($parts['scheme'])) return '';
    if (!in_array(strtolower($parts['scheme']), ['http', 'https'], true)) return '';
    // user:pass@host tricks are never legitimate here.
    if (isset($parts['user']) || isset($parts['pass'])) return '';

    $home_host = wp_parse_url(home_url(), PHP_URL_HOST);
    if (!$home_host || coral_sso_bare_host($parts['host']) !== coral_sso_bare_host($home_host)) {
      return '';
    }

    return remove_query_arg('coral_sso', $url);
  }
}

if (!function_exists('coral_sso_transient_key')) {
  function coral_sso_transient_key($user_id) {
    return 'coral_sso_u_' . (int) $user_id;
  }
}

if (!function_exists('coral_sso_hash')) {
  function coral_sso_hash($secret) {
    // Keyed with the site's auth salt so a leaked options table alone is
    // not enough to forge a token.
    return hash_hmac('sha256', (string) $secret, wp_salt('auth'));
  }
}

/**
 * Per-user mint rate limit (fixed window).
 * @return true|WP_Error
 */
if (!function_exists('coral_sso_check_mint_rate')) {
  function coral_sso_check_mint_rate($user_id) {
    $key   = 'coral_sso_rl_' . (int) $user_id;
    $state = get_transient($key);
    $now   = time();

    if (!is_array($state) || empty($state['reset']) || $state['reset'] <= $now) {
      $state = ['count' => 0, 'reset' => $now + CORAL_SSO_MINT_WINDOW];
    }

    if ($state['count'] >= CORAL_SSO_MINT_LIMIT) {
      return new WP_Error(
        'coral_sso_rate_limited',
        'Too many requests. Please wait a moment and try again.',
        ['status' => 429]
      );
    }

    $state['count']++;
    set_transient($key, $state, max(1, $state['reset'] - $now));
    return true;
  }
}

/**
 * Mint a single-use handoff token for $user_id and return the URL that
 * consumes it. Replaces any token the user already had.
 */
if (!function_exists('coral_sso_issue_url')) {
  function coral_sso_issue_url($user_id, $redirect) {
    $user_id = (int) $user_id;

    try {
      $secret = bin2hex(random_bytes(32));
    } catch (Exception $e) {
      $secret = strtolower(wp_generate_password(64, false, false));
      $secret = substr(hash('sha256', $secret . wp_rand()), 0, 64);
    }

    set_transient(coral_sso_transient_key($user_id), [
      'hash'     => coral_sso_hash($secret),
      'redirect' => $redirect,
      'expires'  => time() + CORAL_SSO_TTL,
    ], CORAL_SSO_TTL);

    // add_query_arg() does NOT encode values, so encode redirect_to here.
    // The token is [0-9a-f.] only and needs no encoding.
    return add_query_arg([
      'coral_sso'   => $user_id . '.' . $secret,
      'redirect_to' => rawurlencode($redirect),
    ], home_url('/'));
  }
}

/** REST callback shared by /auth/web-session and the legacy /app-login-link. */
if (!function_exists('coral_web_session_handler')) {
  function coral_web_session_handler(WP_REST_Request $request) {
    $user_id = get_current_user_id();
    if (!$user_id) {
      return new WP_Error('not_logged_in', 'Authentication required.', ['status' => 401]);
    }

    $rate = coral_sso_check_mint_rate($user_id);
    if (is_wp_error($rate)) {
      return $rate;
    }

    $target = $request->get_param('redirect_to');
    if (!is_string($target) || $target === '') {
      $target = $request->get_param('redirect');
    }
    $redirect = coral_sso_same_site_url(is_string($target) ? $target : '');
    if ($redirect === '') {
      $redirect = home_url('/');
    }

    $response = new WP_REST_Response([
      'url'        => coral_sso_issue_url($user_id, $redirect),
      'expires_in' => CORAL_SSO_TTL,
    ], 200);
    $response->header('Cache-Control', 'no-store, private');
    return $response;
  }
}

if (!function_exists('coral_app_login_link_handler')) {
  // Back-compat name used by plugin v1.4.
  function coral_app_login_link_handler(WP_REST_Request $request) {
    return coral_web_session_handler($request);
  }
}

add_action('rest_api_init', function () {
  $args = [
    'methods'             => 'POST',
    'callback'            => 'coral_web_session_handler',
    'permission_callback' => function () {
      return is_user_logged_in();
    },
    'args' => [
      'redirect_to' => ['required' => false, 'type' => 'string'],
      'redirect'    => ['required' => false, 'type' => 'string'],
    ],
  ];

  // Current route used by the app.
  register_rest_route('coral/v1', '/auth/web-session', $args);
  // v1.4 name, kept so older builds keep working.
  register_rest_route('coral/v1', '/app-login-link', $args);
});

/**
 * Consume /?coral_sso=<uid>.<secret>
 * Runs early on `init` (before themes, PMPro redirects, or page caches
 * that run inside WordPress) and always exits.
 */
if (!function_exists('coral_sso_consume')) {
  function coral_sso_consume() {
    if (!isset($_GET['coral_sso'])) {
      return;
    }
    if ((defined('REST_REQUEST') && REST_REQUEST) || wp_doing_ajax() || wp_doing_cron()) {
      return;
    }

    $raw = is_string($_GET['coral_sso']) ? wp_unslash($_GET['coral_sso']) : '';

    // The target stored with the token wins; the query-string copy is only
    // used (after the same-site check) when the stored one is missing.
    $query_target = (isset($_GET['redirect_to']) && is_string($_GET['redirect_to']))
      ? coral_sso_same_site_url(wp_unslash($_GET['redirect_to']))
      : '';

    $user_id = 0;
    $target  = '';

    if (preg_match('/^(\d{1,20})\.([a-f0-9]{64})$/', $raw, $m)) {
      $candidate = (int) $m[1];
      $key       = coral_sso_transient_key($candidate);
      $data      = get_transient($key);

      if (
        is_array($data)
        && !empty($data['hash'])
        && !empty($data['expires'])
        && (int) $data['expires'] >= time()
        && hash_equals((string) $data['hash'], coral_sso_hash($m[2]))
        // Single use: only the request that actually deletes the token
        // may log in.
        && delete_transient($key)
        && get_userdata($candidate)
      ) {
        $user_id = $candidate;
        $target  = coral_sso_same_site_url(isset($data['redirect']) ? $data['redirect'] : '');
      }
    }

    nocache_headers();
    header('Referrer-Policy: no-referrer');
    header('X-Robots-Tag: noindex, nofollow');

    if (!$user_id) {
      // Expired / used / invalid: fall back to the normal website login,
      // returning to the resource afterwards. Never reveal why it failed.
      $dest  = $query_target !== '' ? $query_target : home_url('/');
      $login = apply_filters('coral_sso_failure_login_url', home_url('/login/'));
      wp_safe_redirect(add_query_arg('redirect_to', rawurlencode($dest), $login));
      exit;
    }

    if ($target === '') {
      $target = $query_target !== '' ? $query_target : home_url('/');
    }

    // Replace whatever session the WebView had (e.g. a different account).
    wp_clear_auth_cookie();
    wp_set_current_user($user_id);
    wp_set_auth_cookie($user_id, true, is_ssl());
    do_action('coral_sso_logged_in', $user_id);

    // Respond 200 with a tiny page that navigates on, instead of a 302.
    // Some iOS WKWebView versions drop Set-Cookie headers on redirect
    // responses for the very first load; a 200 guarantees the cookie is
    // stored before the resource is requested.
    status_header(200);
    header('Content-Type: text/html; charset=utf-8');
    $href = esc_url($target);
    $js   = wp_json_encode($target, JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT | JSON_UNESCAPED_SLASHES);
    echo '<!doctype html><html><head><meta charset="utf-8">'
      . '<meta name="viewport" content="width=device-width,initial-scale=1">'
      . '<meta name="referrer" content="no-referrer">'
      . '<meta http-equiv="refresh" content="0;url=' . $href . '">'
      . '<title>Opening…</title></head><body>'
      . '<script>window.location.replace(' . $js . ');</script>'
      . '<p style="font-family:sans-serif;text-align:center;margin-top:40vh;color:#6b7280">Opening… '
      . '<a href="' . $href . '">Continue</a></p>'
      . '</body></html>';
    exit;
  }
}
add_action('init', 'coral_sso_consume', 1);
