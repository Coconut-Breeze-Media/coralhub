<?php
/**
 * Plugin Name: Coral Social API
 * Plugin URI: https://coralhub.com
 * Description: Custom REST API for CoralHub social features with BuddyPress and bbPress
 * Version: 1.0.0
 * Author: CoralHub Team
 * Author URI: https://coralhub.com
 * License: GPL v2 or later
 * License URI: https://www.gnu.org/licenses/gpl-2.0.html
 * Text Domain: coral-social-api
 * Requires at least: 5.8
 * Requires PHP: 7.4
 */

// Prevent direct access
if (!defined('ABSPATH')) {
    exit;
}

// Define plugin constants
define('CORAL_SOCIAL_API_VERSION', '1.0.0');
define('CORAL_SOCIAL_API_PLUGIN_DIR', plugin_dir_path(__FILE__));
define('CORAL_SOCIAL_API_PLUGIN_URL', plugin_dir_url(__FILE__));

/**
 * Main plugin class
 */
class Coral_Social_API {
    
    private static $instance = null;
    
    public static function get_instance() {
        if (null === self::$instance) {
            self::$instance = new self();
        }
        return self::$instance;
    }
    
    private function __construct() {
        $this->init_hooks();
        $this->load_dependencies();
    }
    
    private function init_hooks() {
        add_action('rest_api_init', array($this, 'register_routes'));
        add_action('init', array($this, 'check_dependencies'));

        // Enable file uploads for REST API
        add_filter('rest_api_init', array($this, 'enable_rest_file_uploads'));

        // Handle CORS for file uploads
        add_action('rest_api_init', array($this, 'add_cors_support'));

        // Expose a comment count on every item returned by BuddyPress's own
        // /buddypress/v1/activity endpoint (list + single). The app's News
        // Feed / Groups / group detail screens all read `comment_count` off
        // each activity so they can show "3" instead of a bare "Comment"
        // label, but BuddyPress's core REST response never includes it —
        // only the single-activity endpoint with display_comments=threaded
        // returns nested comments, and the list endpoint returns neither.
        add_action('rest_api_init', array($this, 'register_activity_comment_count_field'));

        // BuddyPress already creates notifications for activity replies,
        // @mentions, friendships and group workflows. Favorites are the one
        // social action used by the app that does not create a core
        // notification, so add/remove a matching notification here.
        add_filter('bp_notifications_get_registered_components', array($this, 'register_notification_component'));
        add_action('bp_rest_activity_update_favorite', array($this, 'sync_activity_favorite_notification'), 10, 4);
    }

    /**
     * Adds a `comment_count` field to the BuddyPress REST "activity" object
     * type, so GET /buddypress/v1/activity (list) and
     * GET /buddypress/v1/activity/{id} both return it without the client
     * having to fetch each activity's full comment thread just to get a count.
     */
    public function register_activity_comment_count_field() {
        if (!function_exists('bp_activity_get_comment_count')) {
            return;
        }

        register_rest_field(
            'activity',
            'comment_count',
            array(
                'get_callback' => function ($object) {
                    $activity_id = is_array($object) ? ($object['id'] ?? 0) : $object->id;
                    if (!$activity_id) {
                        return 0;
                    }
                    return (int) bp_activity_get_comment_count($activity_id);
                },
                'schema' => array(
                    'description' => __('Total number of comments on this activity item.', 'coral-social-api'),
                    'type'        => 'integer',
                    'context'     => array('view', 'edit'),
                ),
            )
        );
    }

    /** Register the custom notification component used for app reactions. */
    public function register_notification_component($component_names) {
        if (!in_array('coral', $component_names, true)) {
            $component_names[] = 'coral';
        }

        return $component_names;
    }

    /** Notify a post author when another member favorites their activity. */
    public function notify_activity_favorite($activity_id, $user_id) {
        if (!function_exists('bp_notifications_add_notification')) {
            return;
        }

        $activity = new BP_Activity_Activity($activity_id);
        $author_id = isset($activity->user_id) ? (int) $activity->user_id : 0;
        $user_id = (int) $user_id;

        if (!$author_id || !$user_id || $author_id === $user_id) {
            return;
        }

        $this->delete_activity_favorite_notification($activity_id, $user_id, $author_id);

        bp_notifications_add_notification(array(
            'user_id'           => $author_id,
            'item_id'           => (int) $activity_id,
            'secondary_item_id' => $user_id,
            'component_name'    => 'coral',
            'component_action'  => 'activity_favorited',
            'date_notified'     => bp_core_current_time(),
            'is_new'            => 1,
        ));
    }

    /** Sync reaction notifications after BuddyPress toggles a REST favorite. */
    public function sync_activity_favorite_notification($activity, $user_favorites, $response, $request) {
        if (empty($activity->id)) {
            return;
        }

        $activity_id = (int) $activity->id;
        $user_id = get_current_user_id();
        $favorite_ids = array_map('intval', (array) $user_favorites);

        if (in_array($activity_id, $favorite_ids, true)) {
            $this->notify_activity_favorite($activity_id, $user_id);
        } else {
            $this->remove_activity_favorite_notification($activity_id, $user_id);
        }
    }

    /** Remove the corresponding unread reaction when a favorite is undone. */
    public function remove_activity_favorite_notification($activity_id, $user_id) {
        $activity = new BP_Activity_Activity($activity_id);
        $author_id = isset($activity->user_id) ? (int) $activity->user_id : 0;
        $this->delete_activity_favorite_notification($activity_id, $user_id, $author_id);
    }

    private function delete_activity_favorite_notification($activity_id, $user_id, $author_id) {
        if (!$author_id || !class_exists('BP_Notifications_Notification')) {
            return;
        }

        BP_Notifications_Notification::delete(array(
            'user_id'           => (int) $author_id,
            'item_id'           => (int) $activity_id,
            'secondary_item_id' => (int) $user_id,
            'component_name'    => 'coral',
            'component_action'  => 'activity_favorited',
        ));
    }
    
    /**
     * Enable file uploads in WordPress REST API
     */
    public function enable_rest_file_uploads() {
        // Ensure $_FILES is available in REST requests
        add_filter('rest_pre_serve_request', '__return_false');
    }
    
    /**
     * Add CORS support for REST API file uploads
     */
    public function add_cors_support() {
        // Remove default CORS headers to avoid conflicts
        remove_filter('rest_pre_serve_request', 'rest_send_cors_headers');
        
        // Add custom CORS headers
        add_filter('rest_pre_serve_request', function($served, $result, $request, $server) {
            header('Access-Control-Allow-Origin: *');
            header('Access-Control-Allow-Methods: POST, GET, OPTIONS, PUT, DELETE');
            header('Access-Control-Allow-Credentials: true');
            header('Access-Control-Allow-Headers: Authorization, Content-Type, X-WP-Nonce');
            
            // Handle preflight OPTIONS request
            if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
                status_header(200);
                exit();
            }
            
            return $served;
        }, 10, 4);
    }
    
    private function load_dependencies() {
        require_once CORAL_SOCIAL_API_PLUGIN_DIR . 'includes/class-activity-endpoint.php';
        require_once CORAL_SOCIAL_API_PLUGIN_DIR . 'includes/class-groups-endpoint.php';
        require_once CORAL_SOCIAL_API_PLUGIN_DIR . 'includes/class-posts-endpoint.php';
        require_once CORAL_SOCIAL_API_PLUGIN_DIR . 'includes/class-users-endpoint.php';
        require_once CORAL_SOCIAL_API_PLUGIN_DIR . 'includes/class-mentions-endpoint.php';
    }
    
    public function check_dependencies() {
        if (!class_exists('BuddyPress')) {
            add_action('admin_notices', array($this, 'buddypress_missing_notice'));
        }
        if (!class_exists('bbPress')) {
            add_action('admin_notices', array($this, 'bbpress_missing_notice'));
        }
    }
    
    public function buddypress_missing_notice() {
        ?>
        <div class="notice notice-error">
            <p><?php _e('Coral Social API requires BuddyPress to function properly.', 'coral-social-api'); ?></p>
        </div>
        <?php
    }
    
    public function bbpress_missing_notice() {
        ?>
        <div class="notice notice-warning">
            <p><?php _e('Coral Social API recommends bbPress for full discussion features.', 'coral-social-api'); ?></p>
        </div>
        <?php
    }
    
    public function register_routes() {
        // Register activity routes
        $activity_endpoint = new Coral_Activity_Endpoint();
        $activity_endpoint->register_routes();
        
        // Register groups routes
        $groups_endpoint = new Coral_Groups_Endpoint();
        $groups_endpoint->register_routes();
        
        // Register posts routes
        $posts_endpoint = new Coral_Posts_Endpoint();
        $posts_endpoint->register_routes();
        
        // Register users routes
        $users_endpoint = new Coral_Users_Endpoint();
        $users_endpoint->register_routes();
        
        // Register mentions routes
        $mentions_endpoint = new Coral_Mentions_Endpoint();
        $mentions_endpoint->register_routes();
    }
}

// Initialize plugin
function coral_social_api_init() {
    return Coral_Social_API::get_instance();
}

add_action('plugins_loaded', 'coral_social_api_init');

// Activation hook
register_activation_hook(__FILE__, 'coral_social_api_activate');

function coral_social_api_activate() {
    // Check dependencies on activation
    if (!class_exists('BuddyPress')) {
        deactivate_plugins(plugin_basename(__FILE__));
        wp_die(__('This plugin requires BuddyPress. Please install and activate BuddyPress first.', 'coral-social-api'));
    }
    
    // Create default options
    add_option('coral_social_api_version', CORAL_SOCIAL_API_VERSION);
    
    // Flush rewrite rules
    flush_rewrite_rules();
}

// Deactivation hook
register_deactivation_hook(__FILE__, 'coral_social_api_deactivate');

function coral_social_api_deactivate() {
    flush_rewrite_rules();
}
