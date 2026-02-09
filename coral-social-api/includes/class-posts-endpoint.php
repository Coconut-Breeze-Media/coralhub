<?php
/**
 * Posts Endpoint
 * Manages posts and comments
 * 
 * Endpoints:
 * - GET    /coral/v1/posts/{id}/comments - Get comments for a post/activity
 * - POST   /coral/v1/posts/{id}/comments - Create comment on post
 * - PUT    /coral/v1/posts/{post_id}/comments/{comment_id} - Update comment
 * - DELETE /coral/v1/posts/{post_id}/comments/{comment_id} - Delete comment
 * 
 * BuddyPress REST API Reference:
 * - GET    /buddypress/v1/activity?display_comments=threaded - Get comments
 * - POST   /buddypress/v1/activity - Create comment (with type=activity_comment)
 */

class Coral_Posts_Endpoint {
    
    private $namespace = 'coral/v1';
    
    public function register_routes() {
        // Comentarios de un post/actividad
        register_rest_route($this->namespace, '/posts/(?P<id>\d+)/comments', array(
            array(
                'methods'             => WP_REST_Server::READABLE,
                'callback'            => array($this, 'get_comments'),
                'permission_callback' => array($this, 'check_permission'),
                'args'                => $this->get_comments_args(),
            ),
            array(
                'methods'             => WP_REST_Server::CREATABLE,
                'callback'            => array($this, 'create_comment'),
                'permission_callback' => array($this, 'check_permission'),
            ),
        ));
        
        // Comentario específico
        register_rest_route($this->namespace, '/posts/(?P<post_id>\d+)/comments/(?P<comment_id>\d+)', array(
            array(
                'methods'             => WP_REST_Server::EDITABLE,
                'callback'            => array($this, 'update_comment'),
                'permission_callback' => array($this, 'check_permission'),
            ),
            array(
                'methods'             => WP_REST_Server::DELETABLE,
                'callback'            => array($this, 'delete_comment'),
                'permission_callback' => array($this, 'check_permission'),
            ),
        ));
    }
    
    public function check_permission($request) {
        return is_user_logged_in();
    }
    
    private function get_comments_args() {
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
    
    public function get_comments($request) {
        $activity_id = $request->get_param('id');
        $page = $request->get_param('page');
        $per_page = $request->get_param('per_page');
        
        // Verify activity exists
        $activity = new BP_Activity_Activity($activity_id);
        
        if (empty($activity->id)) {
            return new WP_Error('activity_not_found', 'Activity not found', array('status' => 404));
        }
        
        // Obtener comentarios de la actividad
        $comments = bp_activity_get_comments(array(
            'activity_id' => $activity_id,
            'spam'        => 'ham_only',
        ));
        
        $formatted_comments = array();
        
        if (!empty($comments)) {
            foreach ($comments as $comment) {
                $formatted_comments[] = $this->format_comment($comment);
            }
        }
        
        // Paginar manualmente
        $total = count($formatted_comments);
        $offset = ($page - 1) * $per_page;
        $formatted_comments = array_slice($formatted_comments, $offset, $per_page);
        
        return rest_ensure_response(array(
            'success' => true,
            'data'    => $formatted_comments,
            'total'   => $total,
            'page'    => $page,
            'per_page' => $per_page,
        ));
    }
    
    public function create_comment($request) {
        $activity_id = $request->get_param('id');
        $content = sanitize_textarea_field($request->get_param('content'));
        $user_id = get_current_user_id();
        
        if (empty($content)) {
            return new WP_Error('empty_content', 'Comment cannot be empty', array('status' => 400));
        }
        
        // Verify activity exists
        $activity = new BP_Activity_Activity($activity_id);
        
        if (empty($activity->id)) {
            return new WP_Error('activity_not_found', 'Activity not found', array('status' => 404));
        }
        
        // Create comment
        $comment_id = bp_activity_new_comment(array(
            'activity_id' => $activity_id,
            'content'     => $content,
            'user_id'     => $user_id,
        ));
        
        if (!$comment_id) {
            return new WP_Error('comment_creation_failed', 'Could not create comment', array('status' => 500));
        }
        
        $comment = new BP_Activity_Activity($comment_id);
        
        return rest_ensure_response(array(
            'success' => true,
            'message' => 'Comment created successfully',
            'data'    => $this->format_comment($comment),
        ));
    }
    
    public function update_comment($request) {
        $comment_id = $request->get_param('comment_id');
        $content = sanitize_textarea_field($request->get_param('content'));
        $user_id = get_current_user_id();
        
        if (empty($content)) {
            return new WP_Error('empty_content', 'Comment cannot be empty', array('status' => 400));
        }
        
        $comment = new BP_Activity_Activity($comment_id);
        
        if (empty($comment->id)) {
            return new WP_Error('comment_not_found', 'Comment not found', array('status' => 404));
        }
        
        // Check permissions
        if ($comment->user_id != $user_id && !current_user_can('manage_options')) {
            return new WP_Error('unauthorized', 'You do not have permission to edit this comment', array('status' => 403));
        }
        
        // Update comment
        $updated = bp_activity_update(array(
            'id'      => $comment_id,
            'content' => $content,
        ));
        
        if (!$updated) {
            return new WP_Error('update_failed', 'Could not update comment', array('status' => 500));
        }
        
        $comment = new BP_Activity_Activity($comment_id);
        
        return rest_ensure_response(array(
            'success' => true,
            'message' => 'Comment updated successfully',
            'data'    => $this->format_comment($comment),
        ));
    }
    
    public function delete_comment($request) {
        $comment_id = $request->get_param('comment_id');
        $user_id = get_current_user_id();
        
        $comment = new BP_Activity_Activity($comment_id);
        
        if (empty($comment->id)) {
            return new WP_Error('comment_not_found', 'Comment not found', array('status' => 404));
        }
        
        // Check permissions
        if ($comment->user_id != $user_id && !current_user_can('manage_options')) {
            return new WP_Error('unauthorized', 'You do not have permission to delete this comment', array('status' => 403));
        }
        
        $deleted = bp_activity_delete_comment($comment->item_id, $comment->id);
        
        if (!$deleted) {
            return new WP_Error('delete_failed', 'Could not delete comment', array('status' => 500));
        }
        
        return rest_ensure_response(array(
            'success' => true,
            'message' => 'Comment deleted successfully',
        ));
    }
    
    private function format_comment($comment) {
        $user = get_userdata($comment->user_id);
        
        return array(
            'id'           => $comment->id,
            'activity_id'  => $comment->item_id,
            'user_id'      => $comment->user_id,
            'user'         => array(
                'id'           => $user->ID,
                'name'         => $user->display_name,
                'avatar'       => get_avatar_url($user->ID),
                'profile_url'  => bp_core_get_user_domain($user->ID),
            ),
            'content'      => $comment->content,
            'date_recorded' => $comment->date_recorded,
            'date_recorded_gmt' => get_gmt_from_date($comment->date_recorded),
        );
    }
}
