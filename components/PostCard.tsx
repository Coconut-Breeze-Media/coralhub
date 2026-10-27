// components/PostCard.tsx
//
// Single shared post-card component used everywhere a BuddyPress activity
// item is rendered as a post: the News Feed, the "All Groups" combined
// view, and a single group's own activity list (group-detail.tsx). It used
// to be duplicated (a slightly different "PostItem" in app/(tabs)/index.tsx
// and a differently-styled "ActivityCard" in app/group-detail.tsx), which is
// why Like/Comment/Share looked and behaved differently between the two —
// this is now the one place that look/behavior is defined.
import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  Modal,
  Alert,
  Linking,
  StyleSheet,
  Platform,
  Dimensions,
} from 'react-native';
import { router } from 'expo-router';
import CommentsModal from './CommentsModal';
import ShareButton from './ShareButton';
import { useMember } from '../hooks/useMembers';
import { useActivityById } from '../hooks/useActivity';
import {
  decodeHtmlEntities as decodeEntities,
  isEmojiImageTag,
  isEmojiImageUrl,
  normalizeExternalUrl,
  repairMojibake,
  replaceEmojiImages,
  toAbsoluteUrl,
} from '../lib/postContent';
import type { ActivityLinkPreview, BPActivity, BPGroup } from '../types';

// ─────────────────────────────────────────────
// Content helpers
// ─────────────────────────────────────────────
function decodeHtmlEntities(text: string): string {
  // Two passes, as before: website content is sometimes escaped twice
  // (`&amp;#8217;`, `&amp;amp;`).
  const decoded = repairMojibake(decodeEntities(decodeEntities(text)));

  // Some website plugins return common emoji shortcodes instead of the
  // character. Convert the ones supported by the in-app composer as well.
  const emojiShortcodes: Record<string, string> = {
    smile: '😊', joy: '😂', heart: '❤️', '+1': '👍', thumbsup: '👍',
    tada: '🎉', fire: '🔥', '100': '💯', raised_hands: '🙌',
  };

  return decoded.replace(
    /:([+\w-]+):/g,
    (match, shortcode: string) => emojiShortcodes[shortcode.toLowerCase()] ?? match
  );
}

function getContentHtml(content: string | { rendered: string; raw?: string } | null | undefined): string {
  if (typeof content === 'string') {
    return content;
  }
  return content?.rendered || content?.raw || '';
}

function stripUnavailableShareFallback(text: string): string {
  return text
    .replace(
      /This content isn't available right now\s*When this happens, it's usually because the owner only shared it with a small group of people, change who can see it or it's been deleted\./gi,
      ''
    )
    .replace(/This content isn't available right now/gi, '')
    .replace(/When this happens, it's usually because[^.]+\./gi, '');
}

function getContentText(content: string | { rendered: string; raw?: string }): string {
  let html = getContentHtml(content);

  // WordPress renders emoji as <img class="wp-smiley|emoji" alt="😊"> (and
  // plugins use Twemoji/EmojiOne images). Keep the unicode alt character in
  // the text before removing markup, while leaving normal post images alone.
  html = replaceEmojiImages(html);

  // Preserve paragraph/line structure before stripping tags
  html = html
    .replace(/<\/p\s*>/gi, '\n\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/li\s*>/gi, '\n')
    .replace(/<\/h[1-6]\s*>/gi, '\n\n');

  // Strip all HTML tags
  let text = html.replace(/<[^>]+>/g, '');

  // Decode HTML entities
  text = decodeHtmlEntities(text);

  // Filter PHP warnings/notices/errors that leak into WordPress content
  text = text
    .split('\n')
    .filter(line => {
      const t = line.trim();
      return !(t.match(/^(Warning|Notice|Fatal error|Parse error|Deprecated):/i) && t.includes('.php'));
    })
    .join('\n');

  text = stripUnavailableShareFallback(text);

  return text
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function getShareIntroText(content: string | { rendered: string; raw?: string }): string {
  const html = getContentHtml(content);
  const activityInnerMatch = html.match(
    /<div\b[^>]*class=["'][^"']*\bactivity-inner\b[^"']*["'][^>]*>([\s\S]*?)<\/div>/i
  );

  if (activityInnerMatch?.[1]) {
    return getContentText(activityInnerMatch[1]);
  }

  const shareEmbedIndex = html.search(
    /<div\b[^>]*class=["'][^"']*(activity-share|shared|repost|embed)[^"']*["'][^>]*>/i
  );

  return getContentText(shareEmbedIndex >= 0 ? html.slice(0, shareEmbedIndex) : html);
}

function isActivityShare(activity: BPActivity): boolean {
  // `post_share` (a shared blog post) points at a WP post, not an activity.
  return /share/i.test(activity.type || '') && activity.type !== 'post_share';
}

/**
 * The original activity of a share. The website's share feature stores it in
 * `secondary_item_id` (`primary_item_id` is the group for group shares);
 * shares made by earlier app builds only set `primary_item_id`. The plugin's
 * `shared_activity_id` REST field resolves this server-side when available.
 */
function getSharedActivityId(activity: BPActivity): number | null {
  if (!isActivityShare(activity)) return null;

  const candidates = [
    activity.shared_activity_id,
    activity.secondary_item_id,
    activity.component === 'groups' ? null : activity.primary_item_id,
  ];

  for (const candidate of candidates) {
    const id = Number(candidate);
    if (Number.isFinite(id) && id > 0 && id !== activity.id) return id;
  }

  return null;
}

function getLinkPreview(activity: BPActivity | undefined): ActivityLinkPreview | null {
  const preview = activity?.link_preview;
  const url = preview?.url ? normalizeExternalUrl(preview.url) : null;
  if (!preview || !url || (!preview.title && !preview.description && !preview.image)) return null;
  return {
    ...preview,
    url,
    title: preview.title ? decodeHtmlEntities(preview.title) : undefined,
    description: preview.description ? decodeHtmlEntities(preview.description) : undefined,
    image: toAbsoluteUrl(preview.image),
  };
}

function getLinkHostname(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

// Helper function to extract user name from title HTML
function getUserNameFromTitle(title: string | undefined): string {
  const match = title?.match(/>([^<]+)</);
  return match ? match[1].trim() : '';
}

// Helper function to extract image URLs from HTML content
function extractImageUrls(content: string | { rendered: string; raw?: string } | null | undefined): string[] {
  const html = getContentHtml(content);

  const imageUrls: string[] = [];
  const imageExtensions = /\.(jpg|jpeg|png|gif|webp)(\?[^"']*)?$/i;

  const imgRegex = /<img[^>]+(?:src|data-src)=["']([^"']+)["'][^>]*>/gi;
  let match;
  while ((match = imgRegex.exec(html)) !== null) {
    const url = match[1];
    // WordPress converts emoji to inline <img class="wp-smiley|emoji"> markup;
    // it belongs in the text, never as a post image.
    if (url && !isEmojiImageTag(match[0]) && !url.includes('Please-Upload-Avatar-Image')) {
      imageUrls.push(url);
    }
  }

  // Also catch image links from <a> tags
  const anchorRegex = /<a[^>]+href=["']([^"']+)["'][^>]*>/gi;
  while ((match = anchorRegex.exec(html)) !== null) {
    const url = match[1];
    if (
      url &&
      imageExtensions.test(url) &&
      !isEmojiImageUrl(url) &&
      !imageUrls.includes(url) &&
      !url.includes('Please-Upload-Avatar-Image')
    ) {
      imageUrls.push(url);
    }
  }

  return imageUrls;
}

// Extracts all tappable links: from <a href> tags AND plain-text URLs in the content
type ExtractedLink = {
  url: string;
};

// Extract tappable links from anchors and plain text. Every link is normalized
// so legacy posts containing www.example.com are still usable in the app.
function extractAllLinks(content: string | { rendered: string; raw?: string } | null | undefined): ExtractedLink[] {
  const html = getContentHtml(content);

  const results: ExtractedLink[] = [];
  const seenUrls = new Set<string>();
  const imageExtensions = /\.(jpg|jpeg|png|gif|webp)(\?[^"']*)?$/i;
  const skip = (url: string) =>
    !/^https?:\/\//i.test(url) ||
    url.includes('Please-Upload-Avatar-Image') ||
    imageExtensions.test(url.split('?')[0]);

  // 1. All <a href> links (including complex content like link preview cards)
  const hrefRegex = /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let m: RegExpExecArray | null;
  while ((m = hrefRegex.exec(html)) !== null) {
    const url = normalizeExternalUrl(decodeHtmlEntities(m[1]));
    if (!url) continue;
    if (!skip(url) && !seenUrls.has(url)) {
      seenUrls.add(url);
      results.push({ url });
    }
  }

  // 2. Plain-text URLs not already captured
  const plainText = html.replace(/<[^>]+>/g, ' ');
  const urlRegex = /(?:https?:\/\/|www\.)[^\s<>"{}|\\^`[\]]+/gi;
  while ((m = urlRegex.exec(plainText)) !== null) {
    const url = normalizeExternalUrl(m[0].replace(/[.,;:!?)}\]]+$/, ''));
    if (!url) continue;
    if (!skip(url) && !seenUrls.has(url)) {
      seenUrls.add(url);
      results.push({ url });
    }
  }

  return results;
}

const COLLAPSED_POST_LINES = 5;
const URL_TEXT_PATTERN = /(?:https?:\/\/|www\.)[^\s<>"{}|\\^`[\]]+/gi;

function renderTextWithLinks(value: string, onLinkPress?: (url: string) => void) {
  const nodes: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  URL_TEXT_PATTERN.lastIndex = 0;

  while ((match = URL_TEXT_PATTERN.exec(value)) !== null) {
    const rawMatch = match[0];
    const trailing = rawMatch.match(/[.,;:!?)}\]]+$/)?.[0] ?? '';
    const displayedUrl = rawMatch.slice(0, rawMatch.length - trailing.length);
    const normalizedUrl = normalizeExternalUrl(displayedUrl);

    nodes.push(value.slice(lastIndex, match.index));
    if (normalizedUrl && onLinkPress) {
      nodes.push(
        <Text key={`${match.index}-${displayedUrl}`} style={styles.inlineLink} onPress={() => onLinkPress(normalizedUrl)}>
          {displayedUrl}
        </Text>
      );
    } else {
      nodes.push(displayedUrl);
    }
    nodes.push(trailing);
    lastIndex = match.index + rawMatch.length;
  }

  nodes.push(value.slice(lastIndex));
  return nodes;
}

/**
 * A text-only line clamp for activity cards.
 *
 * `numberOfLines` is intentionally applied only to the visible Text. A second,
 * invisible Text measures the unclamped layout so "See more" is rendered only
 * when the post really exceeds the limit, rather than based on an unreliable
 * character-count heuristic. Keeping media, link previews and actions outside
 * this component means expanding a post never changes their behaviour.
 */
function ExpandablePostText({
  children,
  textStyle,
  collapsedLines = COLLAPSED_POST_LINES,
  onLinkPress,
}: {
  children: string;
  textStyle: object;
  collapsedLines?: number;
  onLinkPress?: (url: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [hasOverflow, setHasOverflow] = useState(false);

  const handleTextLayout = (event: any) => {
    const nextHasOverflow = event.nativeEvent.lines.length > collapsedLines;
    setHasOverflow((current) =>
      current === nextHasOverflow ? current : nextHasOverflow
    );
  };

  return (
    <View>
      {/* Measure the complete text without contributing any visual height. */}
      <Text
        style={[textStyle, styles.hiddenTextMeasure]}
        onTextLayout={handleTextLayout}
        accessible={false}
        importantForAccessibility="no-hide-descendants"
      >
        {renderTextWithLinks(children)}
      </Text>
      <Text style={textStyle} numberOfLines={expanded ? undefined : collapsedLines}>
        {renderTextWithLinks(children, onLinkPress)}
      </Text>
      {hasOverflow ? (
        <TouchableOpacity
          onPress={() => setExpanded((current) => !current)}
          style={styles.expandTextButton}
          hitSlop={6}
          accessibilityRole="button"
          accessibilityLabel={expanded ? 'Show less of this post' : 'See more of this post'}
        >
          <Text style={styles.expandTextLabel}>{expanded ? 'Show less' : 'See more'}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

/** Open Graph preview card for the first link in a post (title, image, site). */
function LinkPreviewCard({
  preview,
  onPress,
}: {
  preview: ActivityLinkPreview;
  onPress: (url: string) => void;
}) {
  return (
    <TouchableOpacity
      style={styles.linkPreviewCard}
      onPress={() => onPress(preview.url)}
      activeOpacity={0.85}
      accessibilityRole="link"
      accessibilityLabel={preview.title ? `Open link: ${preview.title}` : `Open ${preview.url}`}
    >
      {preview.image ? (
        <Image source={{ uri: preview.image }} style={styles.linkPreviewImage} resizeMode="cover" />
      ) : null}
      <View style={styles.linkPreviewBody}>
        {preview.title ? (
          <Text style={styles.linkPreviewTitle} numberOfLines={2}>
            {preview.title}
          </Text>
        ) : null}
        {preview.description ? (
          <Text style={styles.linkPreviewDescription} numberOfLines={3}>
            {preview.description}
          </Text>
        ) : null}
        <Text style={styles.linkPreviewHost} numberOfLines={1}>
          {(preview.site_name || getLinkHostname(preview.url)).toUpperCase()}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

// ─────────────────────────────────────────────
// PostCard
// ─────────────────────────────────────────────
function PostCard({
  item,
  token,
  profile,
  onLike,
  onDelete,
  onEdit,
  groups,
  canModifyOverride,
  initialCommentsOpen = false,
}: {
  item: BPActivity;
  token: string | null;
  profile: any;
  onLike: (activityId: number, isLiked: boolean) => void;
  onDelete: (item: BPActivity) => void;
  onEdit: (item: BPActivity) => void;
  groups?: BPGroup[];
  // Lets a screen grant edit/delete beyond plain ownership — e.g. a group
  // admin/creator managing any post in their group, same permission the
  // group detail screen already gave before this component was unified.
  canModifyOverride?: boolean;
  initialCommentsOpen?: boolean;
}) {
  // Fetch member data from BuddyPress API
  const { data: memberData, isLoading: isMemberLoading } = useMember(token, item.user_id);
  const sharedActivityId = getSharedActivityId(item);
  const {
    data: sharedActivity,
    isLoading: isSharedActivityLoading,
    isError: isSharedActivityError,
  } = useActivityById(token, sharedActivityId);
  const { data: sharedMemberData } = useMember(token, sharedActivity?.user_id);

  const isSharedPost = isActivityShare(item);
  const isCurrentUserPost = item.user_id === profile?.user_id;
  const canModify = isCurrentUserPost || !!canModifyOverride;
  const isLiked = item.favorited || false;

  // When a post was made inside a group, show which group it belongs to
  // (e.g. in the "All Groups" combined view) and link to that group.
  const postedInGroup =
    item.component === 'groups'
      ? groups?.find((g) => g.id === Number(item.primary_item_id))
      : undefined;

  // Resolve author name before rendering to avoid showing placeholder text.
  const userName = memberData?.name?.trim() || item.user_name?.trim() || getUserNameFromTitle(item.title);

  const userAvatar = memberData?.avatar_urls?.thumb ||
    (typeof item.user_avatar === 'object' ? item.user_avatar.thumb : item.user_avatar) ||
    undefined;

  // HTML parsing is several regex passes. Memoize it so parent state
  // (composer text, scroll position) does not re-parse every card.
  const linkPreview = useMemo(() => getLinkPreview(item), [item]);
  const parsedContent = useMemo(() => {
    return {
      displayText: isSharedPost ? getShareIntroText(item.content) : getContentText(item.content),
      // A link preview's image is shown in its card, not as a post photo.
      imageUrls: isSharedPost
        ? []
        : extractImageUrls(item.content).filter((url) => url !== linkPreview?.image),
      links: isSharedPost ? [] : extractAllLinks(item.content),
    };
  }, [isSharedPost, item.content, linkPreview]);
  const { displayText, imageUrls, links } = parsedContent;

  const parsedShared = useMemo(() => {
    if (!sharedActivity) {
      return {
        imageUrls: [] as string[],
        links: [] as ReturnType<typeof extractAllLinks>,
        text: '',
        linkPreview: null as ActivityLinkPreview | null,
      };
    }
    const sharedPreview = getLinkPreview(sharedActivity);
    return {
      imageUrls: extractImageUrls(sharedActivity.content).filter((url) => url !== sharedPreview?.image),
      links: extractAllLinks(sharedActivity.content),
      text: getContentText(sharedActivity.content),
      linkPreview: sharedPreview,
    };
  }, [sharedActivity]);
  const sharedLinkPreview = parsedShared.linkPreview;
  const sharedImageUrls = parsedShared.imageUrls;
  const sharedLinks = parsedShared.links;
  const sharedText = parsedShared.text;
  const sharedUserName =
    sharedActivity
      ? sharedMemberData?.name?.trim() ||
        sharedActivity.user_name?.trim() ||
        getUserNameFromTitle(sharedActivity.title)
      : '';
  const sharedUserAvatar =
    sharedMemberData?.avatar_urls?.thumb ||
    (typeof sharedActivity?.user_avatar === 'object'
      ? sharedActivity.user_avatar.thumb
      : sharedActivity?.user_avatar) ||
    undefined;

  // State for image viewer modal
  const [imageModalVisible, setImageModalVisible] = useState(false);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);

  // State for comments modal
  const [commentModalVisible, setCommentModalVisible] = useState(initialCommentsOpen);

  useEffect(() => {
    if (initialCommentsOpen) setCommentModalVisible(true);
  }, [initialCommentsOpen]);

  // Never render a malformed cache entry (e.g. an unexpected API response
  // shape) — it has no id/content and would crash the whole list.
  if (!item?.id || isMemberLoading || !userName) {
    return null;
  }

  const handleImagePress = (index: number) => {
    setSelectedImageIndex(index);
    setImageModalVisible(true);
  };

  const handleNextImage = () => {
    if (selectedImageIndex < imageUrls.length - 1) {
      setSelectedImageIndex(selectedImageIndex + 1);
    }
  };

  const handlePreviousImage = () => {
    if (selectedImageIndex > 0) {
      setSelectedImageIndex(selectedImageIndex - 1);
    }
  };

  const handleLinkPress = async (url: string) => {
    try {
      const canOpen = await Linking.canOpenURL(url);
      if (canOpen) {
        await Linking.openURL(url);
      } else {
        Alert.alert('Error', 'Cannot open this link');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to open link');
    }
  };

  return (
    <View style={styles.postCard}>
      {/* Post Header */}
      <View style={styles.postHeader}>
        <View style={styles.postUserInfo}>
          <View style={styles.avatar}>
            {userAvatar ? (
              <Image source={{ uri: userAvatar }} style={styles.avatarImage} />
            ) : (
              <Text style={styles.avatarText}>
                {userName.charAt(0).toUpperCase()}
              </Text>
            )}
          </View>
          <View style={styles.userInfoText}>
            <Text style={styles.userName}>
              {userName}
              {postedInGroup ? (
                <>
                  <Text style={{ color: '#6b7280', fontWeight: '400' }}> posted in the group </Text>
                  <Text
                    style={{ color: '#2563eb', fontWeight: '600' }}
                    onPress={() => router.push(`/group-detail?id=${postedInGroup.id}`)}
                  >
                    {postedInGroup.name}
                  </Text>
                </>
              ) : null}
            </Text>
            <Text style={styles.postDate}>
              {new Date(item.date).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </Text>
          </View>
        </View>
        {canModify && (
          <View style={styles.postOwnerActions}>
            <TouchableOpacity
              onPress={() => onEdit(item)}
              style={styles.iconActionButton}
            >
              <Text style={styles.iconActionButtonText}>✏️</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => onDelete(item)}
              style={styles.iconActionButton}
            >
              <Text style={styles.iconActionButtonText}>🗑️</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Post Content — text is clamped, while media and links remain available. */}
      {displayText ? (
        <View style={styles.postContentContainer}>
          <ExpandablePostText textStyle={styles.postContent} onLinkPress={handleLinkPress}>
            {displayText}
          </ExpandablePostText>
        </View>
      ) : null}

      {/* Post Images */}
      {imageUrls.length > 0 && (
        <View style={styles.postImages}>
          {imageUrls.map((url, index) => (
            <TouchableOpacity
              key={index}
              onPress={() => handleImagePress(index)}
              activeOpacity={0.9}
            >
              <Image
                source={{ uri: url }}
                style={styles.postImage}
                resizeMode="contain"
              />
            </TouchableOpacity>
          ))}
        </View>
      )}

      {linkPreview ? (
        <View style={styles.linkPreviewWrapper}>
          <LinkPreviewCard preview={linkPreview} onPress={handleLinkPress} />
        </View>
      ) : null}

      {sharedActivityId ? (
        <View style={styles.sharedPostCard}>
          {isSharedActivityLoading ? (
            <Text style={styles.sharedPostUnavailableText}>Loading shared post...</Text>
          ) : sharedActivity && !isSharedActivityError ? (
            <>
              <View style={styles.sharedPostHeader}>
                <View style={styles.sharedPostAvatar}>
                  {sharedUserAvatar ? (
                    <Image source={{ uri: sharedUserAvatar }} style={styles.sharedPostAvatarImage} />
                  ) : (
                    <Text style={styles.sharedPostAvatarText}>
                      {(sharedUserName || 'P').charAt(0).toUpperCase()}
                    </Text>
                  )}
                </View>
                <View style={styles.sharedPostUserInfo}>
                  <Text style={styles.sharedPostUserName} numberOfLines={1}>
                    {sharedUserName || 'Post'}
                  </Text>
                  <Text style={styles.sharedPostDate}>
                    {new Date(sharedActivity.date).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </Text>
                </View>
              </View>

              {sharedText ? (
                <View style={styles.sharedPostContentContainer}>
                  <ExpandablePostText textStyle={styles.sharedPostContent} onLinkPress={handleLinkPress}>
                    {sharedText}
                  </ExpandablePostText>
                </View>
              ) : null}

              {sharedImageUrls.length > 0 ? (
                <Image
                  source={{ uri: sharedImageUrls[0] }}
                  style={styles.sharedPostImage}
                  resizeMode="cover"
                />
              ) : null}

              {sharedLinkPreview ? (
                <View style={styles.sharedLinkPreviewWrapper}>
                  <LinkPreviewCard preview={sharedLinkPreview} onPress={handleLinkPress} />
                </View>
              ) : null}

            </>
          ) : (
            <Text style={styles.sharedPostUnavailableText}>Original post is no longer available.</Text>
          )}
        </View>
      ) : null}

      {/* Post Actions */}
      <View style={styles.postActions}>
        <TouchableOpacity
          onPress={() => onLike(item.id, isLiked)}
          style={styles.actionButton}
        >
          <Text style={[styles.actionIcon, isLiked && styles.likedIcon]}>
            {isLiked ? '❤️' : '🤍'}
          </Text>
          <Text style={[styles.actionLabel, isLiked && styles.likedText]}>
            {isLiked ? 'Unlike' : 'Like'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => setCommentModalVisible(true)}
          style={styles.actionButton}
        >
          <Text style={styles.actionIcon}>💬</Text>
          <Text style={styles.actionLabel}>
            {item.comment_count && item.comment_count > 0
              ? `${item.comment_count}`
              : 'Comment'}
          </Text>
        </TouchableOpacity>

        <ShareButton
          // Re-sharing a share shares the original post, like the website.
          activityId={sharedActivityId ?? item.id}
          postUrl={item.link}
          style={styles.actionButton}
          iconColor="#6b7280"
          textColor="#737373"
          previewAuthorName={userName}
          previewAuthorAvatarUrl={userAvatar}
          previewTimeLabel={new Date(item.date).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          })}
          previewText={displayText}
          previewImageUrl={imageUrls[0] || sharedImageUrls[0] || linkPreview?.image || sharedLinkPreview?.image}
          previewLinkUrl={links[0]?.url || sharedLinks[0]?.url || item.link}
        />
      </View>

      {/* Comments Modal */}
      <CommentsModal
        visible={commentModalVisible}
        onClose={() => setCommentModalVisible(false)}
        postId={item.id}
        token={token}
        currentUserId={profile?.user_id}
      />

      {/* Image Viewer Modal */}
      <Modal
        visible={imageModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setImageModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalCounter}>
              {selectedImageIndex + 1} / {imageUrls.length}
            </Text>
            <TouchableOpacity
              onPress={() => setImageModalVisible(false)}
              style={styles.modalCloseButton}
            >
              <Text style={styles.modalCloseText}>✕</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.modalContent}>
            {imageUrls.length > 0 && (
              <Image
                source={{ uri: imageUrls[selectedImageIndex] }}
                style={styles.modalImage}
                resizeMode="contain"
              />
            )}
          </View>

          {imageUrls.length > 1 && (
            <View style={styles.modalNavigation}>
              <TouchableOpacity
                onPress={handlePreviousImage}
                disabled={selectedImageIndex === 0}
                style={[
                  styles.modalNavButton,
                  selectedImageIndex === 0 && styles.modalNavButtonDisabled,
                ]}
              >
                <Text style={styles.modalNavButtonText}>‹ Previous</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleNextImage}
                disabled={selectedImageIndex === imageUrls.length - 1}
                style={[
                  styles.modalNavButton,
                  selectedImageIndex === imageUrls.length - 1 && styles.modalNavButtonDisabled,
                ]}
              >
                <Text style={styles.modalNavButtonText}>Next ›</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </Modal>
    </View>
  );
}

export default React.memo(PostCard);

const styles = StyleSheet.create({
  postCard: {
    backgroundColor: '#fff',
    marginBottom: 12,
    marginHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#dbdbdb',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 3,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  postHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  postUserInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#0095f6',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#dbdbdb',
  },
  avatarImage: {
    width: 36,
    height: 36,
  },
  avatarText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  userInfoText: {
    flex: 1,
  },
  userName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#262626',
    marginBottom: 2,
  },
  postDate: {
    fontSize: 12,
    color: '#8e8e8e',
  },
  postOwnerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconActionButton: {
    padding: 6,
  },
  iconActionButtonText: {
    fontSize: 18,
  },
  postContent: {
    fontSize: 14,
    color: '#262626',
    lineHeight: 20,
  },
  postContentContainer: {
    paddingHorizontal: 16,
    paddingBottom: 6,
  },
  hiddenTextMeasure: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    opacity: 0,
  },
  expandTextButton: {
    alignSelf: 'flex-start',
    marginTop: 4,
    paddingVertical: 2,
  },
  expandTextLabel: {
    color: '#0077b6',
    fontSize: 14,
    fontWeight: '700',
  },
  inlineLink: {
    color: '#0077b6',
    textDecorationLine: 'underline',
    fontWeight: '600',
  },
  postImages: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    gap: 8,
  },
  postImage: {
    width: '100%',
    minHeight: 200,
    maxHeight: 400,
    borderRadius: 8,
    backgroundColor: '#f0f0f0',
  },
  linkPreviewWrapper: {
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  sharedLinkPreviewWrapper: {
    padding: 12,
    paddingTop: 8,
  },
  linkPreviewCard: {
    borderWidth: 1,
    borderColor: '#dbdbdb',
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#fafafa',
  },
  linkPreviewImage: {
    width: '100%',
    height: 180,
    backgroundColor: '#f0f0f0',
  },
  linkPreviewBody: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 4,
  },
  linkPreviewTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#262626',
    lineHeight: 19,
  },
  linkPreviewDescription: {
    fontSize: 13,
    color: '#525252',
    lineHeight: 18,
  },
  linkPreviewHost: {
    fontSize: 11,
    color: '#8e8e8e',
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  sharedPostCard: {
    marginHorizontal: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#dbdbdb',
    borderRadius: 8,
    backgroundColor: '#fafafa',
    overflow: 'hidden',
  },
  sharedPostHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 8,
  },
  sharedPostAvatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#0095f6',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#dbdbdb',
  },
  sharedPostAvatarImage: {
    width: 30,
    height: 30,
  },
  sharedPostAvatarText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  sharedPostUserInfo: {
    flex: 1,
  },
  sharedPostUserName: {
    fontSize: 13,
    color: '#262626',
    fontWeight: '700',
  },
  sharedPostDate: {
    fontSize: 11,
    color: '#8e8e8e',
    marginTop: 1,
  },
  sharedPostContent: {
    fontSize: 14,
    color: '#262626',
    lineHeight: 20,
  },
  sharedPostContentContainer: {
    paddingHorizontal: 12,
    paddingBottom: 6,
  },
  sharedPostImage: {
    width: '100%',
    height: 220,
    backgroundColor: '#f0f0f0',
  },
  sharedPostUnavailableText: {
    fontSize: 13,
    color: '#737373',
    lineHeight: 19,
    padding: 12,
  },
  postActions: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: '#efefef',
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    gap: 6,
  },
  actionIcon: {
    fontSize: 20,
  },
  likedIcon: {
    transform: [{ scale: 1.1 }],
  },
  actionLabel: {
    fontSize: 13,
    color: '#737373',
    fontWeight: '600',
  },
  likedText: {
    color: '#ed4956',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
    justifyContent: 'center',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
    paddingTop: Platform.OS === 'ios' ? 50 : 15,
  },
  modalCounter: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  modalCloseButton: {
    padding: 8,
  },
  modalCloseText: {
    color: '#fff',
    fontSize: 28,
    fontWeight: '300',
  },
  modalContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalImage: {
    width: Dimensions.get('window').width,
    height: Dimensions.get('window').height * 0.7,
  },
  modalNavigation: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 20,
    paddingBottom: Platform.OS === 'ios' ? 40 : 20,
  },
  modalNavButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
  },
  modalNavButtonDisabled: {
    opacity: 0.3,
  },
  modalNavButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
