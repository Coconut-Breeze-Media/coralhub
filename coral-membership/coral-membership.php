<?php
/**
 * Plugin Name: Coral Membership API
 * Description: Exposes a REST API endpoint to check if the current user is a member.
 * Version: 1.0
 * Author: Your Name
 */

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

      // Fallback: use role/capability
      if (user_can($user_id, 'read_private_pages')) {
        return new WP_REST_Response(['is_member' => true], 200);
      }

      return new WP_REST_Response(['is_member' => false], 200);
    },
    'permission_callback' => '__return_true',
  ]);
});