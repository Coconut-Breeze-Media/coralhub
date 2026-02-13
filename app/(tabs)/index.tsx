// app/(tabs)/index.tsx
import React, { useState } from 'react';
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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../lib/auth';
import RequireAuth from '../../components/RequireAuth';
import { 
  useActivityFeed, 
  useCreatePost, 
  useLikePost, 
  useSharePost, 
  useDeletePost 
} from '../../hooks/useActivity';
import { useMember } from '../../hooks/useMembers';
import { useMe, useFriendsList } from '../../hooks/useQueries';
import { useMyGroups, useGroupActivity } from '../../hooks/useGroups';
import type { BPActivity } from '../../types';

type TabType = 'feed' | 'my-posts' | 'groups-feed';

// Helper function to extract content text from BuddyPress API response
function getContentText(content: string | { rendered: string; raw?: string }): string {
  let text = '';
  if (typeof content === 'string') {
    text = content;
  } else {
    text = content.rendered || content.raw || '';
  }
  // Strip HTML tags
  return text.replace(/<[^>]+>/g, '').trim();
}

// Helper function to extract user name from title HTML
function getUserNameFromTitle(title: string): string {
  // Title format: '<a href="...">User Name</a>'
  const match = title.match(/>([^<]+)</);  
  return match ? match[1].trim() : 'Unknown User';
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
  
  // Match img tags with src or data-src attributes
  const imgRegex = /<img[^>]+(?:src|data-src)=["']([^"']+)["'][^>]*>/gi;
  let match;
  
  while ((match = imgRegex.exec(html)) !== null) {
    const url = match[1];
    if (url && !url.includes('Please-Upload-Avatar-Image')) {
      imageUrls.push(url);
    }
  }
  
  // Also match anchor tags with image links
  const anchorRegex = /<a[^>]+href=["']([^"']+\.(?:jpg|jpeg|png|gif|webp))["'][^>]*>/gi;
  while ((match = anchorRegex.exec(html)) !== null) {
    const url = match[1];
    if (url && !imageUrls.includes(url) && !url.includes('Please-Upload-Avatar-Image')) {
      imageUrls.push(url);
    }
  }
  
  return imageUrls;
}

// Helper function to extract links from HTML content
function extractLinks(content: string | { rendered: string; raw?: string }): Array<{ url: string; text: string }> {
  let html = '';
  if (typeof content === 'string') {
    html = content;
  } else {
    html = content.rendered || content.raw || '';
  }
  
  const links: Array<{ url: string; text: string }> = [];
  
  // Match anchor tags with href attributes
  const linkRegex = /<a[^>]+href=["']([^"']+)["'][^>]*>([^<]*)<\/a>/gi;
  let match;
  
  while ((match = linkRegex.exec(html)) !== null) {
    const url = match[1];
    let text = match[2].trim();
    
    // If text is too long (likely a full URL), shorten it
    if (text.length > 50) {
      try {
        const urlObj = new URL(text);
        text = urlObj.hostname;
      } catch {
        text = text.substring(0, 50) + '...';
      }
    }
    
    if (url && text && !url.includes('Please-Upload-Avatar-Image')) {
      // Avoid duplicates
      if (!links.find(link => link.url === url)) {
        links.push({ url, text: text || url });
      }
    }
  }
  
  return links;
}

// Post Item Component - fetches user data for each post
function PostItem({ 
  item, 
  token, 
  profile, 
  onLike, 
  onShare, 
  onDelete 
}: { 
  item: BPActivity;
  token: string | null;
  profile: any;
  onLike: (activityId: number, isLiked: boolean) => void;
  onShare: (activityId: number) => void;
  onDelete: (activityId: number) => void;
}) {
  // Fetch member data from BuddyPress API
  const { data: memberData, isLoading: isMemberLoading } = useMember(token, item.user_id);
  
  const isCurrentUserPost = item.user_id === profile?.user_id;
  const isLiked = item.favorited || false;
  
  // Use member data from API if available, fallback to item data
  const userName = memberData?.name || item.user_name || getUserNameFromTitle(item.title);
  const userAvatar = memberData?.avatar_urls?.thumb || 
    (typeof item.user_avatar === 'object' ? item.user_avatar.thumb : item.user_avatar) || 
    undefined;
  
  // Extract images from content
  const imageUrls = extractImageUrls(item.content);
  const links = extractLinks(item.content);
  
  const handleLinkPress = async (url: string) => {
    try {
      const canOpen = await Linking.canOpenURL(url);
      if (canOpen) {
        await Linking.openURL(url);
      } else {
        Alert.alert('Error', 'Cannot open this link');
      }
    } catch (error) {
      console.error('Error opening link:', error);
      Alert.alert('Error', 'Failed to open link');
    }
  };
  
  // Log each post being rendered
  console.log('[PostItem] Rendering post:', {
    id: item.id,
    user_id: item.user_id,
    user_name: userName,
    user_avatar: userAvatar,
    memberData,
    content: item.content,
    date: item.date,
    favorited: item.favorited,
    favorite_count: item.favorite_count,
    component: item.component,
    type: item.type,
    isCurrentUserPost,
    isLiked,
  });
  
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
          <TouchableOpacity
            onPress={() => onDelete(item.id)}
            style={styles.deleteButton}
          >
            <Text style={styles.deleteButtonText}>•••</Text>
          </TouchableOpacity>
        )}
      </View>
      
      {/* Post Content */}
      <Text style={styles.postContent}>{getContentText(item.content)}</Text>
      
      {/* Post Images */}
      {imageUrls.length > 0 && (
        <View style={styles.postImages}>
          {imageUrls.map((url, index) => (
            <Image
              key={index}
              source={{ uri: url }}
              style={styles.postImage}
              resizeMode="cover"
            />
          ))}
        </View>
      )}
      
      {/* Post Links */}
      {links.length > 0 && (
        <View style={styles.postLinks}>
          {links.map((link, index) => (
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
          onPress={() => Alert.alert('Comment', 'Comment feature coming soon!')}
          style={styles.actionButton}
        >
          <Text style={styles.actionIcon}>💬</Text>
          <Text style={styles.actionLabel}>Comment</Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          onPress={() => onShare(item.id)}
          style={styles.actionButton}
        >
          <Text style={styles.actionIcon}>📤</Text>
          <Text style={styles.actionLabel}>Share</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function CommunityScreen() {
  const { token, profile } = useAuth();
  const [activeTab, setActiveTab] = useState<TabType>('feed');
  const [postContent, setPostContent] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [selectedFriendId, setSelectedFriendId] = useState<number | undefined>(undefined);
  const [showFriendDropdown, setShowFriendDropdown] = useState(false);
  const [selectedGroupId, setSelectedGroupId] = useState<number | undefined>(undefined);
  const [showGroupDropdown, setShowGroupDropdown] = useState(false);
  
  // Get current user data
  const { data: currentUser } = useMe();
  const userId = currentUser?.id;
  
  // Fetch friends list
  const { data: friendsData } = useFriendsList(userId, 1, 100);
  const friends = friendsData?.friends || [];
  
  // Fetch user's groups
  const { data: userGroups } = useMyGroups(token);
  const groups = userGroups || [];
  
  // Fetch group activity if groups-feed tab is active
  const { data: groupActivityData, isLoading: isLoadingGroupActivity, refetch: refetchGroupActivity } = useGroupActivity(
    token,
    activeTab === 'groups-feed' ? selectedGroupId : undefined
  );
  
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
  } = useActivityFeed(token, scope, filterUserId);
  
  // Flatten all activities from all pages
  let allActivities = feedData?.pages?.flatMap(page => page.activities) || [];
  
  // For groups feed, use group activity if specific group is selected
  if (activeTab === 'groups-feed' && selectedGroupId && groupActivityData) {
    allActivities = groupActivityData.activities || [];
  }
  
  // Filter out unwanted activity types
  allActivities = allActivities.filter(activity => {
    const unwantedTypes = ['joined_group', 'created_group', 'new_member', 'friendship_created', 'new_cover'];
    return !unwantedTypes.includes(activity.type);
  });
  
  // Log posts data for debugging
  console.log('[CommunityScreen] Feed data:', feedData);
  console.log('[CommunityScreen] Total pages:', feedData?.pages?.length || 0);
  console.log('[CommunityScreen] Total activities:', allActivities.length);
  console.log('[CommunityScreen] Has next page:', hasNextPage);
  
  // Mutations
  const createPostMutation = useCreatePost(token);
  const likePostMutation = useLikePost(token);
  const sharePostMutation = useSharePost(token);
  const deletePostMutation = useDeletePost(token);
  
  const handleCreatePost = async () => {
    if (!postContent.trim()) {
      Alert.alert('Error', 'Please enter some content for your post');
      return;
    }
    
    try {
      await createPostMutation.mutateAsync({
        content: postContent,
      });
      setPostContent('');
      Alert.alert('Success', 'Post created successfully!');
    } catch (error) {
      Alert.alert('Error', 'Failed to create post');
      console.error('Create post error:', error);
    }
  };
  
  const handleAddEmoji = (emoji: string) => {
    setPostContent(postContent + emoji);
  };
  
  const handleAttachFile = () => {
    Alert.alert('Attach File', 'File attachment feature coming soon!');
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
      console.error('Like post error:', error);
    }
  };
  
  const handleSharePost = async (activityId: number) => {
    try {
      await sharePostMutation.mutateAsync({ activityId });
      Alert.alert('Success', 'Post shared successfully!');
    } catch (error) {
      Alert.alert('Error', 'Failed to share post');
      console.error('Share post error:', error);
    }
  };
  
  const handleDeletePost = async (activityId: number) => {
    Alert.alert(
      'Delete Post',
      'Are you sure you want to delete this post?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deletePostMutation.mutateAsync(activityId);
              Alert.alert('Success', 'Post deleted successfully!');
            } catch (error) {
              Alert.alert('Error', 'Failed to delete post');
              console.error('Delete post error:', error);
            }
          },
        },
      ]
    );
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
        onShare={handleSharePost}
        onDelete={handleDeletePost}
      />
    );
  };
  
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
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
              <TextInput
                style={styles.createPostInput}
                placeholder="What's on your mind?"
                placeholderTextColor="#999"
                value={postContent}
                onChangeText={setPostContent}
                multiline
                maxLength={500}
              />
            </View>
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
                (!postContent.trim() || createPostMutation.isPending) && styles.publishButtonDisabled,
              ]}
              onPress={handleCreatePost}
              disabled={!postContent.trim() || createPostMutation.isPending}
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
      {(isLoading || (activeTab === 'groups-feed' && selectedGroupId && isLoadingGroupActivity)) ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#0066cc" />
          <Text style={styles.loadingText}>Loading posts...</Text>
        </View>
      ) : (
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
  deleteButton: {
    padding: 8,
  },
  deleteButtonText: {
    color: '#262626',
    fontSize: 20,
    fontWeight: 'bold',
    letterSpacing: 1,
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
    height: 300,
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
    fontSize: 15,
    color: '#8e8e8e',
    textAlign: 'center',
    lineHeight: 22,
  },
});

export default function CommunityTab() {
  return (
    <RequireAuth>
      <CommunityScreen />
    </RequireAuth>
  );
}