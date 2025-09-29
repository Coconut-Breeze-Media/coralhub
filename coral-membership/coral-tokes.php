<?php
/**
 * Adds refresh-token endpoints on top of the "JWT Authentication for WP-API" plugin.
 * Routes:
 *   POST /coral-auth/v1/login           -> { token, refresh_token, ... }
 *   POST /coral-auth/v1/token/refresh   -> { token, refresh_token, ... }  (rotates)
 *   POST /coral-auth/v1/logout          -> revoke the given refresh_token
 *
 * Stores hashed refresh tokens in usermeta for ~30 days.
 * Requires the JWT plugin (jwt_auth_generate_token must exist).
 */

if (!defined('ABSPATH')) exit;

final class Coral_Tokens {
  const NS = 'coral-auth/v1';
  const META_KEY = '_coral_refresh_tokens'; // array of rows: [hash, exp, created, label]
  const TTL_DAYS = 30;

  public static function boot() {
    add_action('rest_api_init', [__CLASS__, 'register_routes']);
  }

  public static function register_routes() {
    register_rest_route(self::NS, '/login', [
      'methods'  => 'POST',
      'permission_callback' => '__return_true',
      'callback' => [__CLASS__, 'login'],
      'args' => [
        'username' => ['type' => 'string', 'required' => true],
        'password' => ['type' => 'string', 'required' => true],
        'label'    => ['type' => 'string', 'required' => false],
      ],
    ]);

    register_rest_route(self::NS, '/token/refresh', [
      'methods'  => 'POST',
      'permission_callback' => '__return_true',
      'callback' => [__CLASS__, 'refresh'],
      'args' => [
        'refresh_token' => ['type' => 'string', 'required' => true],
      ],
    ]);

    register_rest_route(self::NS, '/logout', [
      'methods'  => 'POST',
      'permission_callback' => '__return_true',
      'callback' => [__CLASS__, 'logout'],
      'args' => [
        'refresh_token' => ['type' => 'string', 'required' => true],
      ],
    ]);
  }

  /* ---------------- utils ---------------- */

  private static function hash_token($raw) {
    return hash_hmac('sha256', (string) $raw, wp_salt('auth'));
  }
  private static function now() { return time(); }
  private static function ttl() { return self::TTL_DAYS * DAY_IN_SECONDS; }

  private static function get_rows($uid) {
    $rows = get_user_meta($uid, self::META_KEY, true);
    return is_array($rows) ? $rows : [];
  }
  private static function put_rows($uid, $rows) {
    update_user_meta($uid, self::META_KEY, array_values($rows));
  }

  private static function issue_row($uid, $label = 'mobile') {
    $raw  = wp_generate_password(64, false, false);
    $hash = self::hash_token($raw);
    $exp  = self::now() + self::ttl();
    // single-device (simple): keep only one active row; flip to multi by appending instead
    $rows = [[
      'hash'    => $hash,
      'exp'     => $exp,
      'created' => self::now(),
      'label'   => sanitize_text_field($label ?: 'mobile'),
    ]];
    self::put_rows($uid, $rows);
    return [$raw, $exp];
  }

  private static function rotate_row($uid, $old_hash, $label = 'mobile') {
    $rows = self::get_rows($uid);
    $rows = array_values(array_filter($rows, fn($r) => !hash_equals($r['hash'] ?? '', $old_hash)));
    $raw  = wp_generate_password(64, false, false);
    $hash = self::hash_token($raw);
    $exp  = self::now() + self::ttl();
    $rows[] = [
      'hash'    => $hash,
      'exp'     => $exp,
      'created' => self::now(),
      'label'   => sanitize_text_field($label),
    ];
    self::put_rows($uid, $rows);
    return [$raw, $exp];
  }

  private static function jwt_for_user($user) {
    if (!function_exists('jwt_auth_generate_token')) {
      return new WP_Error('jwt_missing', 'JWT generator not available', ['status' => 500]);
    }
    return jwt_auth_generate_token($user);
  }

  private static function find_owner($refresh_raw) {
    $hash = self::hash_token($refresh_raw);
    $q = new WP_User_Query([
      'meta_key'    => self::META_KEY,
      'fields'      => 'all',
      'number'      => 250,
      'count_total' => false,
    ]);
    foreach ($q->get_results() as $u) {
      $rows = self::get_rows($u->ID);
      foreach ($rows as $r) {
        if (hash_equals($r['hash'] ?? '', $hash)) return [$u, $r, $hash];
      }
    }
    return [null, null, $hash];
  }

  /* ---------------- endpoints ---------------- */

  public static function login(WP_REST_Request $req) {
    $user = wp_authenticate($req['username'], $req['password']);
    if (is_wp_error($user)) {
      return new WP_REST_Response(['message' => 'Invalid credentials'], 401);
    }
    $jwt = self::jwt_for_user($user);
    if (is_wp_error($jwt)) return $jwt;

    [$rt, $rtExp] = self::issue_row($user->ID, (string) ($req['label'] ?: 'mobile'));

    return new WP_REST_Response([
      'token'             => $jwt['token'],
      'user_email'        => $jwt['user_email'],
      'user_nicename'     => $jwt['user_nicename'],
      'user_display_name' => $jwt['user_display_name'],
      'refresh_token'     => $rt,
      'refresh_expires'   => $rtExp,
      'expires_in'        => isset($jwt['exp']) ? max(0, $jwt['exp'] - time()) : null,
    ], 200);
  }

  public static function refresh(WP_REST_Request $req) {
    $raw = (string) $req['refresh_token'];
    if (!$raw || strlen($raw) < 32) {
      return new WP_REST_Response(['message' => 'Invalid refresh token'], 400);
    }
    [$user, $row, $hash] = self::find_owner($raw);
    if (!$user || !$row) return new WP_REST_Response(['message' => 'Not found'], 401);
    if (empty($row['exp']) || time() > (int) $row['exp']) {
      return new WP_REST_Response(['message' => 'Expired'], 401);
    }

    $jwt = self::jwt_for_user($user);
    if (is_wp_error($jwt)) return $jwt;

    [$rt, $rtExp] = self::rotate_row($user->ID, $hash, $row['label'] ?? 'mobile');

    return new WP_REST_Response([
      'token'             => $jwt['token'],
      'user_email'        => $jwt['user_email'],
      'user_nicename'     => $jwt['user_nicename'],
      'user_display_name' => $jwt['user_display_name'],
      'refresh_token'     => $rt,
      'refresh_expires'   => $rtExp,
      'expires_in'        => isset($jwt['exp']) ? max(0, $jwt['exp'] - time()) : null,
    ], 200);
  }

  public static function logout(WP_REST_Request $req) {
    $raw = (string) $req['refresh_token'];
    if (!$raw) return new WP_REST_Response(['message' => 'Missing token'], 400);
    $hash = self::hash_token($raw);

    $q = new WP_User_Query([
      'meta_key'    => self::META_KEY,
      'fields'      => 'all',
      'number'      => 250,
      'count_total' => false,
    ]);
    foreach ($q->get_results() as $u) {
      $rows = self::get_rows($u->ID);
      $new  = array_values(array_filter($rows, fn($r) => !hash_equals($r['hash'] ?? '', $hash)));
      if (count($new) !== count($rows)) {
        self::put_rows($u->ID, $new);
        break;
      }
    }
    return new WP_REST_Response(['ok' => true], 200);
  }
}

Coral_Tokens::boot();