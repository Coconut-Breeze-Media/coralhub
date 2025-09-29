<?php
/**
 * Plugin Name: Coral Membership API
 * Description: Exposes REST API endpoints used by the mobile app (membership check + membership levels).
 * Version: 1.3
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

// ---------------------------------------------------
// /coral/v1/membership  → { is_member: boolean }
// ---------------------------------------------------
add_action('rest_api_init', function () {
  register_rest_route('coral/v1', '/membership', [
    'methods'  => 'GET',
    'callback' => function (WP_REST_Request $request) {
      $user_id = get_current_user_id();
      if (!$user_id) {
        return new WP_REST_Response(['is_member' => false, 'reason' => 'not_logged_in'], 200);
      }

      // Paid Memberships Pro
      if (function_exists('pmpro_hasMembershipLevel') && pmpro_hasMembershipLevel(null, $user_id)) {
        return new WP_REST_Response(['is_member' => true], 200);
      }

      // MemberPress
      if (class_exists('\MeprUser')) {
        $user = new \MeprUser($user_id);
        if ($user->is_active()) {
          return new WP_REST_Response(['is_member' => true], 200);
        }
      }

      // Fallback: role/capability
      if (user_can($user_id, 'read_private_pages')) {
        return new WP_REST_Response(['is_member' => true], 200);
      }

      return new WP_REST_Response(['is_member' => false], 200);
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

require_once __DIR__ . '/coral-tokens.php';