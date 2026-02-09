<?php
/**
 * Users Endpoint
 * Manages user profiles and friendships
 * 
 * Endpoints:
 * - GET    /coral/v1/users/{id}/profile - Get user profile
 * - PUT    /coral/v1/users/{id}/profile - Update user profile
 * - GET    /coral/v1/users/{id}/friends - Get user friends
 * - POST   /coral/v1/users/{id}/friend-request - Send friend request
 * - POST   /coral/v1/users/{id}/accept-friendship - Accept friend request
 * - DELETE /coral/v1/users/{id}/remove-friendship - Remove/reject friendship
 * - GET    /coral/v1/users/me/friend-requests - Pending friend requests
 * - GET    /coral/v1/users/{id}/groups - User's groups
 * - GET    /coral/v1/users/{id}/activity - User's activity
 * 
 * BuddyPress REST API Reference:
 * - GET    /buddypress/v1/members/{id} - Get user profile
 * - PUT    /buddypress/v1/members/{id} - Update user profile
 * - GET    /buddypress/v1/xprofile/groups?user_id={id} - Get XProfile data
 * - GET    /buddypress/v1/xprofile/{field_id}/data/{user_id} - Get specific field
 * - PUT    /buddypress/v1/xprofile/{field_id}/data/{user_id} - Update field
 * - GET    /buddypress/v1/friends?user_id={id} - List friends
 * - POST   /buddypress/v1/friends - Create friendship request
 * - GET    /buddypress/v1/friends/{id} - Get friendship details
 * - DELETE /buddypress/v1/friends/{id} - Delete friendship
 */

class Coral_Users_Endpoint {
    
    private $namespace = 'coral/v1';
    
    public function register_routes() {
        // Perfil de usuario
        register_rest_route($this->namespace, '/users/(?P<id>\d+)/profile', array(
            array(
                'methods'             => WP_REST_Server::READABLE,
                'callback'            => array($this, 'get_user_profile'),
                'permission_callback' => array($this, 'check_permission'),
            ),
            array(
                'methods'             => WP_REST_Server::EDITABLE,
                'callback'            => array($this, 'update_user_profile'),
                'permission_callback' => array($this, 'check_permission'),
            ),
        ));
        
        // Amigos de usuario
        register_rest_route($this->namespace, '/users/(?P<id>\d+)/friends', array(
            'methods'             => WP_REST_Server::READABLE,
            'callback'            => array($this, 'get_user_friends'),
            'permission_callback' => array($this, 'check_permission'),
            'args'                => $this->get_friends_args(),
        ));
        
        // Enviar solicitud de amistad
        register_rest_route($this->namespace, '/users/(?P<id>\d+)/friend-request', array(
            'methods'             => WP_REST_Server::CREATABLE,
            'callback'            => array($this, 'send_friend_request'),
            'permission_callback' => array($this, 'check_permission'),
        ));
        
        // Aceptar solicitud de amistad
        register_rest_route($this->namespace, '/users/(?P<id>\d+)/accept-friendship', array(
            'methods'             => WP_REST_Server::CREATABLE,
            'callback'            => array($this, 'accept_friendship'),
            'permission_callback' => array($this, 'check_permission'),
        ));
        
        // Rechazar/eliminar amistad
        register_rest_route($this->namespace, '/users/(?P<id>\d+)/remove-friendship', array(
            'methods'             => WP_REST_Server::DELETABLE,
            'callback'            => array($this, 'remove_friendship'),
            'permission_callback' => array($this, 'check_permission'),
        ));
        
        // Solicitudes de amistad pendientes
        register_rest_route($this->namespace, '/users/me/friend-requests', array(
            'methods'             => WP_REST_Server::READABLE,
            'callback'            => array($this, 'get_friend_requests'),
            'permission_callback' => array($this, 'check_permission'),
        ));
        
        // Grupos del usuario
        register_rest_route($this->namespace, '/users/(?P<id>\d+)/groups', array(
            'methods'             => WP_REST_Server::READABLE,
            'callback'            => array($this, 'get_user_groups'),
            'permission_callback' => array($this, 'check_permission'),
        ));
        
        // Actividad del usuario
        register_rest_route($this->namespace, '/users/(?P<id>\d+)/activity', array(
            'methods'             => WP_REST_Server::READABLE,
            'callback'            => array($this, 'get_user_activity'),
            'permission_callback' => array($this, 'check_permission'),
        ));
        
        // Upload avatar
        register_rest_route($this->namespace, '/users/(?P<id>\d+)/avatar', array(
            array(
                'methods'             => WP_REST_Server::CREATABLE,
                'callback'            => array($this, 'upload_avatar'),
                'permission_callback' => array($this, 'check_avatar_permission'),
            ),
            array(
                'methods'             => WP_REST_Server::DELETABLE,
                'callback'            => array($this, 'delete_avatar'),
                'permission_callback' => array($this, 'check_avatar_permission'),
            ),
        ));
        
        // Upload cover
        register_rest_route($this->namespace, '/users/(?P<id>\d+)/cover', array(
            array(
                'methods'             => WP_REST_Server::CREATABLE,
                'callback'            => array($this, 'upload_cover'),
                'permission_callback' => array($this, 'check_avatar_permission'),
            ),
            array(
                'methods'             => WP_REST_Server::DELETABLE,
                'callback'            => array($this, 'delete_cover'),
                'permission_callback' => array($this, 'check_avatar_permission'),
            ),
        ));
    }
    
    public function check_permission($request) {
        return is_user_logged_in();
    }
    
    public function check_avatar_permission($request) {
        if (!is_user_logged_in()) {
            return false;
        }
        
        $user_id = $request->get_param('id');
        $current_user_id = get_current_user_id();
        
        // Can only upload/delete own avatar or admin
        return $user_id == $current_user_id || current_user_can('manage_options');
    }
    
    private function get_friends_args() {
        return array(
            'page' => array(
                'default'           => 1,
                'sanitize_callback' => 'absint',
            ),
            'per_page' => array(
                'default'           => 20,
                'sanitize_callback' => 'absint',
            ),
        );
    }
    
    public function get_user_profile($request) {
        $user_id = $request->get_param('id');
        
        $user = get_userdata($user_id);
        
        if (!$user) {
            return new WP_Error('user_not_found', 'User not found', array('status' => 404));
        }
        
        $profile = $this->format_user_profile($user_id);
        
        return rest_ensure_response(array(
            'success' => true,
            'data'    => $profile,
        ));
    }
    
    public function update_user_profile($request) {
        $user_id = $request->get_param('id');
        $current_user_id = get_current_user_id();
        
        // Can only update own profile
        if ($user_id != $current_user_id && !current_user_can('manage_options')) {
            return new WP_Error('unauthorized', 'You do not have permission to update this profile', array('status' => 403));
        }
        
        $user = get_userdata($user_id);
        
        if (!$user) {
            return new WP_Error('user_not_found', 'User not found', array('status' => 404));
        }
        
        // Actualizar campos básicos de WordPress
        $update_data = array('ID' => $user_id);
        
        if ($request->has_param('display_name')) {
            $update_data['display_name'] = sanitize_text_field($request->get_param('display_name'));
        }
        
        if ($request->has_param('description')) {
            $update_data['description'] = sanitize_textarea_field($request->get_param('description'));
        }
        
        if (!empty($update_data) && count($update_data) > 1) {
            wp_update_user($update_data);
        }
        
        // Actualizar campos extendidos de BuddyPress
        if (function_exists('xprofile_set_field_data')) {
            if ($request->has_param('bio')) {
                xprofile_set_field_data(1, $user_id, sanitize_textarea_field($request->get_param('bio')));
            }
            
            if ($request->has_param('location')) {
                xprofile_set_field_data('Location', $user_id, sanitize_text_field($request->get_param('location')));
            }
            
            if ($request->has_param('website')) {
                xprofile_set_field_data('Website', $user_id, esc_url_raw($request->get_param('website')));
            }
        }
        
        $profile = $this->format_user_profile($user_id);
        
        return rest_ensure_response(array(
            'success' => true,
            'message' => 'Profile updated successfully',
            'data'    => $profile,
        ));
    }
    
    public function get_user_friends($request) {
        $user_id = $request->get_param('id');
        $page = $request->get_param('page');
        $per_page = $request->get_param('per_page');
        
        if (!function_exists('friends_get_friends')) {
            return new WP_Error('buddypress_not_active', 'BuddyPress Friends is not active', array('status' => 500));
        }
        
        $friends = friends_get_friends(array(
            'user_id'  => $user_id,
            'page'     => $page,
            'per_page' => $per_page,
        ));
        
        $formatted_friends = array();
        
        if (!empty($friends['friends'])) {
            foreach ($friends['friends'] as $friend) {
                $formatted_friends[] = $this->format_user_basic($friend->ID);
            }
        }
        
        return rest_ensure_response(array(
            'success' => true,
            'data'    => $formatted_friends,
            'total'   => $friends['count'],
            'page'    => $page,
            'per_page' => $per_page,
        ));
    }
    
    public function send_friend_request($request) {
        $friend_id = $request->get_param('id');
        $user_id = get_current_user_id();
        
        if ($friend_id == $user_id) {
            return new WP_Error('invalid_request', 'You cannot send a friend request to yourself', array('status' => 400));
        }
        
        $friend = get_userdata($friend_id);
        
        if (!$friend) {
            return new WP_Error('user_not_found', 'User not found', array('status' => 404));
        }
        
        // Check if already friends
        if (friends_check_friendship($user_id, $friend_id)) {
            return new WP_Error('already_friends', 'Already friends', array('status' => 400));
        }
        
        // Check if request already pending
        if (friends_check_friendship_status($user_id, $friend_id) == 'pending') {
            return new WP_Error('request_pending', 'Friend request already pending', array('status' => 400));
        }
        
        $sent = friends_add_friend($user_id, $friend_id);
        
        if (!$sent) {
            return new WP_Error('request_failed', 'Could not send friend request', array('status' => 500));
        }
        
        return rest_ensure_response(array(
            'success' => true,
            'message' => 'Friend request sent successfully',
        ));
    }
    
    public function accept_friendship($request) {
        $friend_id = $request->get_param('id');
        $user_id = get_current_user_id();
        
        $friendship_id = friends_get_friendship_id($friend_id, $user_id);
        
        if (!$friendship_id) {
            return new WP_Error('friendship_not_found', 'Friend request not found', array('status' => 404));
        }
        
        $accepted = friends_accept_friendship($friendship_id);
        
        if (!$accepted) {
            return new WP_Error('accept_failed', 'Could not accept friend request', array('status' => 500));
        }
        
        return rest_ensure_response(array(
            'success' => true,
            'message' => 'Friend request accepted successfully',
        ));
    }
    
    public function remove_friendship($request) {
        $friend_id = $request->get_param('id');
        $user_id = get_current_user_id();
        
        $friendship_id = friends_get_friendship_id($user_id, $friend_id);
        
        if (!$friendship_id) {
            return new WP_Error('friendship_not_found', 'Friendship not found', array('status' => 404));
        }
        
        $removed = friends_remove_friend($user_id, $friend_id);
        
        if (!$removed) {
            return new WP_Error('remove_failed', 'Could not remove friendship', array('status' => 500));
        }
        
        return rest_ensure_response(array(
            'success' => true,
            'message' => 'Friendship removed successfully',
        ));
    }
    
    public function get_friend_requests($request) {
        $user_id = get_current_user_id();
        
        $requests = friends_get_friendship_request_user_ids($user_id);
        
        $formatted_requests = array();
        
        if (!empty($requests)) {
            foreach ($requests as $requester_id) {
                $formatted_requests[] = $this->format_user_basic($requester_id);
            }
        }
        
        return rest_ensure_response(array(
            'success' => true,
            'data'    => $formatted_requests,
            'total'   => count($formatted_requests),
        ));
    }
    
    public function get_user_groups($request) {
        $user_id = $request->get_param('id');
        
        if (!function_exists('groups_get_user_groups')) {
            return new WP_Error('buddypress_not_active', 'BuddyPress Groups is not active', array('status' => 500));
        }
        
        $groups = groups_get_user_groups($user_id);
        
        $formatted_groups = array();
        
        if (!empty($groups['groups'])) {
            foreach ($groups['groups'] as $group_id) {
                $group = groups_get_group($group_id);
                $formatted_groups[] = array(
                    'id'          => $group->id,
                    'name'        => $group->name,
                    'slug'        => $group->slug,
                    'avatar'      => bp_core_fetch_avatar(array(
                        'item_id' => $group->id,
                        'object'  => 'group',
                        'type'    => 'full',
                        'html'    => false,
                    )),
                    'permalink'   => bp_get_group_permalink($group),
                );
            }
        }
        
        return rest_ensure_response(array(
            'success' => true,
            'data'    => $formatted_groups,
            'total'   => $groups['total'],
        ));
    }
    
    public function get_user_activity($request) {
        $user_id = $request->get_param('id');
        
        $activities = bp_activity_get(array(
            'user_id'  => $user_id,
            'per_page' => 20,
        ));
        
        $formatted_activities = array();
        
        if (!empty($activities['activities'])) {
            foreach ($activities['activities'] as $activity) {
                $formatted_activities[] = array(
                    'id'           => $activity->id,
                    'content'      => $activity->content,
                    'type'         => $activity->type,
                    'date_recorded' => $activity->date_recorded,
                );
            }
        }
        
        return rest_ensure_response(array(
            'success' => true,
            'data'    => $formatted_activities,
            'total'   => $activities['total'],
        ));
    }
    
    public function upload_avatar($request) {
        $user_id = $request->get_param('id');
        
        if (!function_exists('bp_core_avatar_handle_upload')) {
            return new WP_Error('buddypress_not_active', 'BuddyPress is not active', array('status' => 500));
        }
        
        // Verificar permisos
        if (!bp_is_item_admin() && get_current_user_id() != $user_id) {
            return new WP_Error('rest_forbidden', 'You do not have permission to upload this avatar.', array('status' => 403));
        }
        
        // Debug logging
        error_log('=== Avatar Upload Debug ===');
        error_log('User ID: ' . $user_id);
        error_log('$_FILES content: ' . print_r($_FILES, true));
        error_log('Request file params: ' . print_r($request->get_file_params(), true));
        error_log('Request body params: ' . print_r($request->get_body_params(), true));
        
        // Try to get file from $_FILES first (most reliable)
        if (!empty($_FILES) && isset($_FILES['file'])) {
            $file = $_FILES['file'];
            error_log('File found in $_FILES');
        } 
        // Fallback to get_file_params()
        else {
            $files = $request->get_file_params();
            if (empty($files) || !isset($files['file'])) {
                error_log('ERROR: No file received in $_FILES or get_file_params()');
                return new WP_Error(
                    'missing_file', 
                    'No file received. Expected field: "file"', 
                    array(
                        'status' => 400,
                        'data' => array(
                            'files_count' => count($_FILES),
                            'files_keys' => array_keys($_FILES),
                            'request_files' => $request->get_file_params()
                        )
                    )
                );
            }
            $file = $files['file'];
            error_log('File found in get_file_params()');
        }
        
        error_log('File details: ' . print_r($file, true));
        
        // Validate file type
        $allowed_types = array('image/jpeg', 'image/jpg', 'image/png', 'image/gif');
        $file_type = isset($file['type']) ? $file['type'] : '';
        
        if (!in_array($file_type, $allowed_types)) {
            return new WP_Error('invalid_file_type', 'Invalid file type. Only JPG, PNG and GIF are allowed', array('status' => 400));
        }
        
        // Validate file size (max 5MB)
        $max_size = 5 * 1024 * 1024; // 5MB in bytes
        if (isset($file['size']) && $file['size'] > $max_size) {
            return new WP_Error('file_too_large', 'File size must be less than 5MB', array('status' => 400));
        }
        
        // Check for upload errors
        if (isset($file['error']) && $file['error'] !== UPLOAD_ERR_OK) {
            return new WP_Error('upload_error', 'File upload error: ' . $file['error'], array('status' => 500));
        }
        
        // Set current user context for BuddyPress
        bp_update_is_item_admin(true, 'members');
        
        // Simulate $_FILES for BuddyPress
        $_FILES['file'] = $file;
        
        // Log para debugging
        error_log('Avatar upload attempt for user: ' . $user_id);
        error_log('Files received: ' . print_r($_FILES, true));
        
        // Use BuddyPress native avatar upload handler
        $avatar = bp_core_avatar_handle_upload($_FILES, 'bp_core_avatar_handle_crop');
        
        if (is_wp_error($avatar)) {
            error_log('Avatar upload error: ' . $avatar->get_error_message());
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
            'full'  => $full_avatar,
            'thumb' => $thumb_avatar,
        ));
    }
    
    public function delete_avatar($request) {
        $user_id = $request->get_param('id');
        
        if (!function_exists('bp_core_delete_existing_avatar')) {
            return new WP_Error('buddypress_not_active', 'BuddyPress is not active', array('status' => 500));
        }
        
        $deleted = bp_core_delete_existing_avatar(array(
            'item_id' => $user_id,
            'object'  => 'user',
        ));
        
        if (!$deleted) {
            return new WP_Error('delete_failed', 'Could not delete avatar', array('status' => 500));
        }
        
        return rest_ensure_response(array(
            'success' => true,
            'message' => 'Avatar deleted successfully',
            'deleted' => true,
        ));
    }
    
    public function upload_cover($request) {
        $user_id = $request->get_param('id');
        
        if (!function_exists('bp_attachments_cover_image_ajax_upload')) {
            return new WP_Error('buddypress_not_active', 'BuddyPress cover images not supported', array('status' => 500));
        }
        
        // Verificar permisos
        if (!bp_is_item_admin() && get_current_user_id() != $user_id) {
            return new WP_Error('rest_forbidden', 'You do not have permission to upload this cover.', array('status' => 403));
        }
        
        // Check if file was uploaded
        $files = $request->get_file_params();
        
        if (empty($files) || !isset($files['file'])) {
            return new WP_Error('bp_rest_missing_file', 'No file was uploaded. Expected field name: "file"', array('status' => 400));
        }
        
        $file = $files['file'];
        
        // Validate file type
        $allowed_types = array('image/jpeg', 'image/jpg', 'image/png', 'image/gif');
        $file_type = isset($file['type']) ? $file['type'] : '';
        
        if (!in_array($file_type, $allowed_types)) {
            return new WP_Error('invalid_file_type', 'Invalid file type. Only JPG, PNG and GIF are allowed', array('status' => 400));
        }
        
        // Validate file size (max 10MB for covers)
        $max_size = 10 * 1024 * 1024; // 10MB in bytes
        if (isset($file['size']) && $file['size'] > $max_size) {
            return new WP_Error('file_too_large', 'File size must be less than 10MB', array('status' => 400));
        }
        
        // Check for upload errors
        if (isset($file['error']) && $file['error'] !== UPLOAD_ERR_OK) {
            return new WP_Error('upload_error', 'File upload error: ' . $file['error'], array('status' => 500));
        }
        
        // Set current user context for BuddyPress
        bp_update_is_item_admin(true, 'members');
        
        // Simulate $_FILES for BuddyPress
        $_FILES['file'] = $file;
        
        // Log para debugging
        error_log('Cover upload attempt for user: ' . $user_id);
        error_log('Files received: ' . print_r($_FILES, true));
        
        // Use BuddyPress attachments for cover
        require_once(ABSPATH . 'wp-admin/includes/file.php');
        require_once(ABSPATH . 'wp-admin/includes/image.php');
        
        $bp_attachments = new BP_Attachment_Cover_Image();
        $cover = $bp_attachments->upload($_FILES);
        
        if (is_wp_error($cover)) {
            error_log('Cover upload error: ' . $cover->get_error_message());
            return $cover;
        }
        
        if (empty($cover['url'])) {
            return new WP_Error('upload_failed', 'Failed to process cover upload', array('status' => 500));
        }
        
        // Save cover image
        bp_attachments_cover_image_update_position(array(
            'object'  => 'user',
            'item_id' => $user_id,
        ));
        
        return rest_ensure_response(array(
            'url' => $cover['url'],
        ));
    }
    
    public function delete_cover($request) {
        $user_id = $request->get_param('id');
        
        if (!function_exists('bp_attachments_delete_file')) {
            return new WP_Error('buddypress_not_active', 'BuddyPress cover images not supported', array('status' => 500));
        }
        
        $deleted = bp_attachments_delete_file(array(
            'object_dir' => 'members',
            'item_id'    => $user_id,
            'type'       => 'cover-image',
        ));
        
        if (!$deleted) {
            return new WP_Error('delete_failed', 'Could not delete cover', array('status' => 500));
        }
        
        return rest_ensure_response(array(
            'success' => true,
            'message' => 'Cover deleted successfully',
            'deleted' => true,
        ));
    }
    
    private function format_user_profile($user_id) {
        $user = get_userdata($user_id);
        $current_user_id = get_current_user_id();
        
        $profile = array(
            'id'           => $user->ID,
            'username'     => $user->user_login,
            'display_name' => $user->display_name,
            'email'        => $user->user_email,
            'avatar'       => get_avatar_url($user->ID),
            'description'  => $user->description,
            'registered'   => $user->user_registered,
            'profile_url'  => bp_core_get_user_domain($user->ID),
        );
        
        // Campos extendidos de BuddyPress
        if (function_exists('xprofile_get_field_data')) {
            $profile['bio'] = xprofile_get_field_data(1, $user_id);
            $profile['location'] = xprofile_get_field_data('Location', $user_id);
            $profile['website'] = xprofile_get_field_data('Website', $user_id);
        }
        
        // Estadísticas
        if (function_exists('friends_get_total_friend_count')) {
            $profile['friends_count'] = friends_get_total_friend_count($user_id);
        }
        
        if (function_exists('groups_total_groups_for_user')) {
            $profile['groups_count'] = groups_total_groups_for_user($user_id);
        }
        
        // Estado de amistad con el usuario actual
        if ($user_id != $current_user_id) {
            $profile['friendship_status'] = friends_check_friendship_status($current_user_id, $user_id);
            $profile['is_friend'] = friends_check_friendship($current_user_id, $user_id);
        }
        
        return $profile;
    }
    
    private function format_user_basic($user_id) {
        $user = get_userdata($user_id);
        
        return array(
            'id'           => $user->ID,
            'username'     => $user->user_login,
            'display_name' => $user->display_name,
            'avatar'       => get_avatar_url($user->ID),
            'profile_url'  => bp_core_get_user_domain($user->ID),
        );
    }
}
