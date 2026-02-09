<?php
/**
 * Plugin Name: Coral App Checkout
 * Description: Minimal checkout route for the mobile app (no header/footer). Creates /app-checkout/ page using a plugin-provided template.
 * Version: 1.0.1
 * Author: Coral Reef Research Hub
 */

if (!defined('ABSPATH')) exit;

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

/** 4) On activation, create /app-checkout/ and assign our template */
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