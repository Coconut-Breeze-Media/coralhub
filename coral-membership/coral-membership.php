<?php
/**
 * Plugin Name: Coral Membership API
 * Description: Exposes REST API endpoints used by the mobile app (membership check + membership levels + tiered premium-resource access + app SSO).
 * Version: 1.4
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
      'courses'                => 'Courses',
      'mentorships'            => 'Mentorships',
      'document_library'       => 'Document Library',
      'coral_matters'          => 'Coral Matters',
      'essays_articles'        => 'Essays and Articles',
      'masterclasses'          => 'Masterclasses',
      'internships'            => 'Internships',
      'partnerships_discounts' => 'Partnerships & Discounts',
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
      // No Feedback URL was provided — placeholder; set the real one in the
      // 'coral_resource_urls' option or update this default.
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
// App SSO bridge
// The app authenticates with a JWT, but the website enforces
// access with a WP cookie session. These two pieces let the
// app hand a paid user a short-lived, single-use link that
// logs them into the website and redirects to a resource.
// ---------------------------------------------------------

/**
 * POST /coral/v1/app-login-link  (protected)
 * Body/param: redirect = same-origin URL to land on after login.
 * Returns: { url } — open in the device browser / WebView.
 */
add_action('rest_api_init', function () {
  register_rest_route('coral/v1', '/app-login-link', [
    'methods'  => 'POST',
    'callback' => 'coral_app_login_link_handler',
    'permission_callback' => function () {
      return is_user_logged_in();
    },
    'args' => [
      'redirect' => [
        'required' => false,
        'type'     => 'string',
      ],
    ],
  ]);
});

if (!function_exists('coral_app_login_link_handler')) {
  function coral_app_login_link_handler(WP_REST_Request $request) {
    $user_id = get_current_user_id();
    if (!$user_id) {
      return new WP_Error('not_logged_in', 'Authentication required.', ['status' => 401]);
    }

    $home     = home_url('/');
    $redirect = $request->get_param('redirect');
    $redirect = is_string($redirect) ? esc_url_raw($redirect) : '';

    // Same-origin only — fall back to home for off-site or empty targets.
    if (!$redirect || strpos($redirect, untrailingslashit(home_url())) !== 0) {
      $redirect = $home;
    }

    // Mint a single-use token; store only its hash + payload server-side.
    $token = wp_generate_password(48, false, false);
    $hash  = hash('sha256', $token);
    set_transient('coral_sso_' . $hash, [
      'user_id'  => (int) $user_id,
      'redirect' => $redirect,
    ], 60); // 60-second TTL

    $url = add_query_arg(['coral_sso' => rawurlencode($token)], $home);

    return new WP_REST_Response(['url' => $url], 200);
  }
}

/**
 * Front-end handler for /?coral_sso=<token>
 * Validates the single-use token, logs the user in (sets the WP cookie),
 * then redirects to the stored same-origin target.
 */
add_action('template_redirect', function () {
  if (empty($_GET['coral_sso'])) {
    return;
  }

  $token = sanitize_text_field(wp_unslash($_GET['coral_sso']));
  $key   = 'coral_sso_' . hash('sha256', $token);
  $data  = get_transient($key);

  // Enforce single use regardless of validity.
  delete_transient($key);

  $redirect = home_url('/');
  if (is_array($data) && !empty($data['user_id'])) {
    $user_id = (int) $data['user_id'];
    if (!empty($data['redirect'])) {
      $redirect = $data['redirect'];
    }
    wp_set_current_user($user_id);
    wp_set_auth_cookie($user_id, true);
  }

  wp_safe_redirect($redirect);
  exit;
});