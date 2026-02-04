<?php
/**
 * Custom Avatar Upload Endpoint for JWT Authentication
 * 
 * Add this code to your WordPress theme's functions.php file
 * Or use the Code Snippets plugin to add it
 * 
 * Endpoint: POST /wp-json/coral/v1/users/{id}/avatar
 * Headers: Authorization: Bearer {token}
 * Body: form-data with field "file" containing the image
 */

add_action('rest_api_init', function () {
    register_rest_route('coral/v1', '/users/(?P<id>\d+)/avatar', array(
        'methods'             => 'POST',
        'callback'            => 'coral_upload_avatar',
        'permission_callback' => 'coral_check_avatar_permission',
    ));
});

function coral_check_avatar_permission($request) {
    if (!is_user_logged_in()) {
        return false;
    }
    
    $user_id = $request->get_param('id');
    $current_user_id = get_current_user_id();
    
    // Can only upload own avatar or admin
    return $user_id == $current_user_id || current_user_can('manage_options');
}

function coral_upload_avatar($request) {
    $user_id = $request->get_param('id');
    
    if (!function_exists('bp_core_avatar_handle_upload')) {
        return new WP_Error('buddypress_not_active', 'BuddyPress is not active', array('status' => 500));
    }
    
    // Check if file was uploaded
    $files = $request->get_file_params();
    
    if (empty($files) || !isset($files['file'])) {
        return new WP_Error('missing_file', 'No file was uploaded. Expected field name: "file"', array('status' => 400));
    }
    
    $file = $files['file'];
    
    // Validate file type
    $allowed_types = array('image/jpeg', 'image/jpg', 'image/png', 'image/gif');
    $file_type = isset($file['type']) ? $file['type'] : '';
    
    if (!in_array($file_type, $allowed_types)) {
        return new WP_Error('invalid_file_type', 'Invalid file type. Only JPG, PNG and GIF are allowed', array('status' => 400));
    }
    
    // Validate file size (max 5MB)
    $max_size = 5 * 1024 * 1024;
    if (isset($file['size']) && $file['size'] > $max_size) {
        return new WP_Error('file_too_large', 'File size must be less than 5MB', array('status' => 400));
    }
    
    // Check for upload errors
    if (isset($file['error']) && $file['error'] !== UPLOAD_ERR_OK) {
        return new WP_Error('upload_error', 'File upload error: ' . $file['error'], array('status' => 500));
    }
    
    // Set current user context for BuddyPress
    bp_update_is_item_admin(true, 'members');
    
    // Set the displayed user
    if (function_exists('buddypress')) {
        buddypress()->displayed_user->id = $user_id;
    }
    
    // Simulate $_FILES for BuddyPress
    $_FILES['file'] = $file;
    
    // Use BuddyPress native avatar upload handler
    $avatar = bp_core_avatar_handle_upload($_FILES, 'bp_core_avatar_handle_crop');
    
    if (is_wp_error($avatar)) {
        return $avatar;
    }
    
    if (empty($avatar)) {
        return new WP_Error('upload_failed', 'Failed to process avatar upload', array('status' => 500));
    }
    
    // Get the uploaded avatar URLs
    $full_avatar = bp_core_fetch_avatar(array(
        'item_id' => $user_id,
        'object'  => 'user',
        'type'    => 'full',
        'html'    => false,
    ));
    
    $thumb_avatar = bp_core_fetch_avatar(array(
        'item_id' => $user_id,
        'object'  => 'user',
        'type'    => 'thumb',
        'html'    => false,
    ));
    
    return rest_ensure_response(array(
        'success' => true,
        'full'    => $full_avatar,
        'thumb'   => $thumb_avatar,
    ));
}
