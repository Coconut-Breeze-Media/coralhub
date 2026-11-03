<?php
/**
 * Search Endpoint
 * Site-wide search for the app's "Search CoRR Hub" screen
 *
 * Endpoints:
 * - GET /coral/v1/search?q=<terms>&page=1&per_page=20
 *
 * Runs the same WP_Query the website's own search uses (post_type "any",
 * relevance order), so pages, posts, custom post types (document library,
 * courses, …) and uploaded documents (PDFs etc.) all come back in one list.
 *
 * Paid Memberships Pro: results are filtered by PMPro's own search filter
 * when that is enabled, and for any result the caller cannot access the
 * excerpt is withheld and `locked` is true (title + link only).
 *
 * WordPress Core Reference (fallback the app uses when this is missing):
 * - GET /wp/v2/search?search=<terms>&type=post&subtype=any
 * - GET /wp/v2/media?search=<terms>&media_type=application
 */

// Prevent direct access
if (!defined('ABSPATH')) {
    exit;
}

class Coral_Search_Endpoint {

    private $namespace = 'coral/v1';

    const MAX_PER_PAGE = 30;

    public function register_routes() {
        register_rest_route($this->namespace, '/search', array(
            'methods'             => WP_REST_Server::READABLE,
            'callback'            => array($this, 'search'),
            'permission_callback' => array($this, 'check_permission'),
            'args'                => array(
                'q' => array(
                    'type'              => 'string',
                    'required'          => true,
                    'sanitize_callback' => 'sanitize_text_field',
                ),
                'page' => array(
                    'default'           => 1,
                    'sanitize_callback' => 'absint',
                ),
                'per_page' => array(
                    'default'           => 20,
                    'sanitize_callback' => 'absint',
                ),
            ),
        ));
    }

    public function check_permission($request) {
        return is_user_logged_in();
    }

    public function search($request) {
        $q        = trim((string) $request->get_param('q'));
        $page     = max(1, (int) $request->get_param('page'));
        $per_page = min(self::MAX_PER_PAGE, max(1, (int) $request->get_param('per_page')));

        if (mb_strlen($q) < 2) {
            return rest_ensure_response(array(
                'results'     => array(),
                'total'       => 0,
                'total_pages' => 0,
                'page'        => $page,
            ));
        }

        $query = new WP_Query(array(
            's'                   => $q,
            'post_type'           => 'any',
            // "inherit" is the status of uploaded files (attachments).
            'post_status'         => array('publish', 'inherit'),
            'orderby'             => 'relevance',
            'posts_per_page'      => $per_page,
            'paged'               => $page,
            'ignore_sticky_posts' => true,
            'has_password'        => false,
        ));

        $user_id = get_current_user_id();
        $results = array();

        foreach ($query->posts as $post) {
            $item = $this->format_result($post, $user_id);
            if ($item) {
                $results[] = $item;
            }
        }

        return rest_ensure_response(array(
            'results'     => $results,
            'total'       => (int) $query->found_posts,
            'total_pages' => (int) $query->max_num_pages,
            'page'        => $page,
        ));
    }

    /**
     * @return array|null Null when the item should not be shown.
     */
    private function format_result($post, $user_id) {
        if (!($post instanceof WP_Post)) {
            return null;
        }

        $is_attachment = ($post->post_type === 'attachment');

        if ($is_attachment) {
            // Only documents, not every image/video in the media library.
            $mime = (string) $post->post_mime_type;
            if (strpos($mime, 'application/') !== 0 && strpos($mime, 'text/') !== 0) {
                return null;
            }
            // Files attached to drafts/private posts stay hidden.
            if ($post->post_parent) {
                $parent_status = get_post_status($post->post_parent);
                if ($parent_status && $parent_status !== 'publish') {
                    return null;
                }
            }
        } elseif ($post->post_status !== 'publish') {
            return null;
        }

        $type_object = get_post_type_object($post->post_type);
        if (!$type_object || (!$type_object->public && !$is_attachment)) {
            return null;
        }

        $locked = false;
        if (function_exists('pmpro_has_membership_access')) {
            $check_id = ($is_attachment && $post->post_parent) ? (int) $post->post_parent : (int) $post->ID;
            $locked   = !pmpro_has_membership_access($check_id, $user_id);
        }

        $excerpt = '';
        if (!$locked) {
            if ($is_attachment) {
                $excerpt = $post->post_excerpt !== '' ? $post->post_excerpt : $post->post_content;
            } else {
                // get_the_excerpt() runs the_content filters, so any
                // membership plugin that hides content applies here too.
                $excerpt = get_the_excerpt($post);
            }
            $excerpt = wp_trim_words(wp_strip_all_tags(strip_shortcodes((string) $excerpt)), 40, '…');
        }

        $file_url = $is_attachment ? wp_get_attachment_url($post->ID) : '';

        return array(
            'id'         => (int) $post->ID,
            'type'       => $is_attachment ? 'document' : $post->post_type,
            'type_label' => $is_attachment
                ? $this->document_label((string) $post->post_mime_type)
                : (isset($type_object->labels->singular_name) ? $type_object->labels->singular_name : $post->post_type),
            'title'      => html_entity_decode(get_the_title($post), ENT_QUOTES, 'UTF-8'),
            'excerpt'    => html_entity_decode($excerpt, ENT_QUOTES, 'UTF-8'),
            'url'        => get_permalink($post),
            'file_url'   => $file_url ? $file_url : '',
            'mime_type'  => $is_attachment ? (string) $post->post_mime_type : '',
            'date'       => get_post_time('c', true, $post),
            'locked'     => $locked,
        );
    }

    private function document_label($mime) {
        if ($mime === 'application/pdf') {
            return 'PDF';
        }
        if (strpos($mime, 'word') !== false || strpos($mime, 'opendocument.text') !== false) {
            return 'Document';
        }
        if (strpos($mime, 'sheet') !== false || strpos($mime, 'excel') !== false) {
            return 'Spreadsheet';
        }
        if (strpos($mime, 'presentation') !== false || strpos($mime, 'powerpoint') !== false) {
            return 'Presentation';
        }
        return 'File';
    }
}
