// components/PostCard.tsx
//
// Single shared post-card component used everywhere a BuddyPress activity
// item is rendered as a post: the News Feed, the "All Groups" combined
// view, and a single group's own activity list (group-detail.tsx). It used
// to be duplicated (a slightly different "PostItem" in app/(tabs)/index.tsx
// and a differently-styled "ActivityCard" in app/group-detail.tsx), which is
// why Like/Comment/Share looked and behaved differently between the two —
// this is now the one place that look/behavior is defined.
import React, { useState } from 'react';
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
import type { BPActivity, BPGroup } from '../types';

// ─────────────────────────────────────────────
// Content helpers
// ─────────────────────────────────────────────
function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#8211;/g, '–')
    .replace(/&#8212;/g, '—')
    .replace(/&#8216;/g, '‘')
    .replace(/&#8217;/g, '’')
    .replace(/&#8220;/g, '“')
    .replace(/&#8221;/g, '”')
    .replace(/&nbsp;/g, ' ');
}

function getContentHtml(content: string | { rendered: string; raw?: string }): string {
  if (typeof content === 'string') {
    return content;
  }
  return content.rendered || content.raw || '';
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

function getSharedActivityId(activity: BPActivity): number | null {
  const sharedActivityId = Number(activity.primary_item_id);

  if (
    activity.type === 'activity_share' &&
    Number.isFinite(sharedActivityId) &&
    sharedActivityId > 0 &&
    sharedActivityId !== activity.id
  ) {
    return sharedActivityId;
  }

  return null;
}

// Helper function to extract user name from title HTML
function getUserNameFromTitle(title: string): string {
  const match = title.match(/>([^<]+)</);
  return match ? match[1].trim() : '';
}

// Helper function to extract image URLs from HTML content
function extractImageUrls(content: string | { rendered: string; raw?: string }): string[] {
  let html = '';
  if (typeof content === 'string') {
    html = content;
  } else {
    html = content.rendered || content.raw || '';
  }

  const imageUrls: string[] = [];
  const imageExtensions = /\.(jpg|jpeg|png|gif|webp)(\?[^"']*)?$/i;

  const imgRegex = /<img[^>]+(?:src|data-src)=["']([^"']+)["'][^>]*>/gi;
  let match;
  while ((match = imgRegex.exec(html)) !== null) {
    const url = match[1];
    if (url && !url.includes('Please-Upload-Avatar-Image')) {
      imageUrls.push(url);
    }
  }

  // Also catch image links from <a> tags
  const anchorRegex = /<a[^>]+href=["']([^"']+)["'][^>]*>/gi;
  while ((match = anchorRegex.exec(html)) !== null) {
    const url = match[1];
    if (url && imageExtensions.test(url) && !imageUrls.includes(url) && !url.includes('Please-Upload-Avatar-Image')) {
      imageUrls.push(url);
    }
  }

  return imageUrls;
}

// Extracts all tappable links: from <a href> tags AND plain-text URLs in the content
function extractAllLinks(content: string | { rendered: string; raw?: string }): Array<{ url: string; text: string }> {
  let html = '';
  if (typeof content === 'string') {
    html = content;
  } else {
    html = content.rendered || content.raw || '';
  }

  const results: Array<{ url: string; text: string }> = [];
  const seenUrls = new Set<string>();
  const imageExtensions = /\.(jpg|jpeg|png|gif|webp)(\?[^"']*)?$/i;
  const skip = (url: string) =>
    !url.startsWith('http') ||
    url.includes('Please-Upload-Avatar-Image') ||
    imageExtensions.test(url.split('?')[0]);

  const domainOf = (url: string) => {
    try { return new URL(url).hostname; } catch { return url; }
  };

  // 1. All <a href> links (including complex content like link preview cards)
  const hrefRegex = /<a[^>]+href=["']([^"']+)["']/gi;
  let m: RegExpExecArray | null;
  while ((m = hrefRegex.exec(html)) !== null) {
    const url = m[1];
    if (!skip(url) && !seenUrls.has(url)) {
      seenUrls.add(url);
      results.push({ url, text: domainOf(url) });
    }
  }

  // 2. Plain-text URLs not already captured
  const plainText = html.replace(/<[^>]+>/g, ' ');
  const urlRegex = /https?:\/\/[^\s<>"{}|\\^`[\]]+/g;
  while ((m = urlRegex.exec(plainText)) !== null) {
    const url = m[0].replace(/[.,;:!?)]+$/, '');
    if (!skip(url) && !seenUrls.has(url)) {
      seenUrls.add(url);
      results.push({ url, text: domainOf(url) });
    }
  }

  return results;
}

// ─────────────────────────────────────────────
// PostCard
// ─────────────────────────────────────────────
export default function PostCard({
  item,
  token,
  profile,
  onLike,
  onDelete,
  onEdit,
  groups,
  canModifyOverride,
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

  const isSharedPost = item.type === 'activity_share';
  const isCurrentUserPost = item.user_id === profile?.user_id;
  const canModify = isCurrentUserPost || !!canModifyOverride;
  const isLiked = item.favorited || false;

  // TEMP DIAGNOSTIC: dump the exact activity object this card is rendering
  // from — lets us confirm fields like comment_count are actually reaching
  // the app (vs. a WordPress-side deploy that hasn't landed yet). Remove
  // once comment counts are confirmed working end-to-end.
  console.log(`[POST RENDER] id=${item.id} type=${item.type} component=${item.component} comment_count=${item.comment_count} favorite_count=${item.favorite_count} favorited=${item.favorited}`, JSON.stringify(item, null, 2));

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

  const displayText = isSharedPost ? getShareIntroText(item.content) : getContentText(item.content);

  // Shared activities include BuddyPress embed markup in content.rendered.
  // Render the original activity from the API instead of showing embed fallback text.
  const imageUrls = isSharedPost ? [] : extractImageUrls(item.content);
  const links = isSharedPost ? [] : extractAllLinks(item.content);
  const sharedImageUrls = sharedActivity ? extractImageUrls(sharedActivity.content) : [];
  const sharedLinks = sharedActivity ? extractAllLinks(sharedActivity.content) : [];
  const sharedText = sharedActivity ? getContentText(sharedActivity.content) : '';
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
  const [commentModalVisible, setCommentModalVisible] = useState(false);

  if (isMemberLoading || !userName) {
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

      {/* Post Content */}
      {displayText ? <Text style={styles.postContent}>{displayText}</Text> : null}

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

      {/* Post Links */}
      {links.length > 0 && (
        <View style={styles.postLinks}>
          {links.map((link: { url: string; text: string }, index: number) => (
            <TouchableOpacity
              key={index}
              style={styles.linkButton}
              onPress={() => handleLinkPress(link.url)}
            >
              <Text style={styles.linkIcon}>🔗</Text>
              <Text style={styles.linkText} numberOfLines={1}>
                {link.text}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

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

              {sharedText ? <Text style={styles.sharedPostContent}>{sharedText}</Text> : null}

              {sharedImageUrls.length > 0 ? (
                <Image
                  source={{ uri: sharedImageUrls[0] }}
                  style={styles.sharedPostImage}
                  resizeMode="cover"
                />
              ) : null}

              {sharedLinks.length > 0 ? (
                <TouchableOpacity
                  style={styles.sharedPostLink}
                  onPress={() => handleLinkPress(sharedLinks[0].url)}
                >
                  <Text style={styles.linkIcon}>🔗</Text>
                  <Text style={styles.sharedPostLinkText} numberOfLines={1}>
                    {sharedLinks[0].text}
                  </Text>
                </TouchableOpacity>
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
          activityId={item.id}
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
          previewImageUrl={imageUrls[0] || sharedImageUrls[0]}
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
    paddingHorizontal: 16,
    paddingBottom: 12,
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
  postLinks: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    gap: 8,
  },
  linkButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f8ff',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#0095f6',
    gap: 8,
  },
  linkIcon: {
    fontSize: 16,
  },
  linkText: {
    flex: 1,
    fontSize: 14,
    color: '#0095f6',
    fontWeight: '500',
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
    paddingHorizontal: 12,
    paddingBottom: 12,
  },
  sharedPostImage: {
    width: '100%',
    height: 220,
    backgroundColor: '#f0f0f0',
  },
  sharedPostLink: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: 12,
    backgroundColor: '#f0f8ff',
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: '#0095f6',
    gap: 8,
  },
  sharedPostLinkText: {
    flex: 1,
    fontSize: 13,
    color: '#0095f6',
    fontWeight: '500',
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
