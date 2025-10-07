<?php
/**
 * Coral Tokens API (companion to Coral Membership API)
 *
 * Endpoints:
 *  - POST /wp-json/coral-auth/v1/login
 *      -> { username, password, label? }
 *      <- { token, refresh_token, refresh_expires, user_email, user_display_name }
 *
 *  - POST /wp-json/coral-auth/v1/token/refresh
 *      -> { refresh_token }
 *      <- { token|null, refresh_token, refresh_expires }
 *
 *  - GET  /wp-json/coral-auth/v1/whoami
 *      <- { user_id, user_email, display_name } or 401
 */

if (!defined('ABSPATH')) { exit; }

/* ─────────────────────────────────────────────────────────────
   Settings / constants
───────────────────────────────────────────────────────────── */

define('CORAL_RT_OPT_PREFIX', 'coral_rt_');           // option_name = coral_rt_<selector>
define('CORAL_RT_TTL_SECONDS', 60 * 60 * 24 * 30);    // 30 days
define('CORAL_RT_SELECTOR_BYTES', 8);                 // 8 bytes -> 16 hex chars
define('CORAL_RT_VERIFIER_BYTES', 32);                // 32 bytes -> 64 hex chars

/* ─────────────────────────────────────────────────────────────
   Utilities (robust + portable)
───────────────────────────────────────────────────────────── */

function coral_tokens_random_hex($bytes = 32) {
  if (function_exists('random_bytes')) {
    return bin2hex(random_bytes($bytes));
  }
  if (function_exists('openssl_random_pseudo_bytes')) {
    return bin2hex(openssl_random_pseudo_bytes($bytes));
  }
  // Fallback: wp_generate_password (less ideal; but avoids fatal)
  return bin2hex(substr(wp_generate_password($bytes, true, true), 0, $bytes));
}

function coral_tokens_hash($plaintext) {
  return password_hash($plaintext, PASSWORD_DEFAULT);
}

function coral_tokens_verify($plaintext, $hash) {
  return is_string($hash) && password_verify($plaintext, $hash);
}

function coral_tokens_now() { return time(); }

/**
 * Persist refresh token in options as:
 *   option_name = coral_rt_<selector>
 *   option_value = json: { user_id, hash, exp }
 * Selector is public; verifier is hashed server-side only.
 */
function coral_tokens_issue_refresh_token($user_id) {
  $selector = coral_tokens_random_hex(CORAL_RT_SELECTOR_BYTES);
  $verifier = coral_tokens_random_hex(CORAL_RT_VERIFIER_BYTES);
  $hash     = coral_tokens_hash($verifier);
  $exp      = coral_tokens_now() + CORAL_RT_TTL_SECONDS;

  $data = [
    'user_id' => (int) $user_id,
    'hash'    => $hash,
    'exp'     => (int) $exp,
  ];

  // Save as autoload=no to avoid loading at every request
  add_option(CORAL_RT_OPT_PREFIX . $selector, wp_json_encode($data), '', 'no');

  // What we hand to the client (selector.verifier)
  return [
    'refresh_token'        => $selector . '.' . $verifier,
    'refresh_token_expires'=> $exp,
  ];
}

/** Parse refresh token and load record (no verify yet) */
function coral_tokens_load_record($refresh_token) {
  $parts = explode('.', (string) $refresh_token);
  if (count($parts) !== 2) {
    return new WP_Error('bad_refresh_format', 'Invalid refresh token format', ['status' => 401]);
  }
  list($selector, $verifier) = $parts;

  $opt_name = CORAL_RT_OPT_PREFIX . $selector;
  $raw = get_option($opt_name);
  if (!$raw) {
    return new WP_Error('refresh_not_found', 'Unknown refresh token', ['status' => 401]);
  }
  $data = json_decode($raw, true);
  if (!is_array($data) || !isset($data['user_id'], $data['hash'], $data['exp'])) {
    // Corrupt; clean up
    delete_option($opt_name);
    return new WP_Error('refresh_corrupt', 'Corrupt refresh token', ['status' => 401]);
  }

  return [
    'selector' => $selector,
    'verifier' => $verifier,
    'option'   => $opt_name,
    'record'   => $data,
  ];
}

/** Validate a refresh token (exist, not expired, hash matches). */
function coral_tokens_validate_refresh($refresh_token) {
  $loaded = coral_tokens_load_record($refresh_token);
  if (is_wp_error($loaded)) return $loaded;

  $rec = $loaded['record'];
  if ((int) $rec['exp'] < coral_tokens_now()) {
    delete_option($loaded['option']);
    return new WP_Error('refresh_expired', 'Refresh token expired', ['status' => 401]);
  }

  if (!coral_tokens_verify($loaded['verifier'], $rec['hash'])) {
    // Possible theft or corruption; rotate out
    delete_option($loaded['option']);
    return new WP_Error('refresh_invalid', 'Invalid refresh token', ['status' => 401]);
  }

  return $loaded; // includes user_id in record
}

/**
 * Helper: ask the JWT plugin for a token via HTTP (proxy).
 * Requires username/password. Use only in /login, not /refresh.
 */
function coral_tokens_request_jwt($username, $password) {
  $url = rest_url('jwt-auth/v1/token');
  $resp = wp_remote_post($url, [
    'timeout' => 15,
    'headers' => ['Content-Type' => 'application/json'],
    'body'    => wp_json_encode(['username' => $username, 'password' => $password]),
  ]);

  if (is_wp_error($resp)) return $resp;

  $code = wp_remote_retrieve_response_code($resp);
  $body = json_decode(wp_remote_retrieve_body($resp), true);

  if ($code < 200 || $code >= 300) {
    return new WP_Error('jwt_error', 'JWT issuance failed', ['status' => $code, 'body' => $body]);
  }
  return $body; // expected to have 'token', 'user_email', 'user_display_name', ...
}

/**
 * OPTIONAL: Mint a new access token for user_id without password.
 * Fill this function if your JWT plugin exposes a PHP API to mint tokens
 * (different plugins use different names).
 *
 * Return array like: ['token' => '...'] on success, or null if unsupported.
 */
function coral_tokens_try_mint_access_token_for_user($user_id) {
  // 🔌 TRY TO MINT A NEW ACCESS TOKEN (if your JWT plugin exposes it)
  // Examples you might find in some plugins:
  // if (function_exists('jwt_auth_generate_token')) {
  //   $user = get_user_by('id', $user_id);
  //   if ($user) {
  //     $tok = jwt_auth_generate_token($user);
  //     if (is_array($tok) && !empty($tok['token'])) {
  //       return ['token' => $tok['token']];
  //     }
  //   }
  // }
  return null; // default: not supported
}

/* ─────────────────────────────────────────────────────────────
   REST routes
───────────────────────────────────────────────────────────── */

add_action('rest_api_init', function () {

  // POST /coral-auth/v1/login
  register_rest_route('coral-auth/v1', '/login', [
    'methods'  => 'POST',
    'permission_callback' => '__return_true',
    'args' => [
      'username' => ['required' => true, 'type' => 'string'],
      'password' => ['required' => true, 'type' => 'string'],
      'label'    => ['required' => false, 'type' => 'string'],
    ],
    'callback' => function (WP_REST_Request $req) {
      $username = sanitize_user($req->get_param('username'));
      $password = (string)$req->get_param('password');

      if (!$username || $password === '') {
        return new WP_REST_Response(['error' => 'Missing credentials'], 400);
      }

      // Ask existing JWT plugin for a token
      $jwt = coral_tokens_request_jwt($username, $password);
      if (is_wp_error($jwt)) {
        $data = $jwt->get_error_data();
        $status = is_array($data) && isset($data['status']) ? intval($data['status']) : 401;
        return new WP_REST_Response(['error' => $jwt->get_error_message()], $status);
      }

      // Resolve user
      $user = get_user_by('login', $username);
      if (!$user) $user = get_user_by('email', $username);
      if (!$user) {
        return new WP_REST_Response(['error' => 'User not found'], 401);
      }

      // Issue refresh token
      $rt = coral_tokens_issue_refresh_token($user->ID);

      return new WP_REST_Response([
        'token'             => $jwt['token'] ?? null,
        'refresh_token'     => $rt['refresh_token'],
        'refresh_expires'   => $rt['refresh_token_expires'],
        'user_email'        => $jwt['user_email'] ?? $user->user_email,
        'user_display_name' => $jwt['user_display_name'] ?? $user->display_name,
      ], 200);
    },
  ]);

  // POST /coral-auth/v1/token/refresh
  register_rest_route('coral-auth/v1', '/token/refresh', [
    'methods'  => 'POST',
    'permission_callback' => '__return_true',
    'args' => [
      'refresh_token' => ['required' => true, 'type' => 'string'],
    ],
    'callback' => function (WP_REST_Request $req) {
      $rt = (string)$req->get_param('refresh_token');
      if ($rt === '') {
        return new WP_REST_Response(['error' => 'Missing refresh_token'], 400);
      }

      // Validate token
      $loaded = coral_tokens_validate_refresh($rt);
      if (is_wp_error($loaded)) {
        $data = $loaded->get_error_data();
        $status = is_array($data) && isset($data['status']) ? intval($data['status']) : 401;
        return new WP_REST_Response(['error' => $loaded->get_error_message()], $status);
      }

      $user_id = (int) $loaded['record']['user_id'];

      // Rotate: delete the old selector entry first
      delete_option($loaded['option']);

      // Issue a new refresh token
      $rotated = coral_tokens_issue_refresh_token($user_id);

      // Try (if supported) to mint a new access token for this user
      $new_access = coral_tokens_try_mint_access_token_for_user($user_id);

      return new WP_REST_Response([
        'token'           => $new_access['token'] ?? null,  // null means: keep using your current access token
        'refresh_token'   => $rotated['refresh_token'],
        'refresh_expires' => $rotated['refresh_token_expires'],
      ], 200);
    },
  ]);

  // GET /coral-auth/v1/whoami (diagnostic)
  register_rest_route('coral-auth/v1', '/whoami', [
    'methods'  => 'GET',
    'permission_callback' => '__return_true',
    'callback' => function () {
      $uid = get_current_user_id();
      if (!$uid) return new WP_REST_Response(['error' => 'Unauthorized'], 401);

      $u = get_user_by('id', $uid);
      return new WP_REST_Response([
        'user_id'      => $uid,
        'user_email'   => $u ? $u->user_email : null,
        'display_name' => $u ? $u->display_name : null,
      ], 200);
    },
  ]);

});