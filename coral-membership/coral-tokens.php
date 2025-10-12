<?php
if (!defined('ABSPATH')) { exit; }
error_log('[coral-tokens] file loaded');

/**
 * Coral Tokens API
 *
 * Adds login + refresh endpoints for mobile apps, built atop
 * the "JWT Authentication for WP-API" plugin.
 *
 * Routes:
 *  - POST /wp-json/coral-auth/v1/login
 *      body: { "username": "...", "password": "...", "label"?: "mobile" }
 *      → { token, refresh_token, refresh_expires, user_email, user_display_name }
 *
 *  - POST /wp-json/coral-auth/v1/token/refresh
 *      body: { "refresh_token": "uid.randomhex..." }
 *      → { token (nullable), refresh_token, refresh_expires }
 *
 * Security:
 *  - refresh_token format: "<user_id>.<random>"
 *  - only the random part is hashed in usermeta:
 *      _coral_rt_hash, _coral_rt_exp
 *
 * Requirements:
 *  - "JWT Authentication for WP-API" plugin active and configured
 *    (JWT_AUTH_SECRET_KEY is set).
 */


/** ──────────────────────────────────────────────────────────────
 * Settings & Meta Keys
 * ───────────────────────────────────────────────────────────── */
if (!defined('CORAL_RT_TTL_SECONDS')) {
  define('CORAL_RT_TTL_SECONDS', 60 * 60 * 24 * 30); // 30 days
}
if (!defined('CORAL_RT_META_HASH')) {
  define('CORAL_RT_META_HASH', '_coral_refresh_token_hash');
}
if (!defined('CORAL_RT_META_EXP')) {
  define('CORAL_RT_META_EXP',  '_coral_refresh_token_exp');
}

/** ──────────────────────────────────────────────────────────────
 * Utilities
 * ───────────────────────────────────────────────────────────── */
function coral_tokens_now(): int {
  return time();
}

function coral_tokens_secure_random_bytes($len = 32): string {
  if (function_exists('random_bytes')) {
    return random_bytes($len);
  }
  if (function_exists('openssl_random_pseudo_bytes')) {
    return openssl_random_pseudo_bytes($len);
  }
  // fallback: WP generator (lower entropy, but prevents fatals)
  return wp_generate_password($len, true, true);
}

function coral_tokens_random_hex($len = 32): string {
  return bin2hex(coral_tokens_secure_random_bytes($len));
}

function coral_tokens_hash(string $plaintext): string {
  return password_hash($plaintext, PASSWORD_DEFAULT);
}

function coral_tokens_verify(string $plaintext, string $hash): bool {
  return is_string($hash) && password_verify($plaintext, $hash);
}

function coral_tokens_response($data, int $status = 200): WP_REST_Response {
  return new WP_REST_Response($data, $status);
}

function coral_tokens_error(string $message, int $status = 400): WP_REST_Response {
  return coral_tokens_response(['error' => $message], $status);
}

/**
 * Proxy to the JWT plugin’s REST issuer (no plugin internals).
 * Returns array on success (expects key "token"), or WP_Error.
 */
function coral_tokens_request_jwt_via_rest(string $username, string $password) {
  $url = rest_url('jwt-auth/v1/token');
  $resp = wp_remote_post($url, [
    'timeout' => 15,
    'headers' => ['Content-Type' => 'application/json'],
    'body'    => wp_json_encode([
      'username' => $username,
      'password' => $password,
    ]),
  ]);

  if (is_wp_error($resp)) {
    return $resp;
  }

  $code = (int) wp_remote_retrieve_response_code($resp);
  $body_raw = wp_remote_retrieve_body($resp);
  $body = json_decode($body_raw, true);

  if ($code < 200 || $code >= 300) {
    return new WP_Error('jwt_error', 'JWT issuance failed', [
      'status' => $code,
      'body'   => $body,
    ]);
  }

  if (!is_array($body) || empty($body['token'])) {
    return new WP_Error('jwt_missing', 'JWT plugin did not return a token', ['status' => 500]);
  }

  return $body; // array with "token", "user_email", "user_display_name", ...
}

/**
 * Create & store refresh token for a user. Returns:
 *   [ 'refresh_token' => 'uid.random', 'refresh_expires' => ts ]
 */
function coral_tokens_issue_refresh_token(int $user_id): array {
  $rand     = coral_tokens_random_hex(32);    // plaintext random
  $hash     = coral_tokens_hash($rand);       // store hash only
  $expires  = coral_tokens_now() + (int) CORAL_RT_TTL_SECONDS;

  update_user_meta($user_id, CORAL_RT_META_HASH, $hash);
  update_user_meta($user_id, CORAL_RT_META_EXP,  $expires);

  // embed the uid in the token so we can look up user instantly
  $refresh_plain = $user_id . '.' . $rand;

  return [
    'refresh_token'    => $refresh_plain,
    'refresh_expires'  => $expires,
  ];
}

/**
 * Validate a refresh token ("uid.random") and return the user_id on success.
 */
function coral_tokens_validate_refresh_token(string $refresh_token) {
  $refresh_token = trim($refresh_token);
  if ($refresh_token === '' || strpos($refresh_token, '.') === false) {
    return new WP_Error('bad_format', 'Invalid refresh token format', ['status' => 401]);
  }

  list($uid_str, $random) = explode('.', $refresh_token, 2);
  $user_id = (int) $uid_str;

  if ($user_id <= 0 || strlen($random) < 10) {
    return new WP_Error('bad_token', 'Invalid refresh token', ['status' => 401]);
  }

  $hash = get_user_meta($user_id, CORAL_RT_META_HASH, true);
  $exp  = (int) get_user_meta($user_id, CORAL_RT_META_EXP, true);

  if (empty($hash) || empty($exp)) {
    return new WP_Error('no_refresh', 'No refresh token set', ['status' => 401]);
  }

  if ($exp < coral_tokens_now()) {
    return new WP_Error('refresh_expired', 'Refresh token expired', ['status' => 401]);
  }

  if (!coral_tokens_verify($random, $hash)) {
    return new WP_Error('refresh_invalid', 'Invalid refresh token', ['status' => 401]);
  }

  return $user_id;
}

/** ──────────────────────────────────────────────────────────────
 * REST Routes
 * ───────────────────────────────────────────────────────────── */
add_action('rest_api_init', function () {

  // Quick dependency check for JWT plugin
  $jwt_defined = defined('JWT_AUTH_SECRET_KEY');

  /**
   * POST /coral-auth/v1/login
   * body: { username, password, label? }
   * On success: { token, refresh_token, refresh_expires, user_email, user_display_name }
   */
  register_rest_route('coral-auth/v1', '/login', [
    'methods'             => 'POST',
    'permission_callback' => '__return_true',
    'args' => [
      'username' => ['required' => true, 'type' => 'string'],
      'password' => ['required' => true, 'type' => 'string'],
      'label'    => ['required' => false, 'type' => 'string'],
    ],
    'callback' => function (WP_REST_Request $req) use ($jwt_defined) {
      if (!$jwt_defined) {
        return coral_tokens_error('JWT plugin not configured', 500);
      }

      $username = sanitize_text_field($req->get_param('username'));
      $password = (string) $req->get_param('password');

      if ($username === '' || $password === '') {
        return coral_tokens_error('Missing credentials', 400);
      }

      // Ask JWT plugin to mint an access token via its REST endpoint
      $jwt = coral_tokens_request_jwt_via_rest($username, $password);
      if (is_wp_error($jwt)) {
        $data   = $jwt->get_error_data();
        $status = is_array($data) && isset($data['status']) ? (int) $data['status'] : 401;
        return coral_tokens_error($jwt->get_error_message(), $status);
      }

      // Resolve user (login or email)
      $user = get_user_by('login', $username);
      if (!$user) { $user = get_user_by('email', $username); }
      if (!$user) {
        return coral_tokens_error('User not found', 401);
      }

      // Issue refresh token
      $rt = coral_tokens_issue_refresh_token((int) $user->ID);

      return coral_tokens_response([
        'token'             => $jwt['token'] ?? null,
        'refresh_token'     => $rt['refresh_token'],
        'refresh_expires'   => $rt['refresh_expires'],
        'user_email'        => $jwt['user_email']        ?? $user->user_email,
        'user_display_name' => $jwt['user_display_name'] ?? $user->display_name,
      ], 200);
    },
  ]);

  /**
   * POST /coral-auth/v1/token/refresh
   * body: { refresh_token }
   * On success:
   *   - If you can mint a new JWT here, include it in "token".
   *   - Otherwise return token = null (app continues using last access token
   *     until it expires) — but we still rotate the refresh token.
   */
  register_rest_route('coral-auth/v1', '/token/refresh', [
    'methods'             => 'POST',
    'permission_callback' => '__return_true',
    'args' => [
      'refresh_token' => ['required' => true, 'type' => 'string'],
    ],
    'callback' => function (WP_REST_Request $req) use ($jwt_defined) {
      $submitted = (string) $req->get_param('refresh_token');
      if ($submitted === '') {
        return coral_tokens_error('Missing refresh_token', 400);
      }

      $uid_or_error = coral_tokens_validate_refresh_token($submitted);
      if (is_wp_error($uid_or_error)) {
        $data   = $uid_or_error->get_error_data();
        $status = is_array($data) && isset($data['status']) ? (int) $data['status'] : 401;
        return coral_tokens_error($uid_or_error->get_error_message(), $status);
      }
      $user_id = (int) $uid_or_error;

      // Rotate refresh token (invalidate old one)
      $rotated = coral_tokens_issue_refresh_token($user_id);

      // Optionally, mint a brand new access token here if your JWT plugin
      // provides a PHP API. Most don’t, so we return token=null by default.
      // Your app should call /jwt-auth/v1/token/validate occasionally, and
      // re-login if needed.
      $new_access_token = null;

      return coral_tokens_response([
        'token'           => $new_access_token,           // keep using the old one until it expires
        'refresh_token'   => $rotated['refresh_token'],   // new rotated refresh token
        'refresh_expires' => $rotated['refresh_expires'],
      ], 200);
    },
  ]);
});