<?php
/**
 * Messages Endpoint (Better Messages bridge)
 *
 * The website's inbox is the Better Messages plugin, which keeps its own
 * tables (bm_threads, bm_message_messages, bm_message_recipients). The app
 * used to send through BuddyPress (/buddypress/v1/messages), which writes to
 * BuddyPress' bp_messages_* tables instead — so app messages produced a
 * BuddyPress email + notification but never showed up in the website inbox
 * (beta item 2.18).
 *
 * These routes read and write Better Messages data for the signed-in user
 * and answer in the same shape as the BuddyPress REST messages endpoint, so
 * the app UI is unchanged.
 *
 * Endpoints:
 * - GET    /coral/v1/messages/threads              - Current user's conversations
 * - POST   /coral/v1/messages/threads              - Start (or continue) a conversation
 * - GET    /coral/v1/messages/threads/{id}         - One conversation with messages
 * - POST   /coral/v1/messages/threads/{id}         - Reply
 * - POST   /coral/v1/messages/threads/{id}/read    - Mark read
 * - DELETE /coral/v1/messages/threads/{id}         - Remove from the user's inbox
 *
 * Writes go through Better Messages' own PHP API
 * (Better_Messages()->functions->new_message()), so its notifications,
 * e-mails, push and real-time updates all fire as if sent from the website.
 * Reads query the Better Messages tables directly.
 *
 * When Better Messages is not active every route answers 501
 * (coral_messages_unavailable) and the app keeps using BuddyPress.
 *
 * ASSUMPTIONS (Better Messages 2.x, not verifiable without the live site):
 * - Tables: {prefix}bm_threads (id, subject, type),
 *   {prefix}bm_message_messages (id, thread_id, sender_id, message, date_sent),
 *   {prefix}bm_message_recipients (user_id, thread_id, unread_count, is_deleted).
 *   bm_get_table() is used when present.
 * - date_sent is stored in GMT.
 * - Better_Messages()->functions->new_message() accepts BuddyPress-style args
 *   (sender_id, thread_id | recipients + subject, content, error_type).
 */

// Prevent direct access
if (!defined('ABSPATH')) {
    exit;
}

class Coral_Messages_Endpoint {

    private $namespace = 'coral/v1';

    /** @var array<string,string>|null */
    private $tables = null;

    const MAX_PER_PAGE = 100;

    public function register_routes() {
        register_rest_route($this->namespace, '/messages/threads', array(
            array(
                'methods'             => WP_REST_Server::READABLE,
                'callback'            => array($this, 'get_threads'),
                'permission_callback' => array($this, 'check_permission'),
                'args'                => array(
                    'page'     => array('default' => 1, 'sanitize_callback' => 'absint'),
                    'per_page' => array('default' => 50, 'sanitize_callback' => 'absint'),
                ),
            ),
            array(
                'methods'             => WP_REST_Server::CREATABLE,
                'callback'            => array($this, 'create_thread'),
                'permission_callback' => array($this, 'check_permission'),
                'args'                => array(
                    'recipients' => array('required' => true),
                    'subject'    => array('type' => 'string', 'default' => ''),
                    'message'    => array('type' => 'string', 'required' => true),
                ),
            ),
        ));

        register_rest_route($this->namespace, '/messages/threads/(?P<id>\d+)', array(
            array(
                'methods'             => WP_REST_Server::READABLE,
                'callback'            => array($this, 'get_thread'),
                'permission_callback' => array($this, 'check_permission'),
                'args'                => array(
                    'page'     => array('default' => 1, 'sanitize_callback' => 'absint'),
                    'per_page' => array('default' => 20, 'sanitize_callback' => 'absint'),
                    'order'    => array('default' => 'desc', 'enum' => array('asc', 'desc')),
                ),
            ),
            array(
                'methods'             => WP_REST_Server::CREATABLE,
                'callback'            => array($this, 'reply'),
                'permission_callback' => array($this, 'check_permission'),
                'args'                => array(
                    'message' => array('type' => 'string', 'required' => true),
                ),
            ),
            array(
                'methods'             => WP_REST_Server::DELETABLE,
                'callback'            => array($this, 'delete_thread'),
                'permission_callback' => array($this, 'check_permission'),
            ),
        ));

        register_rest_route($this->namespace, '/messages/threads/(?P<id>\d+)/read', array(
            'methods'             => WP_REST_Server::CREATABLE,
            'callback'            => array($this, 'mark_read'),
            'permission_callback' => array($this, 'check_permission'),
        ));
    }

    public function check_permission($request) {
        return is_user_logged_in();
    }

    // ------------------------------------------------------------------
    // Better Messages plumbing
    // ------------------------------------------------------------------

    private function bm() {
        return function_exists('Better_Messages') ? Better_Messages() : null;
    }

    /**
     * Resolve Better Messages table names, or null when unavailable.
     * @return array<string,string>|null
     */
    private function tables() {
        if ($this->tables !== null) {
            return $this->tables ?: null;
        }

        global $wpdb;
        $names = array(
            'threads'    => 'bm_threads',
            'messages'   => 'bm_message_messages',
            'recipients' => 'bm_message_recipients',
        );

        $resolved = array();
        foreach ($names as $key => $suffix) {
            $candidates = array();
            if (function_exists('bm_get_table')) {
                $from_bm = bm_get_table($key);
                if (is_string($from_bm) && $from_bm !== '') {
                    $candidates[] = $from_bm;
                }
            }
            $candidates[] = $wpdb->prefix . $suffix;
            $candidates[] = $wpdb->base_prefix . $suffix;

            foreach (array_unique($candidates) as $table) {
                $found = $wpdb->get_var($wpdb->prepare('SHOW TABLES LIKE %s', $wpdb->esc_like($table)));
                if ($found === $table) {
                    $resolved[$key] = $table;
                    break;
                }
            }

            if (empty($resolved[$key])) {
                $this->tables = array();
                return null;
            }
        }

        $this->tables = $resolved;
        return $resolved;
    }

    /** @return true|WP_Error */
    private function ensure_available() {
        $bm = $this->bm();
        if (!$bm || !isset($bm->functions) || !method_exists($bm->functions, 'new_message') || !$this->tables()) {
            return new WP_Error(
                'coral_messages_unavailable',
                'Better Messages is not active on this site.',
                array('status' => 501)
            );
        }
        return true;
    }

    /** Is $user_id an active (not deleted) participant of $thread_id? */
    private function user_in_thread($thread_id, $user_id) {
        global $wpdb;
        $t = $this->tables();
        $row = $wpdb->get_var($wpdb->prepare(
            "SELECT COUNT(*) FROM {$t['recipients']} WHERE thread_id = %d AND user_id = %d AND is_deleted = 0",
            $thread_id,
            $user_id
        ));
        return ((int) $row) > 0;
    }

    private function to_dates($gmt) {
        $gmt = (string) $gmt;
        if ($gmt === '' || $gmt === '0000-00-00 00:00:00') {
            return array('', '');
        }
        $local = get_date_from_gmt($gmt, 'Y-m-d H:i:s');
        return array(mysql_to_rfc3339($local), mysql_to_rfc3339($gmt));
    }

    private function text_field($raw) {
        $raw = (string) $raw;
        return array(
            'raw'      => $raw,
            'rendered' => wpautop(wp_kses_post($raw)),
        );
    }

    private function participant($user_id, $unread_count = 0) {
        $user_id = (int) $user_id;
        $user    = get_userdata($user_id);
        $name    = $user ? $user->display_name : '';
        if (function_exists('bp_core_get_user_displayname')) {
            $bp_name = bp_core_get_user_displayname($user_id);
            if ($bp_name) {
                $name = $bp_name;
            }
        }

        $avatars = array('full' => '', 'thumb' => '');
        if (function_exists('bp_core_fetch_avatar')) {
            $avatars['full']  = (string) bp_core_fetch_avatar(array('item_id' => $user_id, 'type' => 'full', 'html' => false));
            $avatars['thumb'] = (string) bp_core_fetch_avatar(array('item_id' => $user_id, 'type' => 'thumb', 'html' => false));
        } else {
            $avatars['full']  = (string) get_avatar_url($user_id, array('size' => 300));
            $avatars['thumb'] = (string) get_avatar_url($user_id, array('size' => 96));
        }

        return array(
            'id'           => $user_id,
            'user_id'      => $user_id,
            'name'         => html_entity_decode((string) $name, ENT_QUOTES, 'UTF-8'),
            'user_link'    => function_exists('bp_core_get_user_domain') ? bp_core_get_user_domain($user_id) : '',
            'user_avatars' => $avatars,
            'unread_count' => (int) $unread_count,
        );
    }

    private function format_message($row) {
        list($local, $gmt) = $this->to_dates($row->date_sent);
        return array(
            'id'            => (int) $row->id,
            'thread_id'     => (int) $row->thread_id,
            'sender_id'     => (int) $row->sender_id,
            'message'       => $this->text_field($row->message),
            'date_sent'     => $local,
            'date_sent_gmt' => $gmt,
        );
    }

    /**
     * Build a BuddyPress-shaped thread object.
     *
     * @param int        $thread_id
     * @param int        $user_id   Current user.
     * @param array|null $messages  Formatted messages to include, or null.
     */
    private function format_thread($thread_id, $user_id, $messages = null) {
        global $wpdb;
        $t = $this->tables();

        $subject = (string) $wpdb->get_var($wpdb->prepare(
            "SELECT subject FROM {$t['threads']} WHERE id = %d",
            $thread_id
        ));

        $last = $wpdb->get_row($wpdb->prepare(
            "SELECT id, thread_id, sender_id, message, date_sent FROM {$t['messages']} WHERE thread_id = %d ORDER BY id DESC LIMIT 1",
            $thread_id
        ));

        $recipient_rows = $wpdb->get_results($wpdb->prepare(
            "SELECT user_id, unread_count, is_deleted FROM {$t['recipients']} WHERE thread_id = %d",
            $thread_id
        ));

        $recipients  = array();
        $my_unread   = 0;
        foreach ((array) $recipient_rows as $r) {
            if ((int) $r->user_id === (int) $user_id) {
                $my_unread = (int) $r->unread_count;
            }
            $recipients[] = $this->participant($r->user_id, $r->unread_count);
        }

        $sender_ids = array_map('intval', (array) $wpdb->get_col($wpdb->prepare(
            "SELECT DISTINCT sender_id FROM {$t['messages']} WHERE thread_id = %d",
            $thread_id
        )));

        $last_text = $last ? (string) $last->message : '';
        list($local, $gmt) = $this->to_dates($last ? $last->date_sent : '');

        $thread = array(
            'id'             => (int) $thread_id,
            'thread_id'      => (int) $thread_id,
            'message_id'     => $last ? (int) $last->id : 0,
            'last_sender_id' => $last ? (int) $last->sender_id : 0,
            'subject'        => $this->text_field($subject),
            'excerpt'        => $this->text_field(wp_trim_words(wp_strip_all_tags($last_text), 20, '…')),
            'message'        => $this->text_field($last_text),
            'date'           => $local,
            'date_gmt'       => $gmt,
            'unread_count'   => $my_unread,
            'sender_ids'     => $sender_ids,
            'recipients'     => $recipients,
            'source'         => 'better-messages',
        );

        if ($messages !== null) {
            $thread['messages'] = $messages;
        }

        return $thread;
    }

    private function sanitize_content($message) {
        // Plain text with line breaks (no HTML); emoji arrive as numeric
        // entities, which wp_kses keeps.
        $message = wp_kses(wp_check_invalid_utf8((string) $message), array());
        return trim($message);
    }

    /**
     * Send through Better Messages so its own notifications fire.
     * @return int|WP_Error Thread id.
     */
    private function bm_send($user_id, $content, $thread_id = 0, $recipients = array(), $subject = '') {
        global $wpdb;
        $t  = $this->tables();
        $bm = $this->bm();

        $before = (int) $wpdb->get_var($wpdb->prepare(
            "SELECT MAX(id) FROM {$t['messages']} WHERE sender_id = %d",
            $user_id
        ));

        $args = array(
            'sender_id'  => (int) $user_id,
            'content'    => $content,
            'error_type' => 'wp_error',
        );
        if ($thread_id) {
            $args['thread_id'] = (int) $thread_id;
        } else {
            $args['recipients'] = array_map('intval', $recipients);
            $args['subject']    = $subject;
        }

        $result = $bm->functions->new_message($args);

        if (is_wp_error($result)) {
            return new WP_Error(
                'coral_message_not_sent',
                $result->get_error_message() ?: 'Your message could not be sent.',
                array('status' => 400)
            );
        }
        if ($result === false || $result === null) {
            return new WP_Error('coral_message_not_sent', 'Your message could not be sent.', array('status' => 500));
        }

        // Find the message we just wrote. This does not depend on whether
        // new_message() returned a thread id or a message id.
        $row = $wpdb->get_row($wpdb->prepare(
            "SELECT id, thread_id FROM {$t['messages']} WHERE sender_id = %d AND id > %d ORDER BY id DESC LIMIT 1",
            $user_id,
            $before
        ));
        if (!$row) {
            return new WP_Error('coral_message_not_sent', 'Your message could not be sent.', array('status' => 500));
        }

        return (int) $row->thread_id;
    }

    /** Existing one-to-one conversation between two users, or 0. */
    private function find_private_thread($user_id, $other_id) {
        global $wpdb;
        $t = $this->tables();

        return (int) $wpdb->get_var($wpdb->prepare(
            "SELECT r1.thread_id
               FROM {$t['recipients']} r1
               JOIN {$t['recipients']} r2 ON r2.thread_id = r1.thread_id AND r2.user_id = %d
               JOIN {$t['threads']} th ON th.id = r1.thread_id
              WHERE r1.user_id = %d
                AND (th.type = 'thread' OR th.type = '' OR th.type IS NULL)
                AND (SELECT COUNT(*) FROM {$t['recipients']} r3 WHERE r3.thread_id = r1.thread_id) = 2
              ORDER BY r1.thread_id DESC
              LIMIT 1",
            $other_id,
            $user_id
        ));
    }

    // ------------------------------------------------------------------
    // Routes
    // ------------------------------------------------------------------

    public function get_threads($request) {
        $ok = $this->ensure_available();
        if (is_wp_error($ok)) return $ok;

        global $wpdb;
        $t        = $this->tables();
        $user_id  = get_current_user_id();
        $page     = max(1, (int) $request->get_param('page'));
        $per_page = min(self::MAX_PER_PAGE, max(1, (int) $request->get_param('per_page')));
        $offset   = ($page - 1) * $per_page;

        // Private conversations only (no group chats / chat rooms), newest first.
        $where = "r.user_id = %d AND r.is_deleted = 0 AND (th.type = 'thread' OR th.type = '' OR th.type IS NULL)";

        $total = (int) $wpdb->get_var($wpdb->prepare(
            "SELECT COUNT(DISTINCT r.thread_id)
               FROM {$t['recipients']} r
               JOIN {$t['threads']} th ON th.id = r.thread_id
               JOIN {$t['messages']} m ON m.thread_id = r.thread_id
              WHERE {$where}",
            $user_id
        ));

        $thread_ids = $wpdb->get_col($wpdb->prepare(
            "SELECT r.thread_id
               FROM {$t['recipients']} r
               JOIN {$t['threads']} th ON th.id = r.thread_id
               JOIN {$t['messages']} m ON m.thread_id = r.thread_id
              WHERE {$where}
              GROUP BY r.thread_id
              ORDER BY MAX(m.id) DESC
              LIMIT %d OFFSET %d",
            $user_id,
            $per_page,
            $offset
        ));

        $threads = array();
        foreach ((array) $thread_ids as $thread_id) {
            $threads[] = $this->format_thread((int) $thread_id, $user_id);
        }

        $response = rest_ensure_response($threads);
        $response->header('X-WP-Total', (string) $total);
        $response->header('X-WP-TotalPages', (string) max(1, (int) ceil($total / $per_page)));
        return $response;
    }

    public function get_thread($request) {
        $ok = $this->ensure_available();
        if (is_wp_error($ok)) return $ok;

        global $wpdb;
        $t         = $this->tables();
        $user_id   = get_current_user_id();
        $thread_id = (int) $request['id'];

        if (!$this->user_in_thread($thread_id, $user_id)) {
            return new WP_Error('coral_thread_not_found', 'Conversation not found.', array('status' => 404));
        }

        $page     = max(1, (int) $request->get_param('page'));
        $per_page = min(self::MAX_PER_PAGE, max(1, (int) $request->get_param('per_page')));
        $offset   = ($page - 1) * $per_page;

        // Always page from the newest message backwards.
        $rows = $wpdb->get_results($wpdb->prepare(
            "SELECT id, thread_id, sender_id, message, date_sent FROM {$t['messages']}
              WHERE thread_id = %d ORDER BY id DESC LIMIT %d OFFSET %d",
            $thread_id,
            $per_page,
            $offset
        ));

        $messages = array();
        foreach ((array) $rows as $row) {
            $messages[] = $this->format_message($row);
        }
        if ($request->get_param('order') === 'asc') {
            $messages = array_reverse($messages);
        }

        return rest_ensure_response($this->format_thread($thread_id, $user_id, $messages));
    }

    public function create_thread($request) {
        $ok = $this->ensure_available();
        if (is_wp_error($ok)) return $ok;

        $user_id = get_current_user_id();
        $content = $this->sanitize_content($request->get_param('message'));
        if ($content === '') {
            return new WP_Error('coral_message_empty', 'Please write a message.', array('status' => 400));
        }

        $raw_recipients = $request->get_param('recipients');
        $recipients = array();
        foreach ((array) $raw_recipients as $rid) {
            $rid = (int) $rid;
            if ($rid > 0 && $rid !== $user_id && get_userdata($rid)) {
                $recipients[$rid] = $rid;
            }
        }
        $recipients = array_values($recipients);

        if (empty($recipients)) {
            return new WP_Error('coral_message_no_recipients', 'Please choose who to message.', array('status' => 400));
        }

        $subject = sanitize_text_field((string) $request->get_param('subject'));

        // Continue an existing one-to-one conversation, like the website does.
        $thread_id = 0;
        if (count($recipients) === 1) {
            $thread_id = $this->find_private_thread($user_id, $recipients[0]);
            if ($thread_id) {
                $this->restore_for_user($thread_id, $user_id);
            }
        }

        $thread_id = $this->bm_send($user_id, $content, $thread_id, $recipients, $subject);
        if (is_wp_error($thread_id)) return $thread_id;

        return rest_ensure_response($this->thread_with_latest($thread_id, $user_id));
    }

    public function reply($request) {
        $ok = $this->ensure_available();
        if (is_wp_error($ok)) return $ok;

        $user_id   = get_current_user_id();
        $thread_id = (int) $request['id'];

        if (!$this->user_in_thread($thread_id, $user_id)) {
            return new WP_Error('coral_thread_not_found', 'Conversation not found.', array('status' => 404));
        }

        $content = $this->sanitize_content($request->get_param('message'));
        if ($content === '') {
            return new WP_Error('coral_message_empty', 'Please write a message.', array('status' => 400));
        }

        $sent = $this->bm_send($user_id, $content, $thread_id);
        if (is_wp_error($sent)) return $sent;

        return rest_ensure_response($this->thread_with_latest($thread_id, $user_id));
    }

    public function mark_read($request) {
        $ok = $this->ensure_available();
        if (is_wp_error($ok)) return $ok;

        global $wpdb;
        $t         = $this->tables();
        $user_id   = get_current_user_id();
        $thread_id = (int) $request['id'];

        if (!$this->user_in_thread($thread_id, $user_id)) {
            return new WP_Error('coral_thread_not_found', 'Conversation not found.', array('status' => 404));
        }

        $bm = $this->bm();
        if (method_exists($bm->functions, 'messages_mark_thread_read')) {
            $bm->functions->messages_mark_thread_read($thread_id, $user_id);
        }
        // Make sure the counter the inbox reads is cleared either way.
        $wpdb->update(
            $t['recipients'],
            array('unread_count' => 0),
            array('thread_id' => $thread_id, 'user_id' => $user_id),
            array('%d'),
            array('%d', '%d')
        );

        return rest_ensure_response($this->format_thread($thread_id, $user_id));
    }

    public function delete_thread($request) {
        $ok = $this->ensure_available();
        if (is_wp_error($ok)) return $ok;

        global $wpdb;
        $t         = $this->tables();
        $user_id   = get_current_user_id();
        $thread_id = (int) $request['id'];

        if (!$this->user_in_thread($thread_id, $user_id)) {
            return new WP_Error('coral_thread_not_found', 'Conversation not found.', array('status' => 404));
        }

        // Same as "delete" in the Better Messages inbox: hidden for this
        // user only; the other person keeps the conversation.
        $wpdb->update(
            $t['recipients'],
            array('is_deleted' => 1, 'unread_count' => 0),
            array('thread_id' => $thread_id, 'user_id' => $user_id),
            array('%d', '%d'),
            array('%d', '%d')
        );

        return rest_ensure_response(array('deleted' => true, 'id' => $thread_id));
    }

    // ------------------------------------------------------------------

    private function restore_for_user($thread_id, $user_id) {
        global $wpdb;
        $t = $this->tables();
        $wpdb->update(
            $t['recipients'],
            array('is_deleted' => 0),
            array('thread_id' => $thread_id, 'user_id' => $user_id),
            array('%d'),
            array('%d', '%d')
        );
    }

    /** Thread object with its latest page of messages (newest first). */
    private function thread_with_latest($thread_id, $user_id) {
        global $wpdb;
        $t = $this->tables();
        $rows = $wpdb->get_results($wpdb->prepare(
            "SELECT id, thread_id, sender_id, message, date_sent FROM {$t['messages']}
              WHERE thread_id = %d ORDER BY id DESC LIMIT 20",
            $thread_id
        ));
        $messages = array();
        foreach ((array) $rows as $row) {
            $messages[] = $this->format_message($row);
        }
        return $this->format_thread($thread_id, $user_id, $messages);
    }
}
