<?php
/**
 * Activity enhancements for the CoRR Hub app.
 *
 * The app reads and writes posts through BuddyPress' own REST API
 * (/buddypress/v1/activity). This class adjusts that API so app posts behave
 * like posts made on the website:
 *
 * - Emoji: 4-byte characters are stored as HTML entities when the activity
 *   table is not utf8mb4 (what WordPress core does for posts), and emoji
 *   images (`<img class="wp-smiley|emoji">`) are returned as their unicode
 *   `alt` text so clients never mistake them for post photos.
 * - Link previews: when an activity containing a URL is created/edited via
 *   REST, its Open Graph data (title, description, image) is fetched and
 *   stored, and every activity exposes a normalized `link_preview` field —
 *   built from the website's own link-preview meta when it exists.
 * - Shares: the website's share feature references the original activity in
 *   `secondary_item_id`. Shares created by older app builds only set
 *   `item_id`; they are normalized, and a `shared_activity_id` field tells
 *   clients which activity a share embeds regardless of how it was stored.
 */

if (!defined('ABSPATH')) {
    exit;
}

class Coral_Activity_Enhancements {

    /** Our own normalized preview cache (also used as a negative cache). */
    const PREVIEW_META_KEY = '_coral_link_preview';

    /** Max remote Open Graph fetches while serving a single REST request. */
    const LAZY_FETCH_BUDGET = 1;

    private $lazy_fetches = 0;

    public function __construct() {
        add_filter('bp_activity_content_before_save', array($this, 'encode_emoji_for_storage'), 5, 2);
        add_action('bp_activity_before_save', array($this, 'normalize_share_before_save'), 5);
        add_action('bp_activity_after_save', array($this, 'maybe_store_link_preview'), 20);
        add_filter('bp_rest_activity_prepare_value', array($this, 'replace_emoji_images_in_response'), 10, 3);
        add_action('rest_api_init', array($this, 'register_rest_fields'));
        add_action('admin_init', array($this, 'migrate_legacy_app_shares'));
    }

    private function is_rest_request() {
        return defined('REST_REQUEST') && REST_REQUEST;
    }

    // ------------------------------------------------------------------
    // Emoji
    // ------------------------------------------------------------------

    /**
     * Store emoji as HTML entities when the activity content column cannot
     * hold 4-byte UTF-8 (utf8/utf8mb3, latin1). Otherwise MySQL strips or
     * mangles them and comments come back as "ð" instead of "😀".
     */
    public function encode_emoji_for_storage($content, $activity = null) {
        global $wpdb;

        if (!is_string($content) || '' === $content || !function_exists('wp_encode_emoji') || !function_exists('buddypress')) {
            return $content;
        }

        $bp = buddypress();
        if (empty($bp->activity->table_name) || !method_exists($wpdb, 'get_col_charset')) {
            return $content;
        }

        $charset = $wpdb->get_col_charset($bp->activity->table_name, 'content');
        if (is_string($charset) && 'utf8mb4' !== $charset) {
            $content = wp_encode_emoji($content);
        }

        return $content;
    }

    /** Return true for an <img> tag that is an emoji/smiley rather than a photo. */
    public static function is_emoji_image_tag($tag) {
        if (preg_match('/\bclass\s*=\s*["\']([^"\']*)["\']/i', $tag, $class)
            && preg_match('/\b(wp-smiley|emoji|emojione\w*|joypixels|twemoji)\b/i', $class[1])) {
            return true;
        }

        if (preg_match('/\b(?:src|data-src)\s*=\s*["\']([^"\']*)["\']/i', $tag, $src)) {
            return (bool) preg_match('#s\.w\.org/images/core/emoji|/emoji/|twemoji|emojione|joypixels|/smilies/#i', $src[1]);
        }

        return false;
    }

    /** Replace emoji <img> tags with their unicode alt text. */
    public static function replace_emoji_images($html) {
        if (!is_string($html) || false === stripos($html, '<img')) {
            return $html;
        }

        return preg_replace_callback('/<img\b[^>]*>/i', function ($match) {
            $tag = $match[0];
            if (!self::is_emoji_image_tag($tag)) {
                return $tag;
            }
            return preg_match('/\balt\s*=\s*["\']([^"\']*)["\']/i', $tag, $alt) ? $alt[1] : '';
        }, $html);
    }

    /** BuddyPress REST: never send emoji images as <img> markup. */
    public function replace_emoji_images_in_response($response, $request, $activity) {
        if (!($response instanceof WP_REST_Response)) {
            return $response;
        }

        $data = $response->get_data();
        if (isset($data['content']['rendered'])) {
            $data['content']['rendered'] = self::replace_emoji_images($data['content']['rendered']);
            $response->set_data($data);
        }

        return $response;
    }

    // ------------------------------------------------------------------
    // REST fields
    // ------------------------------------------------------------------

    public function register_rest_fields() {
        if (!function_exists('bp_activity_get_meta')) {
            return;
        }

        register_rest_field('activity', 'link_preview', array(
            'get_callback' => array($this, 'rest_get_link_preview'),
            'schema'       => array(
                'description' => __('Open Graph preview of the first link in the activity.', 'coral-social-api'),
                'type'        => array('object', 'null'),
                'context'     => array('view', 'edit'),
            ),
        ));

        register_rest_field('activity', 'shared_activity_id', array(
            'get_callback' => array($this, 'rest_get_shared_activity_id'),
            'schema'       => array(
                'description' => __('For a share, the ID of the original activity.', 'coral-social-api'),
                'type'        => array('integer', 'null'),
                'context'     => array('view', 'edit'),
            ),
        ));
    }

    private function field_value($object, $key) {
        if (is_array($object)) {
            return isset($object[$key]) ? $object[$key] : null;
        }
        return isset($object->$key) ? $object->$key : null;
    }

    // ------------------------------------------------------------------
    // Shares
    // ------------------------------------------------------------------

    private function is_share_type($type) {
        return is_string($type) && false !== stripos($type, 'share') && 'post_share' !== $type;
    }

    /** Resolve the original activity a share embeds, however it was stored. */
    public function rest_get_shared_activity_id($object) {
        $type = $this->field_value($object, 'type');
        if (!$this->is_share_type($type)) {
            return null;
        }

        $id = (int) $this->field_value($object, 'id');
        $candidates = array((int) $this->field_value($object, 'secondary_item_id'));

        $meta_keys = apply_filters('coral_shared_activity_meta_keys', array(
            'shared_activity_id',
            '_shared_activity_id',
            'bp_share_activity_id',
            'original_activity_id',
        ));
        foreach ((array) $meta_keys as $meta_key) {
            $candidates[] = (int) bp_activity_get_meta($id, $meta_key, true);
        }

        if ('groups' !== $this->field_value($object, 'component')) {
            $candidates[] = (int) $this->field_value($object, 'primary_item_id');
        }

        foreach ($candidates as $candidate) {
            if ($candidate > 0 && $candidate !== $id && $this->activity_exists($candidate)) {
                return $candidate;
            }
        }

        return null;
    }

    private function activity_exists($activity_id) {
        $activity = new BP_Activity_Activity($activity_id);
        return !empty($activity->id);
    }

    /**
     * Shares created through REST by older app builds put the original in
     * `item_id` only. Mirror it into `secondary_item_id`, where the website's
     * share feature looks for it.
     */
    public function normalize_share_before_save($activity) {
        if (!$this->is_rest_request() || !is_object($activity) || !$this->is_share_type($activity->type)) {
            return;
        }

        if (empty($activity->secondary_item_id) && !empty($activity->item_id) && 'activity' === $activity->component) {
            $activity->secondary_item_id = (int) $activity->item_id;
        }
    }

    /** One-time fix for shares the app created before secondary_item_id was sent. */
    public function migrate_legacy_app_shares() {
        global $wpdb;

        if (get_option('coral_share_migration_v1') || !function_exists('buddypress') || !current_user_can('manage_options')) {
            return;
        }

        $table = buddypress()->activity->table_name;
        $wpdb->query(
            "UPDATE {$table} AS share
             INNER JOIN {$table} AS original ON original.id = share.item_id
             SET share.secondary_item_id = share.item_id
             WHERE share.type = 'activity_share'
               AND share.component = 'activity'
               AND share.item_id > 0
               AND (share.secondary_item_id IS NULL OR share.secondary_item_id = 0)"
        );

        update_option('coral_share_migration_v1', time(), false);
    }

    // ------------------------------------------------------------------
    // Link previews
    // ------------------------------------------------------------------

    /** REST field callback: normalized preview or null. */
    public function rest_get_link_preview($object) {
        $id = (int) $this->field_value($object, 'id');
        $type = $this->field_value($object, 'type');
        if (!$id || 'activity_comment' === $type) {
            return null;
        }

        $preview = $this->get_site_link_preview($id);
        if ($preview) {
            return $preview;
        }

        $stored = bp_activity_get_meta($id, self::PREVIEW_META_KEY, true);
        if (is_array($stored)) {
            return !empty($stored['none']) ? null : $this->public_preview($stored);
        }

        // Older posts (including website posts whose preview meta format we
        // don't know) get a preview lazily, a few per request.
        if ($this->lazy_fetches >= self::LAZY_FETCH_BUDGET) {
            return null;
        }

        $content = $this->field_value($object, 'content');
        $html = is_array($content) ? (isset($content['raw']) ? $content['raw'] : (isset($content['rendered']) ? $content['rendered'] : '')) : (string) $content;
        $url = $this->first_url($html);
        if (!$url) {
            bp_activity_update_meta($id, self::PREVIEW_META_KEY, array('none' => true, 'url' => ''));
            return null;
        }

        $this->lazy_fetches++;
        $preview = $this->store_preview_for_url($id, $url);
        return $preview ? $this->public_preview($preview) : null;
    }

    /**
     * Preview data saved by the website (BuddyPress/BuddyBoss/plugins), if
     * any, normalized to {url, title, description, image, site_name}.
     */
    private function get_site_link_preview($activity_id) {
        $meta_keys = apply_filters('coral_link_preview_meta_keys', array(
            '_link_preview_data',
            'bp_activity_link_preview_data',
            '_bp_activity_link_preview',
            'bp_activity_link_preview',
            'link_preview',
        ));

        foreach ((array) $meta_keys as $meta_key) {
            $data = bp_activity_get_meta($activity_id, $meta_key, true);
            if (is_string($data) && '' !== $data) {
                $decoded = json_decode($data, true);
                $data = is_array($decoded) ? $decoded : maybe_unserialize($data);
            }
            if (!is_array($data) || empty($data['url'])) {
                continue;
            }

            $image = '';
            foreach (array('image', 'image_url', 'thumbnail', 'thumb', 'img') as $image_key) {
                if (!empty($data[$image_key]) && is_string($data[$image_key])) {
                    $image = $data[$image_key];
                    break;
                }
            }
            if (!$image && !empty($data['attachment_id'])) {
                $image = (string) wp_get_attachment_image_url((int) $data['attachment_id'], 'large');
            }
            if (!$image && !empty($data['images']) && is_array($data['images'])) {
                $image = (string) reset($data['images']);
            }

            $preview = $this->public_preview(array(
                'url'         => $data['url'],
                'title'       => isset($data['title']) ? $data['title'] : '',
                'description' => isset($data['description']) ? $data['description'] : '',
                'image'       => $image,
                'site_name'   => isset($data['site_name']) ? $data['site_name'] : '',
            ));
            if ($preview) {
                return $preview;
            }
        }

        return null;
    }

    private function public_preview($data) {
        $url = isset($data['url']) ? esc_url_raw($data['url']) : '';
        $title = isset($data['title']) ? wp_strip_all_tags((string) $data['title']) : '';
        $description = isset($data['description']) ? wp_strip_all_tags((string) $data['description']) : '';
        $image = isset($data['image']) ? esc_url_raw((string) $data['image']) : '';

        if (!$url || ('' === $title && '' === $description && '' === $image)) {
            return null;
        }

        return array(
            'url'         => $url,
            'title'       => $title,
            'description' => wp_trim_words($description, 50, '…'),
            'image'       => $image,
            'site_name'   => isset($data['site_name']) ? wp_strip_all_tags((string) $data['site_name']) : '',
        );
    }

    /**
     * After an activity is created/edited through REST (the app), fetch and
     * store a preview for its first link so the create response and the feed
     * already include it.
     */
    public function maybe_store_link_preview($activity) {
        if (!$this->is_rest_request() || !is_object($activity) || empty($activity->id)) {
            return;
        }
        if (!in_array($activity->type, apply_filters('coral_link_preview_activity_types', array('activity_update', 'activity_status', 'activity_share')), true)) {
            return;
        }

        $url = $this->first_url($activity->content);
        $stored = bp_activity_get_meta($activity->id, self::PREVIEW_META_KEY, true);
        $stored_url = is_array($stored) && isset($stored['url']) ? $stored['url'] : null;

        if (!$url) {
            if (is_array($stored) && !empty($stored['mirrored'])) {
                bp_activity_delete_meta($activity->id, apply_filters('coral_link_preview_mirror_meta_key', '_link_preview_data'));
            }
            bp_activity_update_meta($activity->id, self::PREVIEW_META_KEY, array('none' => true, 'url' => ''));
            return;
        }

        if ($stored_url === $url) {
            return;
        }

        $this->store_preview_for_url($activity->id, $url);
    }

    /** Fetch Open Graph data for $url and save it on the activity. */
    private function store_preview_for_url($activity_id, $url) {
        $previous = bp_activity_get_meta($activity_id, self::PREVIEW_META_KEY, true);
        $owns_mirror = is_array($previous) && !empty($previous['mirrored']);
        $mirror_key = apply_filters('coral_link_preview_mirror_meta_key', '_link_preview_data');

        $preview = $this->fetch_open_graph($url);

        if (!$preview) {
            if ($owns_mirror && $mirror_key) {
                bp_activity_delete_meta($activity_id, $mirror_key);
            }
            bp_activity_update_meta($activity_id, self::PREVIEW_META_KEY, array('none' => true, 'url' => $url));
            return null;
        }

        // Also save it in the BuddyBoss / BuddyPress link-preview format —
        // unless the website stored its own there — so website templates that
        // read that meta can show the same card.
        $preview['mirrored'] = false;
        if ($mirror_key && ($owns_mirror || !bp_activity_get_meta($activity_id, $mirror_key, true))) {
            bp_activity_update_meta($activity_id, $mirror_key, array(
                'url'           => $preview['url'],
                'title'         => $preview['title'],
                'description'   => $preview['description'],
                'image_url'     => $preview['image'],
                'attachment_id' => 0,
            ));
            $preview['mirrored'] = true;
        }

        bp_activity_update_meta($activity_id, self::PREVIEW_META_KEY, $preview);

        return $preview;
    }

    /** First external link in activity content (anchor href or bare URL). */
    private function first_url($html) {
        if (!is_string($html) || '' === $html) {
            return null;
        }

        // Collect [offset => url] so the link that appears first wins.
        $candidates = array();
        if (preg_match_all('/<a\b([^>]*)>.*?<\/a>/is', $html, $anchors, PREG_OFFSET_CAPTURE)) {
            foreach ($anchors[1] as $index => $attributes) {
                // Skip @mention links BuddyPress adds to member profiles.
                if (preg_match('/class\s*=\s*["\'][^"\']*mention/i', $attributes[0])) {
                    continue;
                }
                if (preg_match('/href\s*=\s*["\']([^"\']+)["\']/i', $attributes[0], $href)) {
                    $candidates[$anchors[0][$index][1]] = html_entity_decode($href[1], ENT_QUOTES, 'UTF-8');
                }
            }
        }

        // Bare URLs outside anchors and tags.
        $masked = preg_replace_callback('/<a\b.*?<\/a>|<[^>]+>/is', function ($match) {
            return str_repeat(' ', strlen($match[0]));
        }, $html);
        if (preg_match_all('#https?://[^\s<>"\']+#i', $masked, $plain, PREG_OFFSET_CAPTURE)) {
            foreach ($plain[0] as $match) {
                $candidates[$match[1]] = rtrim($match[0], '.,;:!?)]}');
            }
        }
        ksort($candidates);

        $site_host = wp_parse_url(home_url(), PHP_URL_HOST);
        foreach ($candidates as $candidate) {
            $candidate = esc_url_raw(trim($candidate), array('http', 'https'));
            if (!$candidate) {
                continue;
            }
            $path = (string) wp_parse_url($candidate, PHP_URL_PATH);
            if (preg_match('/\.(jpe?g|png|gif|webp|svg)$/i', $path)) {
                continue;
            }
            $host = wp_parse_url($candidate, PHP_URL_HOST);
            if ($host === $site_host && (false !== strpos($path, '/members/') || false !== strpos($path, '/wp-content/'))) {
                continue;
            }
            return $candidate;
        }

        return null;
    }

    /** Fetch a page and read its Open Graph / Twitter / HTML meta. */
    private function fetch_open_graph($url) {
        $cache_key = 'coral_og_' . md5($url);
        $cached = get_transient($cache_key);
        if (is_array($cached)) {
            return empty($cached['none']) ? $cached : null;
        }

        $response = wp_safe_remote_get($url, array(
            'timeout'             => 4,
            'redirection'         => 3,
            'limit_response_size' => 512 * 1024,
            'user-agent'          => 'Mozilla/5.0 (compatible; CoRRHubLinkPreview/1.0; +' . home_url('/') . ')',
            'headers'             => array('Accept' => 'text/html,application/xhtml+xml'),
        ));

        if (is_wp_error($response) || 200 !== (int) wp_remote_retrieve_response_code($response)) {
            set_transient($cache_key, array('none' => true), HOUR_IN_SECONDS);
            return null;
        }

        $content_type = (string) wp_remote_retrieve_header($response, 'content-type');
        if ($content_type && false === stripos($content_type, 'html')) {
            set_transient($cache_key, array('none' => true), DAY_IN_SECONDS);
            return null;
        }

        $html = (string) wp_remote_retrieve_body($response);
        $meta = $this->parse_meta_tags($html);

        $title = $this->first_non_empty($meta, array('og:title', 'twitter:title'));
        if ('' === $title && preg_match('/<title[^>]*>(.*?)<\/title>/is', $html, $title_match)) {
            $title = trim($title_match[1]);
        }
        $description = $this->first_non_empty($meta, array('og:description', 'twitter:description', 'description'));
        $image = $this->first_non_empty($meta, array('og:image:secure_url', 'og:image', 'og:image:url', 'twitter:image', 'twitter:image:src'));
        if ($image && class_exists('WP_Http') && method_exists('WP_Http', 'make_absolute_url')) {
            $image = WP_Http::make_absolute_url($image, $url);
        }
        $canonical = $this->first_non_empty($meta, array('og:url'));

        $preview = array(
            'url'         => $url,
            'title'       => html_entity_decode(wp_strip_all_tags($title), ENT_QUOTES, 'UTF-8'),
            'description' => html_entity_decode(wp_strip_all_tags($description), ENT_QUOTES, 'UTF-8'),
            'image'       => $image ? esc_url_raw($image) : '',
            'site_name'   => html_entity_decode(wp_strip_all_tags($this->first_non_empty($meta, array('og:site_name'))), ENT_QUOTES, 'UTF-8'),
            'canonical'   => $canonical ? esc_url_raw($canonical) : '',
            'fetched_at'  => time(),
        );

        if ('' === $preview['title'] && '' === $preview['description'] && '' === $preview['image']) {
            set_transient($cache_key, array('none' => true), DAY_IN_SECONDS);
            return null;
        }

        set_transient($cache_key, $preview, DAY_IN_SECONDS);
        return $preview;
    }

    private function first_non_empty($meta, $keys) {
        foreach ($keys as $key) {
            if (!empty($meta[$key])) {
                return trim($meta[$key]);
            }
        }
        return '';
    }

    /** Map of lower-cased meta property/name => content (first occurrence wins). */
    private function parse_meta_tags($html) {
        $meta = array();
        if (!preg_match_all('/<meta\b[^>]*>/i', $html, $tags)) {
            return $meta;
        }

        foreach ($tags[0] as $tag) {
            if (!preg_match('/\b(?:property|name)\s*=\s*["\']([^"\']+)["\']/i', $tag, $key)) {
                continue;
            }
            if (!preg_match('/\bcontent\s*=\s*("([^"]*)"|\'([^\']*)\')/i', $tag, $value)) {
                continue;
            }
            $name = strtolower(trim($key[1]));
            $content = isset($value[3]) && '' !== $value[3] ? $value[3] : $value[2];
            if (!isset($meta[$name])) {
                $meta[$name] = $content;
            }
        }

        return $meta;
    }
}
