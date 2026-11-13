<?php
/**
 * When the app opens a website page it adds ?corr_app=1.
 * Hide the public header, logo and footer so the page feels like part of the app.
 * The member cannot use those controls to wander into the community site.
 */

if (!defined('ABSPATH')) {
    exit;
}

function coral_is_app_view() {
    return isset($_GET['corr_app']) && (string) $_GET['corr_app'] !== '' && (string) $_GET['corr_app'] !== '0';
}

add_filter('body_class', function ($classes) {
    if (coral_is_app_view()) {
        $classes[] = 'corr-app-view';
    }
    return $classes;
});

add_action('wp_head', function () {
    if (!coral_is_app_view()) {
        return;
    }
    echo '<style id="corr-app-chrome">'
        . 'body.corr-app-view #wpadminbar,'
        . 'body.corr-app-view header,'
        . 'body.corr-app-view .site-header,'
        . 'body.corr-app-view #masthead,'
        . 'body.corr-app-view .elementor-location-header,'
        . 'body.corr-app-view .main-navigation,'
        . 'body.corr-app-view #site-navigation,'
        . 'body.corr-app-view .navbar,'
        . 'body.corr-app-view footer,'
        . 'body.corr-app-view .site-footer,'
        . 'body.corr-app-view #colophon,'
        . 'body.corr-app-view .elementor-location-footer{display:none!important}'
        . 'body.corr-app-view{margin-top:0!important;padding-top:0!important}'
        . '</style>';
}, 1);
