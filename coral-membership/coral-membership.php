<?php
/**
 * Plugin Name: Coral Membership API
 * Description: Exposes REST API endpoints used by the mobile app (membership check + membership levels).
 * Version: 1.4.0
 * Author: Coral Reef Research Hub
 */

if (!defined('ABSPATH')) { exit; }

/** ------------------------------------------------------------------------
 * Utilities
 * --------------------------------------------------------------------- */

/** Minimal checkout page URL (app-only view) */
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

/** Get benefits list for a membership level (ACF repeater/textarea, then WP option) */
if (!function_exists('coral_membership_get_benefits')) {
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
          if ($txt !== '') $benefits[] = $txt;
        }
      }

      // Textarea: benefits_text (newline-separated)
      if (empty($benefits)) {
        $txt = get_field('benefits_text', $scope);
        if (is_string($txt) && trim($txt) !== '') {
          $lines = preg_split('/\r\n|\r|\n/', $txt);
          foreach ($lines as $line) {
            $line = trim(wp_strip_all_tags($line));
            if ($line !== '') $benefits[] = $line;
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
          if ($line !== '') $benefits[] = $line;
        }
      }
    }

    return array_values($benefits);
  }
}

/** ------------------------------------------------------------------------
 * REST API: routes
 * --------------------------------------------------------------------- */

/** Always-on ping to verify plugin is loaded */
add_action('rest_api_init', function () {
  register_rest_route('coral/v1', '/ping', [
    'methods'  => 'GET',
    'permission_callback' => '__return_true',
    'callback' => function () {
      return new WP_REST_Response([
        'ok'      => true,
        'plugin'  => 'coral-membership',
        'version' => '1.4.0'
      ], 200);
    },
  ]);
});

/** GET /coral/v1/membership → { is_member: boolean } */
add_action('rest_api_init', function () {
  register_rest_route('coral/v1', '/membership', [
    'methods'  => 'GET',
    'permission_callback' => '__return_true',
    'callback' => function () {
      $user_id = get_current_user_id();
      if (!$user_id) {
        return new WP_REST_Response(['is_member' => false, 'reason' => 'not_logged_in'], 200);
      }

      // Paid Memberships Pro (preferred if present)
      if (function_exists('pmpro_hasMembershipLevel') && pmpro_hasMembershipLevel(null, $user_id)) {
        return new WP_REST_Response(['is_member' => true], 200);
      }

      // MemberPress
      if (class_exists('\MeprUser')) {
        $user = new \MeprUser($user_id);
        if (method_exists($user, 'is_active') && $user->is_active()) {
          return new WP_REST_Response(['is_member' => true], 200);
        }
      }

      // Fallback: capability-based (customize as needed)
      if (user_can($user_id, 'read_private_pages')) {
        return new WP_REST_Response(['is_member' => true], 200);
      }

      return new WP_REST_Response(['is_member' => false], 200);
    },
  ]);
});

/** GET /coral/v1/levels → { levels: [...] } (public) */
add_action('rest_api_init', function () {
  register_rest_route('coral/v1', '/levels', [
    'methods'  => 'GET',
    'permission_callback' => '__return_true',
    'callback' => function () {
      // If PMPro not present, return empty list rather than fatal-ing
      if (!function_exists('pmpro_getAllLevels')) {
        return new WP_REST_Response(['levels' => []], 200);
      }

      $levels = pmpro_getAllLevels(true, true);
      $out = [];

      // One-time resolve of minimal checkout page
      $minimal_base = coral_app_checkout_base_url(); // e.g. https://site.com/app-checkout/

      foreach ($levels as $lvl) {
        // Price (prefer recurring)
        $amount_for_badge = ($lvl->billing_amount > 0) ? $lvl->billing_amount : $lvl->initial_payment;
        $price = '$' . number_format((float)$amount_for_badge, 2);

        // Note
        if ($lvl->billing_amount > 0 && !empty($lvl->cycle_number) && !empty($lvl->cycle_period)) {
          $note = sprintf('$%s per %s.', number_format((float)$lvl->billing_amount, 2), ucfirst($lvl->cycle_period));
        } elseif ((float)$lvl->initial_payment === 0.0) {
          $note = 'Free';
        } else {
          $note = sprintf('One-time $%s.', number_format((float)$lvl->initial_payment, 2));
        }

        // Checkout URL with guards (avoid fatal if pmpro_url missing)
        $pmpro_checkout = function_exists('pmpro_url') ? pmpro_url('checkout') : home_url('/membership-account/membership-checkout/');
        $checkout_url = add_query_arg('level', (int) $lvl->id, $minimal_base ?: $pmpro_checkout);

        $out[] = [
          'id'               => (int) $lvl->id,
          'name'             => $lvl->name,
          'price'            => $price,
          'note'             => $note,
          'description'      => wp_strip_all_tags($lvl->description),
          'benefits'         => coral_membership_get_benefits($lvl->id),
          'checkout_url'     => $checkout_url,
          // raw fields if needed
          'recurring_amount' => (float) $lvl->billing_amount,
          'initial_payment'  => (float) $lvl->initial_payment,
          'cycle_period'     => $lvl->cycle_period,
          'cycle_number'     => (int) $lvl->cycle_number,
        ];
      }

      return new WP_REST_Response(['levels' => array_values($out)], 200);
    },
  ]);
});

/** ------------------------------------------------------------------------
 * Optional: load tokens endpoints if provided (safe include)
 * --------------------------------------------------------------------- */

add_action('plugins_loaded', function () {
  $tokens_file = __DIR__ . '/coral-tokens.php';
  if (file_exists($tokens_file)) {
    require_once $tokens_file;
  } else {
    // Not fatal; just log for awareness
    if (defined('WP_DEBUG') && WP_DEBUG) {
      error_log('[Coral Membership API] coral-tokens.php not found; skipping tokens routes.');
    }
  }
});