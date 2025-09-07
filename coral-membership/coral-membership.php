<?php
/**
 * Plugin Name: Coral Membership API
 * Description: Exposes REST API endpoints used by the mobile app (membership check + membership levels).
 * Version: 1.1
 * Author: Coral Reef Research Hub
 */

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
      // Targeting Paid Memberships Pro
      if (!function_exists('pmpro_getAllLevels')) {
        return new WP_REST_Response(['levels' => []], 200);
      }

      // Get active levels
      $levels = pmpro_getAllLevels(true, true);
      $out = [];

      foreach ($levels as $lvl) {
        // Prefer recurring amount for the big price; else fall back to initial payment
        $amount_for_badge = ($lvl->billing_amount > 0) ? $lvl->billing_amount : $lvl->initial_payment;
        $price = '$' . number_format((float)$amount_for_badge, 2);

        // Note: show cadence if recurring, else Free / one-time
        $note = '';
        if ($lvl->billing_amount > 0 && !empty($lvl->cycle_number) && !empty($lvl->cycle_period)) {
          // e.g. "$2.99 per Month." or "$29.99 per Year."
          $note = sprintf('$%s per %s.', number_format((float)$lvl->billing_amount, 2), ucfirst($lvl->cycle_period));
        } elseif ((float)$lvl->initial_payment === 0.0) {
          $note = 'Free';
        } elseif ($lvl->initial_payment > 0) {
          $note = sprintf('One-time $%s.', number_format((float)$lvl->initial_payment, 2));
        }

        $out[] = [
          'id'               => (int) $lvl->id,
          'name'             => $lvl->name,
          'price'            => $price,                 // BIG price in the app
          'note'             => $note,                  // small helper text
          'description'      => wp_strip_all_tags($lvl->description),
          'benefits'         => [],                     // optional: fill from ACF/meta if you want
          'checkout_url'     => add_query_arg('level', $lvl->id, pmpro_url('checkout')),

          // Optional raw fields (handy for future UI logic)
          'recurring_amount' => (float) $lvl->billing_amount,
          'initial_payment'  => (float) $lvl->initial_payment,
          'cycle_period'     => $lvl->cycle_period,
          'cycle_number'     => (int) $lvl->cycle_number,
        ];
      }

      return new WP_REST_Response(['levels' => array_values($out)], 200);
    },
    'permission_callback' => '__return_true', // public
  ]);
});