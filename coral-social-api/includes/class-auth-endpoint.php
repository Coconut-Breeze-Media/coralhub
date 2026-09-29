<?php
/**
 * Auth Endpoint
 * Public (unauthenticated) account helpers used by the mobile app
 *
 * Endpoints:
 * - POST /coral/v1/auth/lost-password - Send a password reset email
 *
 * WordPress Core Reference:
 * - retrieve_password() (WP >= 5.7) - builds the reset key and sends the email
 */

// Prevent direct access
if (!defined('ABSPATH')) {
    exit;
}

class Coral_Auth_Endpoint {

    private $namespace = 'coral/v1';

    /** Max lost-password requests per IP inside the window */
    const RATE_LIMIT_MAX    = 5;
    /** Rate-limit window in seconds (15 minutes) */
    const RATE_LIMIT_WINDOW = 15 * MINUTE_IN_SECONDS;

    public function register_routes() {
        // Request a password reset link
        register_rest_route($this->namespace, '/auth/lost-password', array(
            'methods'             => WP_REST_Server::CREATABLE,
            'callback'            => array($this, 'lost_password'),
            'permission_callback' => '__return_true',
            'args'                => array(
                'user_login' => array(
                    'type'              => 'string',
                    'required'          => true,
                    'description'       => 'Email address or username of the account',
                    'sanitize_callback' => 'sanitize_text_field',
                ),
            ),
        ));
    }

    /**
     * POST /auth/lost-password
     *
     * Always responds 200 with a generic message (unless rate limited) so the
     * endpoint cannot be used to enumerate accounts.
     */
    public function lost_password($request) {
        $rate_limited = $this->check_rate_limit();
        if (is_wp_error($rate_limited)) {
            return $rate_limited;
        }

        $user_login = trim((string) $request->get_param('user_login'));

        if ($user_login !== '') {
            $user = is_email($user_login)
                ? get_user_by('email', $user_login)
                : get_user_by('login', $user_login);

            if ($user instanceof WP_User) {
                // WP core >= 5.7. Returns true or WP_Error; either way we fall
                // through to the generic response and never leak details.
                $result = retrieve_password($user->user_login);
                if (is_wp_error($result) && defined('WP_DEBUG') && WP_DEBUG) {
                    error_log('[coral-social-api] lost-password: retrieve_password returned ' . $result->get_error_code());
                }
            }
        }

        return rest_ensure_response(array(
            'success' => true,
            'message' => 'If an account exists for that email or username, a password reset link has been sent.',
        ));
    }

    /**
     * Allow RATE_LIMIT_MAX requests per RATE_LIMIT_WINDOW per client IP.
     *
     * @return true|WP_Error
     */
    private function check_rate_limit() {
        $ip = $this->get_client_ip();
        $key = 'coral_lost_pw_' . md5($ip);

        $count = (int) get_transient($key);

        if ($count >= self::RATE_LIMIT_MAX) {
            return new WP_Error(
                'coral_rate_limited',
                'Too many password reset attempts. Please wait a few minutes and try again.',
                array('status' => 429)
            );
        }

        // set_transient with a fresh expiry only on first hit so the window is fixed, not sliding.
        if ($count === 0) {
            set_transient($key, 1, self::RATE_LIMIT_WINDOW);
        } else {
            $timeout = (int) get_option('_transient_timeout_' . $key);
            $remaining = $timeout > 0 ? max(1, $timeout - time()) : self::RATE_LIMIT_WINDOW;
            set_transient($key, $count + 1, $remaining);
        }

        return true;
    }

    private function get_client_ip() {
        $ip = isset($_SERVER['REMOTE_ADDR']) ? $_SERVER['REMOTE_ADDR'] : '';
        $ip = filter_var($ip, FILTER_VALIDATE_IP);
        return $ip ? $ip : 'unknown';
    }
}
