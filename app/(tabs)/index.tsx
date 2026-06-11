// app/(tabs)/index.tsx
import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  RefreshControl,
  ActivityIndicator,
  Alert,
  StyleSheet,
  Image,
  ScrollView,
  Platform,
  Linking,
  Modal,
  Dimensions,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { useAuth } from '../../lib/auth';
import { uploadImage } from '../../lib/api';
import RequireAuth from '../../components/RequireAuth';
import CommentsModal from '../../components/CommentsModal';
import MentionInput from '../../components/MentionInput';
import ShareButton from '../../components/ShareButton';
import { 
  useActivityFeed, 
  useActivityById,
  useCreatePost, 
  useLikePost, 
  useDeletePost,
  useUpdatePost 
} from '../../hooks/useActivity';
import { useMember } from '../../hooks/useMembers';
import { useQueryClient } from '@tanstack/react-query';
import { getMemberById } from '../../lib/api';
import { useMe, useFriendsList } from '../../hooks/useQueries';
import { useMyGroups, useGroupActivity } from '../../hooks/useGroups';
import { useEffect, useRef } from 'react';
import type { BPActivity } from '../../types';

type TabType = 'feed' | 'my-posts' | 'groups-feed';

// Helper function to extract content text from BuddyPress API response
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

// Post Item Component - fetches user data for each post
function PostItem({ 
  item, 
  token, 
  profile, 
  onLike, 
  onDelete,
  onEdit 
}: { 
  item: BPActivity;
  token: string | null;
  profile: any;
  onLike: (activityId: number, isLiked: boolean) => void;
  onDelete: (item: BPActivity) => void;
  onEdit: (item: BPActivity) => void;
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
  const isLiked = item.favorited || false;
  
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
            <Text style={styles.userName}>{userName}</Text>
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
        {isCurrentUserPost && (
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
      
      {/* Post Stats */}
      <View style={styles.postStats}>
        {item.favorite_count && item.favorite_count > 0 ? (
          <Text style={styles.statsText}>
            ❤️ {item.favorite_count} {item.favorite_count === 1 ? 'like' : 'likes'}
          </Text>
        ) : null}
      </View>
      
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
            Like
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

function CommunityScreen() {
  const { token, profile } = useAuth();
  const params = useLocalSearchParams<{ tab?: string }>();
  const [activeTab, setActiveTab] = useState<TabType>('feed');
  const [postContent, setPostContent] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [selectedFriendId, setSelectedFriendId] = useState<number | undefined>(undefined);
  const [showFriendDropdown, setShowFriendDropdown] = useState(false);
  const [selectedGroupId, setSelectedGroupId] = useState<number | undefined>(undefined);
  const [showGroupDropdown, setShowGroupDropdown] = useState(false);
  const [selectedImages, setSelectedImages] = useState<string[]>([]);
  const [postLink, setPostLink] = useState('');
  const [isEditModalVisible, setIsEditModalVisible] = useState(false);
  const [editingPost, setEditingPost] = useState<BPActivity | null>(null);
  const [editContent, setEditContent] = useState('');
  const [isDeleteModalVisible, setIsDeleteModalVisible] = useState(false);
  const [deletingPost, setDeletingPost] = useState<BPActivity | null>(null);
  
  // Get current user data
  const { data: currentUser } = useMe();
  const userId = currentUser?.id;
  
  // Fetch friends list
  const { data: friendsData } = useFriendsList(userId, 1, 100);
  const friends = friendsData?.friends || [];
  
  // Fetch user's groups
  const { data: userGroups } = useMyGroups(token);
  const groups = useMemo(() => userGroups || [], [userGroups]);
  
  // State to store posts from all groups
  const [allGroupsActivities, setAllGroupsActivities] = useState<BPActivity[]>([]);
  const allGroupsFetchedRef = useRef(false);

  useEffect(() => {
    if (params.tab === 'groups') {
      setActiveTab('groups-feed');
      return;
    }
    if (params.tab === 'myposts') {
      setActiveTab('my-posts');
      return;
    }
    if (params.tab === 'feed') {
      setActiveTab('feed');
    }
  }, [params.tab]);

  // Fetch group activity if a group is selected
  const { data: groupActivityData, isLoading: isLoadingGroupActivity, refetch: refetchGroupActivity } = useGroupActivity(
    token,
    activeTab === 'groups-feed' && selectedGroupId ? selectedGroupId : undefined
  );

  
  useEffect(() => {
    const fetchAllGroupsActivities = async () => {
      if (
        activeTab === 'groups-feed' &&
        !selectedGroupId &&
        groups.length > 0 &&
        token &&
        !allGroupsFetchedRef.current
      ) {
        try {
          const results = await Promise.all(
            groups.map(async (g) => {
              // getGroupActivity expects (token, groupId, params)
              const res = await import('../../lib/api').then(m => m.getGroupActivity(g.id, token, { per_page: 20 }));
              return res.activities || [];
            })
          );
          setAllGroupsActivities(results.flat());
          allGroupsFetchedRef.current = true;
        } catch (e) {
          setAllGroupsActivities([]);
        }
      }
      if (activeTab !== 'groups-feed' || selectedGroupId) {
        setAllGroupsActivities([]);
        allGroupsFetchedRef.current = false;
      }
    };
    fetchAllGroupsActivities();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, selectedGroupId, groups, token]);
  
  // Fetch feed based on active tab with infinite scroll
  const scope = activeTab === 'groups-feed' ? 'groups' : undefined;
  const filterUserId = activeTab === 'feed' ? selectedFriendId : (activeTab === 'my-posts' ? userId : undefined);
  const { 
    data: feedData, 
    isLoading, 
    refetch, 
    isRefetching,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage
  } = useActivityFeed(token, scope, filterUserId, activeTab !== 'groups-feed');
  
  // Flatten all activities from all pages
  let allActivities = feedData?.pages?.flatMap(page => page.activities) || [];
  
  // For the groups tab, use posts from all groups if 'All Groups' is selected
  if (activeTab === 'groups-feed') {
    if (selectedGroupId && groupActivityData) {
      allActivities = groupActivityData.activities || [];
    } else if (!selectedGroupId && groups.length > 0) {
      allActivities = allGroupsActivities;
    }
  }

  // Filter out unwanted activity types
  allActivities = allActivities.filter(activity => {
    const unwantedTypes = ['joined_group', 'created_group', 'new_member', 'friendship_created', 'new_cover'];
    return !unwantedTypes.includes(activity.type);
  });

  // Pre-populate individual member cache keys so PostItems render without loading state
  const queryClient = useQueryClient();
  const [membersReady, setMembersReady] = useState(false);
  const prefetchKeyRef = useRef('');

  useEffect(() => {
    if (isLoading) {
      setMembersReady(false);
      return;
    }
    if (allActivities.length === 0) {
      setMembersReady(true);
      return;
    }
    const uniqueIds = Array.from(new Set(allActivities.map(a => a.user_id).filter(Boolean))) as number[];
    const key = uniqueIds.slice().sort().join(',');
    if (key === prefetchKeyRef.current) {
      setMembersReady(true);
      return;
    }
    // Prefetch new members in background — never block the list after initial load
    prefetchKeyRef.current = key;
    Promise.all(
      uniqueIds.map(uid =>
        queryClient.prefetchQuery({
          queryKey: ['member', uid],
          queryFn: () => getMemberById(uid, token!),
          staleTime: 5 * 60 * 1000,
        })
      )
    ).then(() => setMembersReady(true));
  }, [isLoading, allActivities.length, token]);

  // Mutations
  const createPostMutation = useCreatePost(token);
  const likePostMutation = useLikePost(token);
  const deletePostMutation = useDeletePost(token);
  const updatePostMutation = useUpdatePost(token);
  
  const handleCreatePost = async () => {
    if (!postContent.trim() && selectedImages.length === 0 && !postLink.trim()) {
      Alert.alert('Error', 'Please add some content, images, or a link to your post');
      return;
    }
    
    try {
      // Build post content with text and link
      let fullContent = postContent;
      
      // Add link if provided
      if (postLink.trim()) {
        fullContent += `\n\n<a href="${postLink}" target="_blank">${postLink}</a>`;
      }
      
      // Upload images to WordPress first and get public URLs
      if (selectedImages.length > 0) {
        
        const uploadedUrls: string[] = [];
        
        for (let i = 0; i < selectedImages.length; i++) {
          const imageUri = selectedImages[i];
          const fileName = `post-image-${Date.now()}-${i}.jpg`;
          
          try {
            const result = await uploadImage(token!, imageUri, fileName);
            uploadedUrls.push(result.source_url);
          } catch (error) {
            throw new Error(`Failed to upload image ${i + 1}`);
          }
        }
        
        // Add uploaded images to content as HTML
        if (uploadedUrls.length > 0) {
          fullContent += '\n<div class="post-attachments">';
          uploadedUrls.forEach(url => {
            fullContent += `\n<img src="${url}" alt="Post image" />`;
          });
          fullContent += '\n</div>';
        }
      }
      
      await createPostMutation.mutateAsync({
        content: fullContent,
      });
      
      // Reset form
      setPostContent('');
      setSelectedImages([]);
      setPostLink('');
      Alert.alert('Success', 'Post created successfully!');
    } catch (error) {
      Alert.alert('Error', error instanceof Error ? error.message : 'Failed to create post');
    }
  };
  
  const handleAddEmoji = (emoji: string) => {
    setPostContent(postContent + emoji);
  };
  
  const handlePickImage = async () => {
    try {
      // Request permission
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'We need camera roll permissions to select images.');
        return;
      }
      
      // Launch image picker
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: true,
        quality: 0.8,
        base64: false,
      });
      
      if (!result.canceled && result.assets) {
        const newImages = result.assets.map(asset => asset.uri);
        setSelectedImages([...selectedImages, ...newImages]);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to select images');
    }
  };
  
  const handleRemoveImage = (index: number) => {
    setSelectedImages(selectedImages.filter((_, i) => i !== index));
  };
  
  const handleAttachFile = () => {
    handlePickImage();
  };
  
  const handleTagFriend = () => {
    Alert.alert('Tag Friend', 'Tag friend feature coming soon!');
  };
  
  const commonEmojis = ['😊', '😂', '❤️', '👍', '🎉', '🔥', '💯', '🙌'];
  
  const handleLikePost = async (activityId: number, isLiked: boolean) => {
    try {
      await likePostMutation.mutateAsync({ activityId, isLiked });
    } catch (error) {
      Alert.alert('Error', 'Failed to like post');
    }
  };
  
  const handleDeletePost = (item: BPActivity) => {
    setDeletingPost(item);
    setIsDeleteModalVisible(true);
  };

  const closeDeleteModal = () => {
    if (deletePostMutation.isPending) return;
    setIsDeleteModalVisible(false);
    setDeletingPost(null);
  };

  const confirmDeletePost = async () => {
    if (!deletingPost) return;

    try {
      await deletePostMutation.mutateAsync(deletingPost.id);
      closeDeleteModal();
      Alert.alert('Success', 'Post deleted successfully!');
    } catch (error) {
      Alert.alert('Error', 'Failed to delete post');
      closeDeleteModal();
    }
  };

  const handleOpenEditPost = (item: BPActivity) => {
    let content = '';
    if (typeof item.content === 'string') {
      content = item.content;
    } else {
      content = item.content.raw || item.content.rendered || '';
    }
    setEditingPost(item);
    setEditContent(content.replace(/<[^>]+>/g, '').trim());
    setIsEditModalVisible(true);
  };

  const closeEditModal = () => {
    setIsEditModalVisible(false);
    setEditingPost(null);
    setEditContent('');
  };

  const handleSaveEditPost = async () => {
    if (!editingPost) return;
    if (!editContent.trim()) {
      Alert.alert('Error', 'Post content cannot be empty');
      return;
    }

    try {
      await updatePostMutation.mutateAsync({
        activityId: editingPost.id,
        content: editContent.trim(),
        component: editingPost.component,
        primary_item_id: editingPost.primary_item_id,
      });
      closeEditModal();
      Alert.alert('Success', 'Post updated successfully!');
    } catch (error: any) {
      Alert.alert('Error', error?.message || 'Failed to update post');
    }
  };
  
  const handleLoadMore = () => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  };
  
  const renderPost = ({ item }: { item: BPActivity }) => {
    return (
      <PostItem
        item={item}
        token={token}
        profile={profile}
        onLike={handleLikePost}
        onDelete={handleDeletePost}
        onEdit={handleOpenEditPost}
      />
    );
  };
  
  return (
    <SafeAreaView style={styles.container} edges={[]}>
      {/* Tab Navigation */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'feed' && styles.activeTab]}
          onPress={() => setActiveTab('feed')}
        >
          <Text style={[styles.tabText, activeTab === 'feed' && styles.activeTabText]}>
            News Feed
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'groups-feed' && styles.activeTab]}
          onPress={() => setActiveTab('groups-feed')}
        >
          <Text style={[styles.tabText, activeTab === 'groups-feed' && styles.activeTabText]}>
            Groups
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'my-posts' && styles.activeTab]}
          onPress={() => setActiveTab('my-posts')}
        >
          <Text style={[styles.tabText, activeTab === 'my-posts' && styles.activeTabText]}>
            My Posts
          </Text>
        </TouchableOpacity>
      </View>

      {/* Show groups where the user is a member before the posts in the Groups tab */}
      {activeTab === 'groups-feed' && (
        <View style={{paddingHorizontal: 16, marginBottom: 12}}>
          <View style={{flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8}}>
            <Text style={{fontWeight: 'bold', fontSize: 16}}>Your Groups</Text>
            <TouchableOpacity
              onPress={() => router.push('/explore-groups')}
              style={{flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#eff6ff', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20}}
            >
              <Text style={{color: '#2563eb', fontWeight: '600'}}>Explore</Text>
            </TouchableOpacity>
          </View>
          {groups.length === 0 ? (
            <Text style={{color: '#888'}}>You are not a member of any groups.</Text>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{marginBottom: 8}}>
              {groups.map((group) => (
                <TouchableOpacity
                  key={group.id}
                  style={{alignItems: 'center', marginRight: 16}}
                  onPress={() => router.push(`/group-detail?id=${group.id}`)}
                  activeOpacity={0.7}
                >
                  {group.avatar_urls?.thumb ? (
                    <Image source={{ uri: group.avatar_urls.thumb }} style={{width: 48, height: 48, borderRadius: 24, marginBottom: 4}} />
                  ) : (
                    <View style={{width: 48, height: 48, borderRadius: 24, backgroundColor: '#eee', alignItems: 'center', justifyContent: 'center', marginBottom: 4}}>
                      <Text style={{fontSize: 20, color: '#888'}}>{group.name.charAt(0).toUpperCase()}</Text>
                    </View>
                  )}
                  <Text style={{fontSize: 12, textAlign: 'center', maxWidth: 60}} numberOfLines={2}>{group.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
        </View>
      )}

      {/* Friend Filter Dropdown - Only show in News Feed tab */}
      {activeTab === 'feed' && (
        <View style={styles.filterContainer}>
          <TouchableOpacity
            style={styles.filterButton}
            onPress={() => setShowFriendDropdown(!showFriendDropdown)}
          >
            <Text style={styles.filterButtonText}>
              {selectedFriendId 
                ? friends.find(f => f.id === selectedFriendId)?.name || 'Select Friend'
                : 'Show posts by friend'}
            </Text>
            <Text style={styles.filterButtonIcon}>{showFriendDropdown ? '▲' : '▼'}</Text>
          </TouchableOpacity>
          
          {showFriendDropdown && (
            <View style={styles.dropdownMenu}>
              <ScrollView style={styles.dropdownScroll} nestedScrollEnabled>
                <TouchableOpacity
                  style={[styles.dropdownItem, !selectedFriendId && styles.dropdownItemActive]}
                  onPress={() => {
                    setSelectedFriendId(undefined);
                    setShowFriendDropdown(false);
                  }}
                >
                  <Text style={[styles.dropdownItemText, !selectedFriendId && styles.dropdownItemTextActive]}>
                    All Posts
                  </Text>
                </TouchableOpacity>
                {friends.map((friend) => (
                  <TouchableOpacity
                    key={friend.id}
                    style={[styles.dropdownItem, selectedFriendId === friend.id && styles.dropdownItemActive]}
                    onPress={() => {
                      setSelectedFriendId(friend.id);
                      setShowFriendDropdown(false);
                    }}
                  >
                    <View style={styles.dropdownItemContent}>
                      {friend.avatar_urls?.thumb ? (
                        <Image
                          source={{ uri: friend.avatar_urls.thumb }}
                          style={styles.dropdownAvatar}
                        />
                      ) : (
                        <View style={[styles.dropdownAvatar, styles.dropdownAvatarPlaceholder]}>
                          <Text style={styles.dropdownAvatarText}>
                            {friend.name.charAt(0).toUpperCase()}
                          </Text>
                        </View>
                      )}
                      <Text style={[styles.dropdownItemText, selectedFriendId === friend.id && styles.dropdownItemTextActive]}>
                        {friend.name}
                      </Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}
        </View>
      )}
      
      {/* Group Filter Dropdown - Only show in Groups Feed tab */}
      {activeTab === 'groups-feed' && (
        <View style={styles.filterContainer}>
          <TouchableOpacity
            style={styles.filterButton}
            onPress={() => setShowGroupDropdown(!showGroupDropdown)}
          >
            <Text style={styles.filterButtonText}>
              {selectedGroupId 
                ? groups.find(g => g.id === selectedGroupId)?.name || 'Select Group'
                : 'Show posts by group'}
            </Text>
            <Text style={styles.filterButtonIcon}>{showGroupDropdown ? '▲' : '▼'}</Text>
          </TouchableOpacity>
          
          {showGroupDropdown && (
            <View style={styles.dropdownMenu}>
              <ScrollView style={styles.dropdownScroll} nestedScrollEnabled>
                <TouchableOpacity
                  style={[styles.dropdownItem, !selectedGroupId && styles.dropdownItemActive]}
                  onPress={() => {
                    setSelectedGroupId(undefined);
                    setShowGroupDropdown(false);
                  }}
                >
                  <Text style={[styles.dropdownItemText, !selectedGroupId && styles.dropdownItemTextActive]}>
                    All Groups
                  </Text>
                </TouchableOpacity>
                {groups.map((group) => (
                  <TouchableOpacity
                    key={group.id}
                    style={[styles.dropdownItem, selectedGroupId === group.id && styles.dropdownItemActive]}
                    onPress={() => {
                      setSelectedGroupId(group.id);
                      setShowGroupDropdown(false);
                    }}
                  >
                    <View style={styles.dropdownItemContent}>
                      {group.avatar_urls?.thumb ? (
                        <Image
                          source={{ uri: group.avatar_urls.thumb }}
                          style={styles.dropdownAvatar}
                        />
                      ) : (
                        <View style={[styles.dropdownAvatar, styles.dropdownAvatarPlaceholder]}>
                          <Text style={styles.dropdownAvatarText}>
                            {group.name.charAt(0).toUpperCase()}
                          </Text>
                        </View>
                      )}
                      <Text style={[styles.dropdownItemText, selectedGroupId === group.id && styles.dropdownItemTextActive]}>
                        {group.name}
                      </Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}
        </View>
      )}
      
      {/* Create Post Form - Only show in My Posts tab */}
      {activeTab === 'my-posts' && (
        <View style={styles.createPostContainer}>
          <View style={styles.createPostHeader}>
            <View style={styles.createPostAvatar}>
              <Text style={styles.createPostAvatarText}>
                {profile?.user_display_name?.charAt(0).toUpperCase() || 'U'}
              </Text>
            </View>
            <View style={styles.createPostInputWrapper}>
              <MentionInput
                value={postContent}
                onChangeText={setPostContent}
                token={token}
                placeholder="What's on your mind?"
                placeholderTextColor="#999"
                multiline
                maxLength={500}
                maxHeight={120}
                style={styles.createPostInput}
                suggestionPosition="below"
              />
            </View>
          </View>
          
          {/* Selected Images Preview */}
          {selectedImages.length > 0 && (
            <View style={styles.selectedImagesContainer}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {selectedImages.map((imageUri, index) => (
                  <View key={index} style={styles.selectedImageWrapper}>
                    <Image
                      source={{ uri: imageUri }}
                      style={styles.selectedImagePreview}
                    />
                    <TouchableOpacity
                      style={styles.removeImageButton}
                      onPress={() => handleRemoveImage(index)}
                    >
                      <Text style={styles.removeImageText}>\u2715</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </ScrollView>
            </View>
          )}
          
          {/* Link Input */}
          <View style={styles.linkInputContainer}>
            <Text style={styles.linkInputIcon}>🔗</Text>
            <TextInput
              style={styles.linkInput}
              placeholder="Add a link (optional)"
              placeholderTextColor="#999"
              value={postLink}
              onChangeText={setPostLink}
              autoCapitalize="none"
              keyboardType="url"
            />
            {postLink.length > 0 && (
              <TouchableOpacity onPress={() => setPostLink('')}>
                <Text style={styles.clearLinkButton}>✕</Text>
              </TouchableOpacity>
            )}
          </View>
          
          {/* Emoji Picker */}
          {showEmojiPicker && (
            <View style={styles.emojiPickerContainer}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {commonEmojis.map((emoji, index) => (
                  <TouchableOpacity
                    key={index}
                    style={styles.emojiButton}
                    onPress={() => handleAddEmoji(emoji)}
                  >
                    <Text style={styles.emojiText}>{emoji}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}
          
          {/* Action Buttons */}
          <View style={styles.createPostActions}>
            <View style={styles.createPostToolbar}>
              <TouchableOpacity
                style={styles.toolbarButton}
                onPress={() => setShowEmojiPicker(!showEmojiPicker)}
              >
                <Text style={styles.toolbarIcon}>😊</Text>
                <Text style={styles.toolbarLabel}>Emoji</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={styles.toolbarButton}
                onPress={handleAttachFile}
              >
                <Text style={styles.toolbarIcon}>📎</Text>
                <Text style={styles.toolbarLabel}>Attach</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={styles.toolbarButton}
                onPress={handleTagFriend}
              >
                <Text style={styles.toolbarIcon}>👥</Text>
                <Text style={styles.toolbarLabel}>Tag</Text>
              </TouchableOpacity>
            </View>
            
            <TouchableOpacity
              style={[
                styles.publishButton,
                (!postContent.trim() && selectedImages.length === 0 && !postLink.trim()) || createPostMutation.isPending ? styles.publishButtonDisabled : {},
              ]}
              onPress={handleCreatePost}
              disabled={(!postContent.trim() && selectedImages.length === 0 && !postLink.trim()) || createPostMutation.isPending}
            >
              {createPostMutation.isPending ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.publishButtonText}>Post</Text>
              )}
            </TouchableOpacity>
          </View>
          
          {postContent.length > 0 && (
            <Text style={styles.characterCount}>
              {postContent.length}/500
            </Text>
          )}
        </View>
      )}
      
      {/* Posts Feed */}
      {(isLoading || !membersReady || (activeTab === 'groups-feed' && selectedGroupId && isLoadingGroupActivity)) ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#0066cc" />
          <Text style={styles.loadingText}>Loading posts...</Text>
        </View>
      ) : (
        <>
          <FlatList
            data={allActivities}
            keyExtractor={(item) => String(item.id)}
            renderItem={renderPost}
            contentContainerStyle={styles.feedContainer}
            refreshControl={
              <RefreshControl 
                refreshing={isRefetching || (activeTab === 'groups-feed' && selectedGroupId ? false : false)} 
                onRefresh={() => {
                  if (activeTab === 'groups-feed' && selectedGroupId) {
                    refetchGroupActivity();
                  } else {
                    refetch();
                  }
                }} 
                colors={['#0066cc']} 
              />
            }
            onEndReached={handleLoadMore}
            onEndReachedThreshold={0.5}
            ListFooterComponent={
              isFetchingNextPage ? (
                <View style={styles.loadMoreContainer}>
                  <ActivityIndicator size="small" color="#0066cc" />
                  <Text style={styles.loadMoreText}>Loading more...</Text>
                </View>
              ) : null
            }
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>
                  {activeTab === 'my-posts'
                    ? 'No posts yet.\nStart sharing your thoughts with the community!'
                    : activeTab === 'groups-feed'
                    ? selectedGroupId 
                      ? 'No posts in this group yet.'
                      : 'No posts from your groups.\nJoin groups to see their posts!'
                    : 'No posts to show.\nCheck back later for updates!'}
                </Text>
              </View>
            }
          />

          <Modal
            visible={isEditModalVisible}
            animationType="slide"
            transparent={true}
            onRequestClose={closeEditModal}
          >
            <View style={styles.editModalOverlay}>
              <View style={styles.editModalCard}>
                <View style={styles.editModalHeader}>
                  <Text style={styles.editModalTitle}>Edit Post</Text>
                  <TouchableOpacity onPress={closeEditModal}>
                    <Text style={styles.editModalClose}>✕</Text>
                  </TouchableOpacity>
                </View>

                <TextInput
                  style={styles.editInput}
                  placeholder="Edit your post..."
                  placeholderTextColor="#9ca3af"
                  multiline
                  value={editContent}
                  onChangeText={setEditContent}
                  editable={!updatePostMutation.isPending}
                />

                <View style={styles.editModalActions}>
                  <TouchableOpacity
                    onPress={closeEditModal}
                    style={styles.editCancelButton}
                    disabled={updatePostMutation.isPending}
                  >
                    <Text style={styles.editCancelText}>Cancel</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={handleSaveEditPost}
                    disabled={updatePostMutation.isPending || !editContent.trim()}
                    style={[
                      styles.editSaveButton,
                      (updatePostMutation.isPending || !editContent.trim()) && styles.editSaveButtonDisabled,
                    ]}
                  >
                    {updatePostMutation.isPending ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Text style={styles.editSaveText}>Save</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </Modal>

          <Modal
            visible={isDeleteModalVisible}
            animationType="fade"
            transparent={true}
            onRequestClose={closeDeleteModal}
          >
            <View style={styles.deleteModalOverlay}>
              <View style={styles.deleteModalCard}>
                <Text style={styles.deleteModalTitle}>Delete Post?</Text>
                <Text style={styles.deleteModalDescription}>
                  Are you sure you want to delete this post? This action cannot be undone.
                </Text>

                <View style={styles.deleteModalActions}>
                  <TouchableOpacity
                    onPress={closeDeleteModal}
                    style={styles.deleteCancelButton}
                    disabled={deletePostMutation.isPending}
                  >
                    <Text style={styles.deleteCancelText}>Cancel</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={confirmDeletePost}
                    disabled={deletePostMutation.isPending}
                    style={[
                      styles.deleteConfirmButton,
                      deletePostMutation.isPending && styles.deleteConfirmButtonDisabled,
                    ]}
                  >
                    {deletePostMutation.isPending ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Text style={styles.deleteConfirmText}>Delete</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </Modal>
        </>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fafafa',
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#dbdbdb',
    marginBottom: 16,
  },
  tab: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeTab: {
    borderBottomColor: '#0095f6',
  },
  tabText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#8e8e8e',
  },
  activeTabText: {
    color: '#262626',
  },
  
  // Friend Filter Dropdown Styles
  filterContainer: {
    backgroundColor: '#fff',
    marginHorizontal: 12,
    marginBottom: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#dbdbdb',
    alignSelf: 'flex-start',
    minWidth: 200,
    maxWidth: '50%',
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
  filterButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  filterButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#262626',
  },
  filterButtonIcon: {
    fontSize: 12,
    color: '#8e8e8e',
  },
  dropdownMenu: {
    borderTopWidth: 1,
    borderTopColor: '#efefef',
    maxHeight: 200,
  },
  dropdownScroll: {
    maxHeight: 200,
  },
  dropdownItem: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#efefef',
  },
  dropdownItemActive: {
    backgroundColor: '#f0f8ff',
  },
  dropdownItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  dropdownAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    overflow: 'hidden',
  },
  dropdownAvatarPlaceholder: {
    backgroundColor: '#0095f6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dropdownAvatarText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  dropdownItemText: {
    fontSize: 14,
    color: '#262626',
  },
  dropdownItemTextActive: {
    fontWeight: '600',
    color: '#0095f6',
  },
  
  // Create Post Styles (Instagram-like)
  createPostContainer: {
    backgroundColor: '#fff',
    padding: 16,
    marginHorizontal: 12,
    marginBottom: 12,
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
  createPostHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  createPostAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#0095f6',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  createPostAvatarText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  createPostInputWrapper: {
    flex: 1,
  },
  createPostInput: {
    fontSize: 15,
    color: '#262626',
    minHeight: 40,
    maxHeight: 120,
    padding: 0,
    lineHeight: 20,
  },
  emojiPickerContainer: {
    marginTop: 12,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: '#efefef',
  },
  emojiButton: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  emojiText: {
    fontSize: 24,
  },
  createPostActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#efefef',
  },
  createPostToolbar: {
    flexDirection: 'row',
    gap: 16,
  },
  toolbarButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  toolbarIcon: {
    fontSize: 20,
  },
  toolbarLabel: {
    fontSize: 13,
    color: '#737373',
    fontWeight: '500',
  },
  publishButton: {
    backgroundColor: '#0095f6',
    borderRadius: 8,
    paddingHorizontal: 20,
    paddingVertical: 8,
    minWidth: 80,
    alignItems: 'center',
    justifyContent: 'center',
  },
  publishButtonDisabled: {
    backgroundColor: '#b2dffc',
  },
  publishButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  characterCount: {
    fontSize: 12,
    color: '#8e8e8e',
    textAlign: 'right',
    marginTop: 4,
  },
  selectedImagesContainer: {
    marginTop: 12,
    paddingVertical: 8,
  },
  selectedImageWrapper: {
    position: 'relative',
    marginRight: 8,
  },
  selectedImagePreview: {
    width: 100,
    height: 100,
    borderRadius: 8,
    backgroundColor: '#f0f0f0',
  },
  removeImageButton: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: '#ff3b30',
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 3,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  removeImageText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  linkInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#efefef',
    gap: 8,
  },
  linkInputIcon: {
    fontSize: 18,
  },
  linkInput: {
    flex: 1,
    fontSize: 14,
    color: '#262626',
    padding: 0,
  },
  clearLinkButton: {
    fontSize: 16,
    color: '#8e8e8e',
    padding: 4,
  },
  
  // Feed List Styles
  feedContainer: {
    paddingBottom: 16,
    paddingHorizontal: 0,
  },
  
  // Post Card Styles (Instagram-like)
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
  postStats: {
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  statsText: {
    fontSize: 13,
    color: '#262626',
    fontWeight: '600',
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
  
  // Loading & Empty States
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    backgroundColor: '#fafafa',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#8e8e8e',
  },
  loadMoreContainer: {
    paddingVertical: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadMoreText: {
    marginTop: 8,
    fontSize: 13,
    color: '#8e8e8e',
  },
  emptyContainer: {
    padding: 48,
    alignItems: 'center',
    backgroundColor: '#fff',
    marginTop: 16,
    marginHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#dbdbdb',
  },
  emptyText: {
    fontSize: 16,
    color: '#8e8e8e',
    textAlign: 'center',
    lineHeight: 22,
  },
  editModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    padding: 20,
  },
  editModalCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    maxHeight: '80%',
  },
  editModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  editModalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1f2937',
  },
  editModalClose: {
    fontSize: 22,
    color: '#6b7280',
  },
  editInput: {
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: '#1f2937',
    minHeight: 120,
    textAlignVertical: 'top',
    marginBottom: 16,
  },
  editModalActions: {
    flexDirection: 'row',
    gap: 12,
  },
  editCancelButton: {
    flex: 1,
    backgroundColor: '#f3f4f6',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
  },
  editCancelText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#6b7280',
  },
  editSaveButton: {
    flex: 1,
    backgroundColor: '#2563eb',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editSaveButtonDisabled: {
    backgroundColor: '#d1d5db',
  },
  editSaveText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
  },
  deleteModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  deleteModalCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    width: '100%',
    maxWidth: 380,
  },
  deleteModalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1f2937',
    marginBottom: 8,
    textAlign: 'center',
  },
  deleteModalDescription: {
    fontSize: 14,
    color: '#6b7280',
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: 20,
  },
  deleteModalActions: {
    flexDirection: 'row',
    gap: 12,
  },
  deleteCancelButton: {
    flex: 1,
    backgroundColor: '#f3f4f6',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
  },
  deleteCancelText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#6b7280',
  },
  deleteConfirmButton: {
    flex: 1,
    backgroundColor: '#dc2626',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteConfirmButtonDisabled: {
    backgroundColor: '#fca5a5',
  },
  deleteConfirmText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
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

export default function CommunityTab() {
  return (
    <RequireAuth>
      <CommunityScreen />
    </RequireAuth>
  );
}
