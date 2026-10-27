<?php
/**
 * Plugin template: App Checkout (no header/footer)
 * Renders Paid Memberships Pro checkout for level `?level=ID`
 */
if (!defined('ABSPATH')) exit;

$level_id = isset($_GET['level']) ? intval($_GET['level']) : 0;
?><!DOCTYPE html>
<html <?php language_attributes(); ?>>
<head>
  <meta charset="<?php bloginfo('charset'); ?>">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex,nofollow">
  <?php wp_head(); ?>
  <style>
    /* Minimal reset & layout */
    html,body { margin:0; padding:0; background:#fff; color:#111827; }
    #wpadminbar { display:none !important; }          /* hide admin bar if logged in */
    .app-wrap { max-width: 760px; margin: 16px auto 32px; padding: 0 16px; }
    .app-card { background:#fff; border:1px solid #e5e7eb; border-radius:16px; padding:16px; box-shadow:0 10px 20px rgba(0,0,0,.04); }
    .app-title { font-size:18px; font-weight:800; margin:0 0 12px; }
    .app-note  { color:#6b7280; font-size:14px; margin: 6px 0 16px; }
    .app-alert { color:#92400e; background:#fffbeb; border:1px solid #fde68a; border-radius:10px; padding:10px 12px; }
    /* Remove theme chrome defensively if a theme leaked into this template */
    header, .site-header, #masthead, .topbar, .site-topbar, .social-bar,
    footer, .site-footer, #colophon, .navbar, .nav, .menu-toggle { display:none !important; }
  </style>
</head>
<body <?php body_class('app-checkout'); ?>>
<div class="app-wrap">
  <div class="app-card">
    <!-- Hardcode the title instead of using the page title -->
    <h1 class="app-title">Membership Checkout</h1>

    <?php
      // Render first so PMPro's preheader messages ($pmpro_msg) are available below.
      $checkout_html = $level_id > 0 ? do_shortcode('[pmpro_checkout level="' . esc_attr($level_id) . '"]') : '';
      $current_user  = wp_get_current_user();
    ?>

    <?php if (!empty($_GET['coral_checkout_expired']) && !is_user_logged_in()): ?>
      <p class="app-note app-alert">This checkout link has expired. To upgrade an existing account, go back to the app and tap <strong>Change membership level</strong> again.</p>
    <?php endif; ?>

    <?php if (is_user_logged_in() && $current_user && $current_user->exists()): ?>
      <p class="app-note">Signed in as <strong><?php echo esc_html($current_user->display_name ?: $current_user->user_login); ?></strong>. The selected level will be applied to this account.</p>
    <?php endif; ?>

    <?php if (function_exists('coral_app_checkout_username_taken_message') && coral_app_checkout_username_taken_message()): ?>
      <p class="app-note app-alert">
        Already have an account? You don't need to register again.
        To upgrade, open the CoRR Hub app and use <strong>Profile &rsaquo; My Profile Settings &rsaquo; Change membership level</strong>,
        or <a href="<?php echo esc_url(wp_login_url(add_query_arg('level', $level_id, get_permalink()))); ?>">log in here</a> and continue checkout.
      </p>
    <?php endif; ?>

    <?php if ($level_id > 0): ?>
      <!-- Just render the checkout form -->
      <?php echo $checkout_html; ?>
    <?php else: ?>
      <p>Please choose a membership level first.</p>
      <p><a href="<?php echo esc_url(home_url('/membership-account/membership-levels/')); ?>">View membership levels</a></p>
    <?php endif; ?>
  </div>
</div>
  <?php wp_footer(); ?>
</body>
</html>