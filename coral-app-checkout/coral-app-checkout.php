<?php
/**
 * Plugin Name: Coral App Checkout
 * Description: Minimal checkout route for the mobile app (no header/footer). Creates /app-checkout/ page using a plugin-provided template. Carries the app's logged-in user into checkout (upgrades) and gives clear reCAPTCHA feedback.
 * Version: 1.1.0
 * Author: Coral Reef Research Hub
 */

if (!defined('ABSPATH')) exit;

/** Query arg that carries the single-use checkout login token. */
if (!defined('CORAL_CHECKOUT_TOKEN_ARG')) {
  define('CORAL_CHECKOUT_TOKEN_ARG', 'coral_checkout_token');
}
/** Seconds a checkout login token stays valid. */
if (!defined('CORAL_CHECKOUT_TOKEN_TTL')) {
  define('CORAL_CHECKOUT_TOKEN_TTL', 120);
}

/** 1) Register the plugin-provided page template */
add_filter('theme_page_templates', function($templates){
  $templates['coral-app-checkout-template.php'] = 'Checkout (App)';
  return $templates;
});

/** 2) Use our template file when that template is selected */
add_filter('template_include', function($template){
  if (is_singular('page')) {
    $tpl = get_page_template_slug(get_queried_object_id());
    if ($tpl === 'coral-app-checkout-template.php') {
      return plugin_dir_path(__FILE__) . 'templates/app-checkout.php';
    }
  }
  return $template;
});

/** 3) Remove PMPro “Already have an account? Log in here” on the app-checkout page only */
add_action('wp', function () {
  if (is_page('app-checkout')) {
    // This specifically removes the small login link under the pricing fields
    remove_action('pmpro_checkout_after_pricing_fields', 'pmpro_checkout_login_link');
  }
}, 20); // run after PMPro adds its hooks

/** Base URL of the app checkout page. */
function coral_app_checkout_page_url() {
  $page = function_exists('get_page_by_path') ? get_page_by_path('app-checkout') : null;
  if ($page) {
    $url = get_permalink($page);
    if ($url) return $url;
  }
  return home_url('/app-checkout/');
}

// ---------------------------------------------------------------------------
// 4) Upgrade / change-level checkout for users already logged in to the app.
//
// The app authenticates with a JWT, but PMPro checkout runs on a normal web
// page that only knows the WordPress cookie session. Without a session PMPro
// treats the member as a brand-new registrant, shows the account fields, and
// fails with "That username is already taken". The app therefore asks for a
// short-lived, single-use checkout link (JWT-authenticated REST call); opening
// that link signs the browser into the same WordPress account and redirects
// to the clean checkout URL, where PMPro hides the account fields and applies
// the new level to the existing user.
// ---------------------------------------------------------------------------

/**
 * POST /coral-checkout/v1/link   (requires the app's JWT)
 * Body: level = PMPro level ID
 * Returns: { url } — open it in the browser / WebView.
 */
add_action('rest_api_init', function () {
  register_rest_route('coral-checkout/v1', '/link', [
    'methods'             => 'POST',
    'callback'            => 'coral_app_checkout_link_handler',
    'permission_callback' => function () {
      return is_user_logged_in();
    },
    'args' => [
      'level' => [
        'required'          => true,
        'type'              => 'integer',
        'sanitize_callback' => 'absint',
      ],
    ],
  ]);
});

if (!function_exists('coral_app_checkout_link_handler')) {
  function coral_app_checkout_link_handler(WP_REST_Request $request) {
    $user_id = get_current_user_id();
    if (!$user_id) {
      return new WP_Error('not_logged_in', 'Authentication required.', ['status' => 401]);
    }

    $level_id = absint($request->get_param('level'));
    if (!$level_id) {
      return new WP_Error('invalid_level', 'A membership level is required.', ['status' => 400]);
    }
    if (function_exists('pmpro_getLevel')) {
      $level = pmpro_getLevel($level_id);
      if (empty($level)) {
        return new WP_Error('invalid_level', 'That membership level does not exist.', ['status' => 404]);
      }
    }

    $checkout_url = add_query_arg('level', $level_id, coral_app_checkout_page_url());

    // Store only a hash of the token server-side.
    $token = wp_generate_password(48, false, false);
    set_transient('coral_checkout_' . hash('sha256', $token), [
      'user_id'  => (int) $user_id,
      'redirect' => $checkout_url,
    ], CORAL_CHECKOUT_TOKEN_TTL);

    // add_query_arg leaves the alphanumeric token untouched.
    $url = add_query_arg(CORAL_CHECKOUT_TOKEN_ARG, $token, $checkout_url);

    return new WP_REST_Response([
      'url'          => $url,
      'checkout_url' => $checkout_url,
      'expires_in'   => CORAL_CHECKOUT_TOKEN_TTL,
    ], 200);
  }
}

/**
 * Consume ?coral_checkout_token=… : sign the browser in as the app user, then
 * redirect to the stored checkout URL (without the token). Runs on `init`
 * so the session exists before PMPro's checkout preheader runs.
 */
add_action('init', function () {
  if (empty($_GET[CORAL_CHECKOUT_TOKEN_ARG]) || wp_doing_ajax() || (defined('REST_REQUEST') && REST_REQUEST)) {
    return;
  }

  $token = sanitize_text_field(wp_unslash($_GET[CORAL_CHECKOUT_TOKEN_ARG]));
  $key   = 'coral_checkout_' . hash('sha256', $token);
  $data  = get_transient($key);
  delete_transient($key); // single use, valid or not

  $redirect = remove_query_arg(CORAL_CHECKOUT_TOKEN_ARG);
  if (is_array($data) && !empty($data['user_id'])) {
    $user_id = (int) $data['user_id'];
    if (!empty($data['redirect'])) {
      $redirect = $data['redirect'];
    }

    if (get_current_user_id() !== $user_id) {
      if (is_user_logged_in()) {
        // A different account was signed in on this browser; switch to the app user.
        wp_clear_auth_cookie();
      }
      wp_set_current_user($user_id);
      wp_set_auth_cookie($user_id, true, is_ssl());
    }
  } else {
    // Expired / reused link: tell the template so it can explain what to do.
    $redirect = add_query_arg('coral_checkout_expired', '1', $redirect);
  }

  nocache_headers();
  wp_safe_redirect($redirect);
  exit;
}, 1);

/**
 * Safety net for the "username already taken" dead end: if an existing account
 * reaches the app checkout without a session, PMPro would treat it as a new
 * registration. Tell the template so it can offer a log-in path instead.
 */
function coral_app_checkout_username_taken_message() {
  global $pmpro_msg;
  if (is_user_logged_in() || empty($pmpro_msg) || !is_string($pmpro_msg)) {
    return false;
  }
  return stripos($pmpro_msg, 'username') !== false && stripos($pmpro_msg, 'taken') !== false;
}

// ---------------------------------------------------------------------------
// 5) reCAPTCHA feedback on the app checkout page.
// PMPro's reCAPTCHA gives no visible feedback when the challenge errors,
// expires, or fails to load, leaving the user stuck. Hook the widget's
// expired/error callbacks, block submitting an unsolved checkbox, detect a
// script that never loads, and offer a clear retry.
// ---------------------------------------------------------------------------
add_action('wp_footer', function () {
  if (!is_page('app-checkout') && get_page_template_slug(get_queried_object_id()) !== 'coral-app-checkout-template.php') {
    return;
  }
  ?>
  <div id="coral-recaptcha-alert" role="alert" aria-live="assertive" style="display:none;margin:12px 0;padding:12px 14px;border-radius:10px;border:1px solid #fecaca;background:#fef2f2;color:#991b1b;font-size:15px;line-height:1.4;">
    <strong id="coral-recaptcha-alert-title">reCAPTCHA verification failed — please try again.</strong>
    <div id="coral-recaptcha-alert-body" style="margin-top:4px;"></div>
    <button type="button" id="coral-recaptcha-retry" style="margin-top:10px;padding:8px 14px;border:0;border-radius:8px;background:#0077b6;color:#fff;font-weight:700;font-size:14px;">Try again</button>
  </div>
  <script>
  (function () {
    var alertEl = document.getElementById('coral-recaptcha-alert');
    var bodyEl = document.getElementById('coral-recaptcha-alert-body');
    var titleEl = document.getElementById('coral-recaptcha-alert-title');
    var retryBtn = document.getElementById('coral-recaptcha-retry');
    var loaded = false;

    function widgets() {
      return Array.prototype.slice.call(document.querySelectorAll('.g-recaptcha'));
    }
    function hasCheckboxWidget() {
      return widgets().some(function (el) { return el.getAttribute('data-size') !== 'invisible'; });
    }
    function placeAlert() {
      var anchor = widgets()[0];
      if (anchor && anchor.parentNode && alertEl.parentNode !== anchor.parentNode) {
        anchor.parentNode.insertBefore(alertEl, anchor.nextSibling);
      }
    }
    function show(title, body, reload) {
      placeAlert();
      titleEl.textContent = title;
      bodyEl.textContent = body || '';
      retryBtn.textContent = reload ? 'Reload page' : 'Try again';
      retryBtn.setAttribute('data-reload', reload ? '1' : '0');
      alertEl.style.display = 'block';
      if (alertEl.scrollIntoView) alertEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    function hide() { alertEl.style.display = 'none'; }

    retryBtn.addEventListener('click', function () {
      if (retryBtn.getAttribute('data-reload') === '1' || !window.grecaptcha || !window.grecaptcha.reset) {
        window.location.reload();
        return;
      }
      try { window.grecaptcha.reset(); } catch (e) { window.location.reload(); return; }
      hide();
    });

    window.coralRecaptchaExpired = function () {
      show('reCAPTCHA verification expired — please try again.', 'Tick the "I\'m not a robot" box again before submitting.');
    };
    window.coralRecaptchaError = function () {
      show('reCAPTCHA verification failed — please try again.', 'The verification could not be completed. Check your connection, then tap "Try again".');
    };
    window.coralRecaptchaSolved = function () { hide(); };

    function chain(existing, extra) {
      return function () {
        try { extra.apply(this, arguments); } catch (e) {}
        var fn = typeof existing === 'function' ? existing : (typeof existing === 'string' ? window[existing] : null);
        if (typeof fn === 'function') return fn.apply(this, arguments);
      };
    }

    // Auto-rendered widgets (<div class="g-recaptcha" data-sitekey=…>): add callbacks before api.js renders them.
    widgets().forEach(function (el) {
      if (!el.getAttribute('data-expired-callback')) el.setAttribute('data-expired-callback', 'coralRecaptchaExpired');
      if (!el.getAttribute('data-error-callback')) el.setAttribute('data-error-callback', 'coralRecaptchaError');
    });

    // Explicitly rendered widgets (PMPro uses grecaptcha.render in its onload callback): wrap render.
    function patchRender() {
      var g = window.grecaptcha;
      if (!g || !g.render || g.__coralPatched) return;
      var original = g.render;
      g.render = function (container, params) {
        params = params || {};
        params['expired-callback'] = chain(params['expired-callback'], window.coralRecaptchaExpired);
        params['error-callback'] = chain(params['error-callback'], window.coralRecaptchaError);
        params.callback = chain(params.callback, window.coralRecaptchaSolved);
        return original.call(this, container, params);
      };
      g.__coralPatched = true;
    }
    if (typeof window.pmpro_recaptcha_onloadCallback === 'function') {
      var onload = window.pmpro_recaptcha_onloadCallback;
      window.pmpro_recaptcha_onloadCallback = function () {
        patchRender();
        loaded = true;
        return onload.apply(this, arguments);
      };
    }

    // Detect a reCAPTCHA script that never loads (blocked / offline).
    setTimeout(function () {
      if (!widgets().length) return;
      var rendered = loaded || document.querySelector('.g-recaptcha iframe');
      if (!rendered) {
        show('reCAPTCHA could not load.', 'Check your internet connection, then reload the page to try again.', true);
      }
    }, 15000);

    // Block submitting an unsolved checkbox reCAPTCHA (PMPro would otherwise
    // reload with a generic error or appear to do nothing).
    var form = document.getElementById('pmpro_form') || (widgets()[0] && widgets()[0].closest && widgets()[0].closest('form'));
    if (form) {
      form.addEventListener('submit', function (event) {
        if (!hasCheckboxWidget() || !window.grecaptcha || !window.grecaptcha.getResponse) return;
        var response = '';
        try { response = window.grecaptcha.getResponse(); } catch (e) { return; }
        if (!response) {
          event.preventDefault();
          event.stopImmediatePropagation();
          show('Please complete the reCAPTCHA verification.', 'Tick the "I\'m not a robot" box (and finish any image challenge) before submitting.');
          // Re-enable PMPro's submit button, which it disables on submit.
          var buttons = form.querySelectorAll('[type=submit]');
          for (var i = 0; i < buttons.length; i++) { buttons[i].disabled = false; }
          var processing = document.getElementById('pmpro_processing_message');
          if (processing) processing.style.visibility = 'hidden';
        }
      }, true);
    }

    // Server rejected the reCAPTCHA (PMPro error message mentions it).
    var msg = document.getElementById('pmpro_message') || document.querySelector('.pmpro_message.pmpro_error');
    if (msg && /captcha/i.test(msg.textContent || '')) {
      show('reCAPTCHA verification failed — please try again.', 'Tick the "I\'m not a robot" box again, then resubmit.');
    }
  })();
  </script>
  <?php
}, 100);

/** 6) On activation, create /app-checkout/ and assign our template */
register_activation_hook(__FILE__, function () {
  $page = get_page_by_path('app-checkout');

  if (!$page) {
    $page_id = wp_insert_post([
      'post_title'   => 'Membership Checkout',
      'post_name'    => 'app-checkout',
      'post_status'  => 'publish',
      'post_type'    => 'page',
      'post_content' => '[pmpro_checkout]', // fallback if template not applied
    ]);
  } else {
    $page_id = $page->ID;
  }

  if ($page_id && !is_wp_error($page_id)) {
    update_post_meta($page_id, '_wp_page_template', 'coral-app-checkout-template.php');
  }

  flush_rewrite_rules();
});

register_deactivation_hook(__FILE__, function () {
  flush_rewrite_rules();
});
