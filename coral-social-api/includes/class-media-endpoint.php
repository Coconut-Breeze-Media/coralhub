<?php
/**
 * POST /coral/v1/media
 *
 * BuddyPress members often lack upload_files, so POST /wp/v2/media answers
 * 401/403 and the app reports "Failed to upload image". This route accepts
 * the same multipart field (`file`) and creates a media-library attachment
 * for the signed-in member without permanently granting that capability.
 */

if (!defined('ABSPATH')) {
    exit;
}

class Coral_Media_Endpoint {

    private $namespace = 'coral/v1';

    public function register_routes() {
        register_rest_route($this->namespace, '/media', array(
            'methods'             => WP_REST_Server::CREATABLE,
            'callback'            => array($this, 'upload'),
            'permission_callback' => array($this, 'check_permission'),
        ));
    }

    public function check_permission() {
        return is_user_logged_in();
    }

    public function upload($request) {
        if (empty($_FILES['file']) || !isset($_FILES['file']['tmp_name'])) {
            return new WP_Error('coral_media_missing', 'No file was uploaded. Expected field name: "file".', array('status' => 400));
        }

        $file = $_FILES['file'];
        if (!empty($file['error'])) {
            return new WP_Error('coral_media_upload', 'File upload error: ' . (int) $file['error'], array('status' => 400));
        }

        // About 8MB after the app has already resized the photo.
        if (!empty($file['size']) && (int) $file['size'] > 8 * 1024 * 1024) {
            return new WP_Error('coral_media_too_large', 'That image is still too large. Please choose a smaller photo.', array('status' => 400));
        }

        require_once ABSPATH . 'wp-admin/includes/file.php';
        require_once ABSPATH . 'wp-admin/includes/media.php';
        require_once ABSPATH . 'wp-admin/includes/image.php';

        $member_id = get_current_user_id();
        $grant = function ($caps, $requested, $args, $user) use ($member_id) {
            if ($user instanceof WP_User && (int) $user->ID === $member_id) {
                $caps['upload_files'] = true;
            }
            return $caps;
        };
        add_filter('user_has_cap', $grant);
        $attachment_id = media_handle_upload('file', 0);
        remove_filter('user_has_cap', $grant);

        if (is_wp_error($attachment_id)) {
            return new WP_Error(
                'coral_media_failed',
                $attachment_id->get_error_message(),
                array('status' => 400)
            );
        }

        return rest_ensure_response(array(
            'id'         => (int) $attachment_id,
            'source_url' => (string) wp_get_attachment_url($attachment_id),
        ));
    }
}
