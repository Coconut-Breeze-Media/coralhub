<?php
/**
 * Groups Endpoint
 * Manages BuddyPress groups
 * 
 * Endpoints:
 * - GET    /coral/v1/groups - List groups
 * - POST   /coral/v1/groups - Create group
 * - GET    /coral/v1/groups/{id} - Get specific group
 * - PUT    /coral/v1/groups/{id} - Update group
 * - DELETE /coral/v1/groups/{id} - Delete group
 * - GET    /coral/v1/groups/{id}/posts - Get group posts
 * - POST   /coral/v1/groups/{id}/posts - Create post in group
 * - GET    /coral/v1/groups/{id}/members - Get group members
 * - POST   /coral/v1/groups/{id}/members - Add member to group
 * - DELETE /coral/v1/groups/{id}/members/{user_id} - Remove member
 * - POST   /coral/v1/groups/{id}/join - Join group
 * - POST   /coral/v1/groups/{id}/leave - Leave group
 * 
 * BuddyPress REST API Reference:
 * - GET    /buddypress/v1/groups - List groups
 * - POST   /buddypress/v1/groups - Create group
 * - GET    /buddypress/v1/groups/{id} - Get specific group
 * - PUT    /buddypress/v1/groups/{id} - Update group
 * - DELETE /buddypress/v1/groups/{id} - Delete group
 * - GET    /buddypress/v1/groups/me - Get current user's groups
 * - GET    /buddypress/v1/groups/{group_id}/members - Group members
 * - POST   /buddypress/v1/groups/{group_id}/members - Add member
 * - DELETE /buddypress/v1/groups/{group_id}/members/{user_id} - Remove member
 */

class Coral_Groups_Endpoint {
    
    private $namespace = 'coral/v1';
    
    public function register_routes() {
        // Listar y crear grupos
        register_rest_route($this->namespace, '/groups', array(
            array(
                'methods'             => WP_REST_Server::READABLE,
                'callback'            => array($this, 'get_groups'),
                'permission_callback' => array($this, 'check_permission'),
                'args'                => $this->get_groups_args(),
            ),
            array(
                'methods'             => WP_REST_Server::CREATABLE,
                'callback'            => array($this, 'create_group'),
                'permission_callback' => array($this, 'check_permission'),
                'args'                => $this->get_create_group_args(),
            ),
        ));
        
        // Obtener, actualizar y eliminar grupo específico
        register_rest_route($this->namespace, '/groups/(?P<id>\d+)', array(
            array(
                'methods'             => WP_REST_Server::READABLE,
                'callback'            => array($this, 'get_single_group'),
                'permission_callback' => array($this, 'check_permission'),
            ),
            array(
                'methods'             => WP_REST_Server::EDITABLE,
                'callback'            => array($this, 'update_group'),
                'permission_callback' => array($this, 'check_permission'),
            ),
            array(
                'methods'             => WP_REST_Server::DELETABLE,
                'callback'            => array($this, 'delete_group'),
                'permission_callback' => array($this, 'check_permission'),
            ),
        ));
        
        // Posts de un grupo
        register_rest_route($this->namespace, '/groups/(?P<id>\d+)/posts', array(
            array(
                'methods'             => WP_REST_Server::READABLE,
                'callback'            => array($this, 'get_group_posts'),
                'permission_callback' => array($this, 'check_permission'),
                'args'                => $this->get_posts_args(),
            ),
            array(
                'methods'             => WP_REST_Server::CREATABLE,
                'callback'            => array($this, 'create_group_post'),
                'permission_callback' => array($this, 'check_permission'),
            ),
        ));
        
        // Miembros del grupo
        register_rest_route($this->namespace, '/groups/(?P<id>\d+)/members', array(
            array(
                'methods'             => WP_REST_Server::READABLE,
                'callback'            => array($this, 'get_group_members'),
                'permission_callback' => array($this, 'check_permission'),
            ),
            array(
                'methods'             => WP_REST_Server::CREATABLE,
                'callback'            => array($this, 'add_group_member'),
                'permission_callback' => array($this, 'check_permission'),
                'args'                => array(
                    'user_id' => array(
                        'required'          => true,
                        'sanitize_callback' => 'absint',
                    ),
                ),
            ),
        ));
        
        // Remover miembro específico
        register_rest_route($this->namespace, '/groups/(?P<id>\d+)/members/(?P<user_id>\d+)', array(
            'methods'             => WP_REST_Server::DELETABLE,
            'callback'            => array($this, 'remove_group_member'),
            'permission_callback' => array($this, 'check_permission'),
        ));
        
        // Unirse/salir del grupo
        register_rest_route($this->namespace, '/groups/(?P<id>\d+)/join', array(
            'methods'             => WP_REST_Server::CREATABLE,
            'callback'            => array($this, 'join_group'),
            'permission_callback' => array($this, 'check_permission'),
        ));
        
        register_rest_route($this->namespace, '/groups/(?P<id>\d+)/leave', array(
            'methods'             => WP_REST_Server::CREATABLE,
            'callback'            => array($this, 'leave_group'),
            'permission_callback' => array($this, 'check_permission'),
        ));
    }
    
    public function check_permission($request) {
        return is_user_logged_in();
    }
    
    private function get_groups_args() {
        return array(
            'page' => array(
                'default'           => 1,
                'sanitize_callback' => 'absint',
            ),
            'per_page' => array(
                'default'           => 20,
                'sanitize_callback' => 'absint',
            ),
            'type' => array(
                'default'           => 'active',
                'sanitize_callback' => 'sanitize_text_field',
            ),
            'user_id' => array(
                'default'           => false,
                'sanitize_callback' => 'absint',
            ),
            'search' => array(
                'default'           => '',
                'sanitize_callback' => 'sanitize_text_field',
            ),
        );
    }
    
    private function get_create_group_args() {
        return array(
            'name' => array(
                'required'          => true,
                'sanitize_callback' => 'sanitize_text_field',
            ),
            'description' => array(
                'required'          => true,
                'sanitize_callback' => 'sanitize_textarea_field',
            ),
            'status' => array(
                'default'           => 'public',
                'sanitize_callback' => 'sanitize_text_field',
            ),
        );
    }
    
    private function get_posts_args() {
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
    
    public function get_groups($request) {
        if (!function_exists('groups_get_groups')) {
            return new WP_Error('buddypress_not_active', 'BuddyPress Groups is not active', array('status' => 500));
        }
        
        $page = $request->get_param('page');
        $per_page = $request->get_param('per_page');
        $type = $request->get_param('type');
        $user_id = $request->get_param('user_id');
        $search = $request->get_param('search');
        
        $args = array(
            'page'     => $page,
            'per_page' => $per_page,
            'type'     => $type,
        );
        
        if ($user_id) {
            $args['user_id'] = $user_id;
        }
        
        if ($search) {
            $args['search_terms'] = $search;
        }
        
        $groups = groups_get_groups($args);
        
        $formatted_groups = array();
        
        if (!empty($groups['groups'])) {
            foreach ($groups['groups'] as $group) {
                $formatted_groups[] = $this->format_group($group);
            }
        }
        
        return rest_ensure_response(array(
            'success' => true,
            'data'    => $formatted_groups,
            'total'   => $groups['total'],
            'page'    => $page,
            'per_page' => $per_page,
        ));
    }
    
    public function get_single_group($request) {
        $group_id = $request->get_param('id');
        
        $group = groups_get_group($group_id);
        
        if (empty($group->id)) {
            return new WP_Error('group_not_found', 'Group not found', array('status' => 404));
        }
        
        return rest_ensure_response(array(
            'success' => true,
            'data'    => $this->format_group($group),
        ));
    }
    
    public function create_group($request) {
        $name = $request->get_param('name');
        $description = $request->get_param('description');
        $status = $request->get_param('status');
        $user_id = get_current_user_id();
        
        $group_id = groups_create_group(array(
            'creator_id'  => $user_id,
            'name'        => $name,
            'description' => $description,
            'status'      => $status,
            'enable_forum' => 1,
        ));
        
        if (!$group_id) {
            return new WP_Error('group_creation_failed', 'Could not create group', array('status' => 500));
        }
        
        // Set creator as admin
        groups_join_group($group_id, $user_id);
        
        $group = groups_get_group($group_id);
        
        return rest_ensure_response(array(
            'success' => true,
            'message' => 'Group created successfully',
            'data'    => $this->format_group($group),
        ));
    }
    
    public function update_group($request) {
        $group_id = $request->get_param('id');
        $user_id = get_current_user_id();
        
        $group = groups_get_group($group_id);
        
        if (empty($group->id)) {
            return new WP_Error('group_not_found', 'Group not found', array('status' => 404));
        }
        
        // Check if user is group admin
        if (!groups_is_user_admin($user_id, $group_id)) {
            return new WP_Error('unauthorized', 'You do not have permission to update this group', array('status' => 403));
        }
        
        $update_args = array('group_id' => $group_id);
        
        if ($request->has_param('name')) {
            $update_args['name'] = sanitize_text_field($request->get_param('name'));
        }
        
        if ($request->has_param('description')) {
            $update_args['description'] = sanitize_textarea_field($request->get_param('description'));
        }
        
        if ($request->has_param('status')) {
            $update_args['status'] = sanitize_text_field($request->get_param('status'));
        }
        
        $updated = groups_create_group($update_args);
        
        if (!$updated) {
            return new WP_Error('update_failed', 'Could not update group', array('status' => 500));
        }
        
        $group = groups_get_group($group_id);
        
        return rest_ensure_response(array(
            'success' => true,
            'message' => 'Group updated successfully',
            'data'    => $this->format_group($group),
        ));
    }
    
    public function delete_group($request) {
        $group_id = $request->get_param('id');
        $user_id = get_current_user_id();
        
        $group = groups_get_group($group_id);
        
        if (empty($group->id)) {
            return new WP_Error('group_not_found', 'Group not found', array('status' => 404));
        }
        
        // Check if user is group admin or super admin
        if (!groups_is_user_admin($user_id, $group_id) && !current_user_can('manage_options')) {
            return new WP_Error('unauthorized', 'You do not have permission to delete this group', array('status' => 403));
        }
        
        $deleted = groups_delete_group($group_id);
        
        if (!$deleted) {
            return new WP_Error('delete_failed', 'Could not delete group', array('status' => 500));
        }
        
        return rest_ensure_response(array(
            'success' => true,
            'message' => 'Group deleted successfully',
        ));
    }
    
    public function get_group_posts($request) {
        $group_id = $request->get_param('id');
        $page = $request->get_param('page');
        $per_page = $request->get_param('per_page');
        
        $group = groups_get_group($group_id);
        
        if (empty($group->id)) {
            return new WP_Error('group_not_found', 'Group not found', array('status' => 404));
        }
        
        // Obtener actividades del grupo
        $activities = bp_activity_get(array(
            'object'       => 'groups',
            'primary_id'   => $group_id,
            'page'         => $page,
            'per_page'     => $per_page,
        ));
        
        $formatted_posts = array();
        
        if (!empty($activities['activities'])) {
            foreach ($activities['activities'] as $activity) {
                $formatted_posts[] = $this->format_group_post($activity);
            }
        }
        
        return rest_ensure_response(array(
            'success' => true,
            'data'    => $formatted_posts,
            'total'   => $activities['total'],
            'page'    => $page,
            'per_page' => $per_page,
        ));
    }
    
    public function create_group_post($request) {
        $group_id = $request->get_param('id');
        $content = sanitize_textarea_field($request->get_param('content'));
        $user_id = get_current_user_id();
        
        $group = groups_get_group($group_id);
        
        if (empty($group->id)) {
            return new WP_Error('group_not_found', 'Group not found', array('status' => 404));
        }
        
        // Check if user is group member
        if (!groups_is_user_member($user_id, $group_id)) {
            return new WP_Error('not_member', 'You must be a member of the group to post', array('status' => 403));
        }
        
        $activity_id = groups_record_activity(array(
            'user_id'  => $user_id,
            'content'  => $content,
            'type'     => 'activity_update',
            'item_id'  => $group_id,
        ));
        
        if (!$activity_id) {
            return new WP_Error('post_creation_failed', 'Could not create post', array('status' => 500));
        }
        
        $activity = new BP_Activity_Activity($activity_id);
        
        return rest_ensure_response(array(
            'success' => true,
            'message' => 'Post created successfully',
            'data'    => $this->format_group_post($activity),
        ));
    }
    
    public function get_group_members($request) {
        $group_id = $request->get_param('id');
        
        $members = groups_get_group_members(array('group_id' => $group_id));
        
        $formatted_members = array();
        
        if (!empty($members['members'])) {
            foreach ($members['members'] as $member) {
                $formatted_members[] = array(
                    'id'          => $member->ID,
                    'name'        => $member->display_name,
                    'avatar'      => get_avatar_url($member->ID),
                    'profile_url' => bp_core_get_user_domain($member->ID),
                    'is_admin'    => groups_is_user_admin($member->ID, $group_id),
                    'is_mod'      => groups_is_user_mod($member->ID, $group_id),
                );
            }
        }
        
        return rest_ensure_response(array(
            'success' => true,
            'data'    => $formatted_members,
            'total'   => $members['count'],
        ));
    }
    
    public function join_group($request) {
        $group_id = $request->get_param('id');
        $user_id = get_current_user_id();
        
        $group = groups_get_group($group_id);
        
        if (empty($group->id)) {
            return new WP_Error('group_not_found', 'Group not found', array('status' => 404));
        }
        
        if (groups_is_user_member($user_id, $group_id)) {
            return new WP_Error('already_member', 'You are already a member of this group', array('status' => 400));
        }
        
        $joined = groups_join_group($group_id, $user_id);
        
        if (!$joined) {
            return new WP_Error('join_failed', 'Could not join group', array('status' => 500));
        }
        
        return rest_ensure_response(array(
            'success' => true,
            'message' => 'Successfully joined group',
        ));
    }
    
    public function leave_group($request) {
        $group_id = $request->get_param('id');
        $user_id = get_current_user_id();
        
        $group = groups_get_group($group_id);
        
        if (empty($group->id)) {
            return new WP_Error('group_not_found', 'Group not found', array('status' => 404));
        }
        
        if (!groups_is_user_member($user_id, $group_id)) {
            return new WP_Error('not_member', 'You are not a member of this group', array('status' => 400));
        }
        
        $left = groups_leave_group($group_id, $user_id);
        
        if (!$left) {
            return new WP_Error('leave_failed', 'Could not leave group', array('status' => 500));
        }
        
        return rest_ensure_response(array(
            'success' => true,
            'message' => 'Successfully left group',
        ));
    }
    
    public function add_group_member($request) {
        $group_id = $request->get_param('id');
        $target_user_id = $request->get_param('user_id');
        $current_user_id = get_current_user_id();
        
        $group = groups_get_group($group_id);
        
        if (empty($group->id)) {
            return new WP_Error('group_not_found', 'Group not found', array('status' => 404));
        }
        
        // Check if current user is admin
        if (!groups_is_user_admin($current_user_id, $group_id) && !current_user_can('manage_options')) {
            return new WP_Error('unauthorized', 'You do not have permission to add members', array('status' => 403));
        }
        
        if (groups_is_user_member($target_user_id, $group_id)) {
            return new WP_Error('already_member', 'User is already a member', array('status' => 400));
        }
        
        $added = groups_join_group($group_id, $target_user_id);
        
        if (!$added) {
            return new WP_Error('add_failed', 'Could not add member', array('status' => 500));
        }
        
        return rest_ensure_response(array(
            'success' => true,
            'message' => 'Member added successfully',
        ));
    }
    
    public function remove_group_member($request) {
        $group_id = $request->get_param('id');
        $target_user_id = $request->get_param('user_id');
        $current_user_id = get_current_user_id();
        
        $group = groups_get_group($group_id);
        
        if (empty($group->id)) {
            return new WP_Error('group_not_found', 'Group not found', array('status' => 404));
        }
        
        // Check if current user is admin
        if (!groups_is_user_admin($current_user_id, $group_id) && !current_user_can('manage_options')) {
            return new WP_Error('unauthorized', 'You do not have permission to remove members', array('status' => 403));
        }
        
        if (!groups_is_user_member($target_user_id, $group_id)) {
            return new WP_Error('not_member', 'User is not a member', array('status' => 400));
        }
        
        $removed = groups_remove_member($target_user_id, $group_id);
        
        if (!$removed) {
            return new WP_Error('remove_failed', 'Could not remove member', array('status' => 500));
        }
        
        return rest_ensure_response(array(
            'success' => true,
            'message' => 'Member removed successfully',
        ));
    }
    
    private function format_group($group) {
        $user_id = get_current_user_id();
        
        return array(
            'id'          => $group->id,
            'name'        => $group->name,
            'description' => $group->description,
            'slug'        => $group->slug,
            'status'      => $group->status,
            'date_created' => $group->date_created,
            'creator_id'  => $group->creator_id,
            'avatar'      => bp_core_fetch_avatar(array(
                'item_id' => $group->id,
                'object'  => 'group',
                'type'    => 'full',
                'html'    => false,
            )),
            'permalink'   => bp_get_group_permalink($group),
            'total_member_count' => $group->total_member_count,
            'is_member'   => groups_is_user_member($user_id, $group->id),
            'is_admin'    => groups_is_user_admin($user_id, $group->id),
            'is_mod'      => groups_is_user_mod($user_id, $group->id),
        );
    }
    
    private function format_group_post($activity) {
        $user = get_userdata($activity->user_id);
        
        return array(
            'id'           => $activity->id,
            'user_id'      => $activity->user_id,
            'user'         => array(
                'id'           => $user->ID,
                'name'         => $user->display_name,
                'avatar'       => get_avatar_url($user->ID),
            ),
            'content'      => $activity->content,
            'date_recorded' => $activity->date_recorded,
        );
    }
}
