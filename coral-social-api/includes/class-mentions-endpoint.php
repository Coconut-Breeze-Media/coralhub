<?php
/**
 * Mentions Endpoint
 * Manages @mentions in activities and comments
 * 
 * Endpoints:
 * - GET  /coral/v1/mentions - Get user mentions
 * - POST /coral/v1/mentions/mark-read - Mark mentions as read
 * - GET  /coral/v1/mentions/search - Search users to mention (autocomplete)
 * 
 * BuddyPress REST API Reference:
 * - GET  /buddypress/v1/activity?scope=mentions - Activities where user is mentioned
 * - GET  /buddypress/v1/notifications - Notifications (includes mentions)
 */

class Coral_Mentions_Endpoint {
    
    private $namespace = 'coral/v1';
    
    public function register_routes() {
        // Obtener menciones del usuario actual
        register_rest_route($this->namespace, '/mentions', array(
            'methods'             => WP_REST_Server::READABLE,
            'callback'            => array($this, 'get_mentions'),
            'permission_callback' => array($this, 'check_permission'),
            'args'                => $this->get_mentions_args(),
        ));
        
        // Marcar menciones como leídas
        register_rest_route($this->namespace, '/mentions/mark-read', array(
            'methods'             => WP_REST_Server::CREATABLE,
            'callback'            => array($this, 'mark_mentions_read'),
            'permission_callback' => array($this, 'check_permission'),
        ));
        
        // Buscar usuarios para mencionar (autocompletado)
        register_rest_route($this->namespace, '/mentions/search', array(
            'methods'             => WP_REST_Server::READABLE,
            'callback'            => array($this, 'search_users'),
            'permission_callback' => array($this, 'check_permission'),
            'args'                => array(
                'q' => array(
                    'required'          => true,
                    'sanitize_callback' => 'sanitize_text_field',
                ),
            ),
        ));
    }
    
    public function check_permission($request) {
        return is_user_logged_in();
    }
    
    private function get_mentions_args() {
        return array(
            'page' => array(
                'default'           => 1,
                'sanitize_callback' => 'absint',
            ),
            'per_page' => array(
                'default'           => 20,
                'sanitize_callback' => 'absint',
            ),
            'is_read' => array(
                'default'           => null,
                'sanitize_callback' => 'rest_sanitize_boolean',
            ),
        );
    }
    
    public function get_mentions($request) {
        if (!function_exists('bp_activity_get_mentions')) {
            return new WP_Error('buddypress_not_active', 'BuddyPress is not active', array('status' => 500));
        }
        
        $user_id = get_current_user_id();
        $page = $request->get_param('page');
        $per_page = $request->get_param('per_page');
        $is_read = $request->get_param('is_read');
        
        // Obtener actividades donde el usuario fue mencionado
        $args = array(
            'page'     => $page,
            'per_page' => $per_page,
            'search_terms' => '@' . bp_activity_get_user_mentionname($user_id),
        );
        
        $activities = bp_activity_get($args);
        
        $formatted_mentions = array();
        
        if (!empty($activities['activities'])) {
            foreach ($activities['activities'] as $activity) {
                // Verificar si debe filtrar por estado de leído
                $read_status = get_user_meta($user_id, 'mention_read_' . $activity->id, true);
                
                if ($is_read !== null) {
                    if ($is_read && !$read_status) {
                        continue;
                    }
                    if (!$is_read && $read_status) {
                        continue;
                    }
                }
                
                $formatted_mentions[] = $this->format_mention($activity, $user_id);
            }
        }
        
        return rest_ensure_response(array(
            'success' => true,
            'data'    => $formatted_mentions,
            'total'   => count($formatted_mentions),
            'page'    => $page,
            'per_page' => $per_page,
        ));
    }
    
    public function mark_mentions_read($request) {
        $user_id = get_current_user_id();
        $mention_ids = $request->get_param('mention_ids');
        
        if (empty($mention_ids)) {
            return new WP_Error('no_mentions', 'No mentions specified', array('status' => 400));
        }
        
        if (!is_array($mention_ids)) {
            $mention_ids = array($mention_ids);
        }
        
        foreach ($mention_ids as $mention_id) {
            $mention_id = absint($mention_id);
            update_user_meta($user_id, 'mention_read_' . $mention_id, true);
        }
        
        return rest_ensure_response(array(
            'success' => true,
            'message' => 'Mentions marked as read',
            'count'   => count($mention_ids),
        ));
    }
    
    public function search_users($request) {
        $query = $request->get_param('q');
        
        if (strlen($query) < 2) {
            return new WP_Error('query_too_short', 'Search must be at least 2 characters', array('status' => 400));
        }
        
        // Buscar usuarios
        $users = new WP_User_Query(array(
            'search'         => '*' . $query . '*',
            'search_columns' => array('user_login', 'user_nicename', 'display_name'),
            'number'         => 10,
            'orderby'        => 'display_name',
            'order'          => 'ASC',
        ));
        
        $results = array();
        
        if (!empty($users->get_results())) {
            foreach ($users->get_results() as $user) {
                $results[] = array(
                    'id'            => $user->ID,
                    'username'      => $user->user_login,
                    'display_name'  => $user->display_name,
                    'mention_name'  => '@' . (function_exists('bp_activity_get_user_mentionname') 
                        ? bp_activity_get_user_mentionname($user->ID) 
                        : $user->user_login),
                    'avatar'        => get_avatar_url($user->ID, array('size' => 32)),
                );
            }
        }
        
        return rest_ensure_response(array(
            'success' => true,
            'data'    => $results,
            'total'   => count($results),
        ));
    }
    
    private function format_mention($activity, $mentioned_user_id) {
        $user = get_userdata($activity->user_id);
        $is_read = get_user_meta($mentioned_user_id, 'mention_read_' . $activity->id, true);
        
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
            'date_recorded' => $activity->date_recorded,
            'date_recorded_gmt' => get_gmt_from_date($activity->date_recorded),
            'is_read'      => (bool) $is_read,
            'primary_link' => $activity->primary_link,
        );
    }
}
