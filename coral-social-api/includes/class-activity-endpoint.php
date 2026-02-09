<?php
/**
 * Activity Endpoint
 * Manages BuddyPress activity feed
 * 
 * Endpoints:
 * - GET    /coral/v1/activity/feed - Get activity feed
 * - POST   /coral/v1/activity/feed - Create new activity
 * - GET    /coral/v1/activity/{id} - Get specific activity
 * - PUT    /coral/v1/activity/{id} - Update activity
 * - DELETE /coral/v1/activity/{id} - Delete activity
 * - POST   /coral/v1/activity/{id}/favorite - Mark/unmark as favorite
 * - POST   /coral/v1/activity/{id}/like - Like/unlike activity
 * 
 * BuddyPress REST API Reference:
 * - GET    /buddypress/v1/activity - List activities
 * - POST   /buddypress/v1/activity - Create activity
 * - GET    /buddypress/v1/activity/{id} - Get specific activity
 * - PUT    /buddypress/v1/activity/{id} - Update activity
 * - DELETE /buddypress/v1/activity/{id} - Delete activity
 * - POST   /buddypress/v1/activity/{id}/favorite - Mark as favorite
 */

class Coral_Activity_Endpoint {
    
    private $namespace = 'coral/v1';
    
    public function register_routes() {
        // Activity feed - list and create
        register_rest_route($this->namespace, '/activity/feed', array(
            array(
                'methods'             => WP_REST_Server::READABLE,
                'callback'            => array($this, 'get_activity_feed'),
                'permission_callback' => array($this, 'check_permission'),
                'args'                => $this->get_activity_args(),
            ),
            array(
                'methods'             => WP_REST_Server::CREATABLE,
                'callback'            => array($this, 'create_activity'),
                'permission_callback' => array($this, 'check_permission'),
                'args'                => $this->get_create_activity_args(),
            ),
        ));
        
        // Single activity - get, update, delete
        register_rest_route($this->namespace, '/activity/(?P<id>\d+)', array(
            array(
                'methods'             => WP_REST_Server::READABLE,
                'callback'            => array($this, 'get_single_activity'),
                'permission_callback' => array($this, 'check_permission'),
            ),
            array(
                'methods'             => WP_REST_Server::EDITABLE,
                'callback'            => array($this, 'update_activity'),
                'permission_callback' => array($this, 'check_permission'),
            ),
            array(
                'methods'             => WP_REST_Server::DELETABLE,
                'callback'            => array($this, 'delete_activity'),
                'permission_callback' => array($this, 'check_permission'),
            ),
        ));
        
        // Favorite activity
        register_rest_route($this->namespace, '/activity/(?P<id>\d+)/favorite', array(
            'methods'             => WP_REST_Server::CREATABLE,
            'callback'            => array($this, 'favorite_activity'),
            'permission_callback' => array($this, 'check_permission'),
        ));
        
        // Like activity (custom implementation)
        register_rest_route($this->namespace, '/activity/(?P<id>\d+)/like', array(
            'methods'             => WP_REST_Server::CREATABLE,
            'callback'            => array($this, 'like_activity'),
            'permission_callback' => array($this, 'check_permission'),
        ));
    }
    
    public function check_permission($request) {
        return is_user_logged_in();
    }
    
    private function get_activity_args() {
        return array(
            'page' => array(
                'default'           => 1,
                'sanitize_callback' => 'absint',
            ),
            'per_page' => array(
                'default'           => 20,
                'sanitize_callback' => 'absint',
            ),
            'user_id' => array(
                'default'           => false,
                'sanitize_callback' => 'absint',
            ),
            'type' => array(
                'default'           => '',
                'sanitize_callback' => 'sanitize_text_field',
            ),
            'scope' => array(
                'default'           => 'all',
                'sanitize_callback' => 'sanitize_text_field',
            ),
        );
    }
    
    private function get_create_activity_args() {
        return array(
            'content' => array(
                'required'          => true,
                'sanitize_callback' => 'sanitize_textarea_field',
            ),
            'type' => array(
                'default'           => 'activity_update',
                'sanitize_callback' => 'sanitize_text_field',
            ),
            'user_id' => array(
                'default'           => get_current_user_id(),
                'sanitize_callback' => 'absint',
            ),
            'primary_link' => array(
                'default'           => '',
                'sanitize_callback' => 'esc_url_raw',
            ),
        );
    }
    
    public function get_activity_feed($request) {
        if (!function_exists('bp_has_activities')) {
            return new WP_Error('buddypress_not_active', 'BuddyPress is not active', array('status' => 500));
        }
        
        $page = $request->get_param('page');
        $per_page = $request->get_param('per_page');
        $user_id = $request->get_param('user_id');
        $type = $request->get_param('type');
        $scope = $request->get_param('scope');
        
        $args = array(
            'page'     => $page,
            'per_page' => $per_page,
            'scope'    => $scope,
        );
        
        if ($user_id) {
            $args['user_id'] = $user_id;
        }
        
        if ($type) {
            $args['action'] = $type;
        }
        
        $activities = bp_activity_get($args);
        
        $formatted_activities = array();
        
        if (!empty($activities['activities'])) {
            foreach ($activities['activities'] as $activity) {
                $formatted_activities[] = $this->format_activity($activity);
            }
        }
        
        return rest_ensure_response(array(
            'success' => true,
            'data'    => $formatted_activities,
            'total'   => $activities['total'],
            'page'    => $page,
            'per_page' => $per_page,
        ));
    }
    
    public function get_single_activity($request) {
        $activity_id = $request->get_param('id');
        
        $activity = new BP_Activity_Activity($activity_id);
        
        if (empty($activity->id)) {
            return new WP_Error('activity_not_found', 'Activity not found', array('status' => 404));
        }
        
        return rest_ensure_response(array(
            'success' => true,
            'data'    => $this->format_activity($activity),
        ));
    }
    
    public function create_activity($request) {
        $content = $request->get_param('content');
        $type = $request->get_param('type');
        $user_id = $request->get_param('user_id');
        $primary_link = $request->get_param('primary_link');
        
        $activity_id = bp_activity_add(array(
            'user_id'      => $user_id,
            'content'      => $content,
            'type'         => $type,
            'primary_link' => $primary_link ? $primary_link : bp_core_get_user_domain($user_id),
        ));
        
        if (!$activity_id) {
            return new WP_Error('activity_creation_failed', 'Could not create activity', array('status' => 500));
        }
        
        $activity = new BP_Activity_Activity($activity_id);
        
        return rest_ensure_response(array(
            'success' => true,
            'message' => 'Activity created successfully',
            'data'    => $this->format_activity($activity),
        ));
    }
    
    public function update_activity($request) {
        $activity_id = $request->get_param('id');
        $content = $request->get_param('content');
        $user_id = get_current_user_id();
        
        $activity = new BP_Activity_Activity($activity_id);
        
        if (empty($activity->id)) {
            return new WP_Error('activity_not_found', 'Activity not found', array('status' => 404));
        }
        
        // Check permissions
        if ($activity->user_id != $user_id && !current_user_can('manage_options')) {
            return new WP_Error('unauthorized', 'You do not have permission to update this activity', array('status' => 403));
        }
        
        // Update activity
        $updated = bp_activity_update(array(
            'id'      => $activity_id,
            'content' => $content,
        ));
        
        if (!$updated) {
            return new WP_Error('update_failed', 'Could not update activity', array('status' => 500));
        }
        
        $activity = new BP_Activity_Activity($activity_id);
        
        return rest_ensure_response(array(
            'success' => true,
            'message' => 'Activity updated successfully',
            'data'    => $this->format_activity($activity),
        ));
    }
    
    public function delete_activity($request) {
        $activity_id = $request->get_param('id');
        $user_id = get_current_user_id();
        
        $activity = new BP_Activity_Activity($activity_id);
        
        if (empty($activity->id)) {
            return new WP_Error('activity_not_found', 'Activity not found', array('status' => 404));
        }
        
        // Check permissions
        if ($activity->user_id != $user_id && !current_user_can('manage_options')) {
            return new WP_Error('unauthorized', 'You do not have permission to delete this activity', array('status' => 403));
        }
        
        $deleted = bp_activity_delete(array('id' => $activity_id));
        
        if (!$deleted) {
            return new WP_Error('delete_failed', 'Could not delete activity', array('status' => 500));
        }
        
        return rest_ensure_response(array(
            'success' => true,
            'message' => 'Activity deleted successfully',
        ));
    }
    
    public function favorite_activity($request) {
        $activity_id = $request->get_param('id');
        $user_id = get_current_user_id();
        
        if (!function_exists('bp_activity_add_user_favorite')) {
            return new WP_Error('function_not_available', 'BuddyPress favorites not available', array('status' => 500));
        }
        
        $activity = new BP_Activity_Activity($activity_id);
        
        if (empty($activity->id)) {
            return new WP_Error('activity_not_found', 'Activity not found', array('status' => 404));
        }
        
        // Check if already favorited
        $is_favorite = bp_activity_is_favorite($activity_id, $user_id);
        
        if ($is_favorite) {
            // Remove favorite
            $result = bp_activity_remove_user_favorite($activity_id, $user_id);
            $action = 'unfavorited';
        } else {
            // Add favorite
            $result = bp_activity_add_user_favorite($activity_id, $user_id);
            $action = 'favorited';
        }
        
        if (!$result) {
            return new WP_Error('favorite_failed', 'Could not update favorite status', array('status' => 500));
        }
        
        return rest_ensure_response(array(
            'success' => true,
            'action'  => $action,
            'is_favorite' => !$is_favorite,
        ));
    }
    
    public function like_activity($request) {
        $activity_id = $request->get_param('id');
        $user_id = get_current_user_id();
        
        $activity = new BP_Activity_Activity($activity_id);
        
        if (empty($activity->id)) {
            return new WP_Error('activity_not_found', 'Activity not found', array('status' => 404));
        }
        
        // Verificar si ya dio like
        $has_liked = bp_activity_get_meta($activity_id, 'liked_by_' . $user_id);
        
        if ($has_liked) {
            // Unlike
            bp_activity_delete_meta($activity_id, 'liked_by_' . $user_id);
            $likes_count = (int) bp_activity_get_meta($activity_id, 'likes_count', true);
            bp_activity_update_meta($activity_id, 'likes_count', max(0, $likes_count - 1));
            $action = 'unliked';
        } else {
            // Like
            bp_activity_update_meta($activity_id, 'liked_by_' . $user_id, true);
            $likes_count = (int) bp_activity_get_meta($activity_id, 'likes_count', true);
            bp_activity_update_meta($activity_id, 'likes_count', $likes_count + 1);
            $action = 'liked';
        }
        
        $new_likes_count = (int) bp_activity_get_meta($activity_id, 'likes_count', true);
        
        return rest_ensure_response(array(
            'success' => true,
            'action'  => $action,
            'likes_count' => $new_likes_count,
        ));
    }
    
    private function format_activity($activity) {
        $user = get_userdata($activity->user_id);
        $likes_count = (int) bp_activity_get_meta($activity->id, 'likes_count', true);
        $has_liked = bp_activity_get_meta($activity->id, 'liked_by_' . get_current_user_id());
        
        return array(
            'id'           => $activity->id,
            'user_id'      => $activity->user_id,
            'user'         => array(
                'id'           => $user->ID,
                'name'         => $user->display_name,
                'avatar'       => get_avatar_url($user->ID),
                'profile_url'  => bp_core_get_user_domain($user->ID),
            ),
            'content'      => $activity->content,
            'type'         => $activity->type,
            'primary_link' => $activity->primary_link,
            'date_recorded' => $activity->date_recorded,
            'date_recorded_gmt' => get_gmt_from_date($activity->date_recorded),
            'likes_count'  => $likes_count,
            'has_liked'    => (bool) $has_liked,
            'comments_count' => bp_activity_get_comment_count($activity->id),
        );
    }
}
