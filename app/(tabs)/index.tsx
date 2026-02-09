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
import type { BPActivity } from '../../types';

type TabType = 'feed' | 'my-posts';

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

function CommunityScreen() {
  const { token, profile } = useAuth();
  const [activeTab, setActiveTab] = useState<TabType>('feed');
  const [postContent, setPostContent] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  
  // Fetch feed based on active tab
  const scope = activeTab === 'my-posts' ? 'just-me' : undefined;
  const { data: feedData, isLoading, refetch, isRefetching } = useActivityFeed(token, scope);
  
  // Filter activities - in My Posts tab, only show posts with component "activity"
  const filteredActivities = feedData?.activities?.filter(activity => {
    if (activeTab === 'my-posts') {
      return activity.component === 'activity';
    }
    return true; // Show all in feed tab
  }) || [];
  
  // Log posts data for debugging
  console.log('[CommunityScreen] Feed data:', feedData);
  console.log('[CommunityScreen] Total activities:', feedData?.activities?.length || 0);
  console.log('[CommunityScreen] Filtered activities:', filteredActivities.length);
  console.log('[CommunityScreen] Activities:', feedData?.activities);
  
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
  
  const renderPost = ({ item }: { item: BPActivity }) => {
    const isCurrentUserPost = item.user_id === profile?.user_id;
    const isLiked = item.favorited || false;
    const userName = item.user_name || getUserNameFromTitle(item.title);
    const userAvatar = typeof item.user_avatar === 'object' ? item.user_avatar.thumb : undefined;
    
    // Log each post being rendered
    console.log('[renderPost] Rendering post:', {
      id: item.id,
      user_id: item.user_id,
      user_name: userName,
      user_avatar: userAvatar,
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
              onPress={() => handleDeletePost(item.id)}
              style={styles.deleteButton}
            >
              <Text style={styles.deleteButtonText}>•••</Text>
            </TouchableOpacity>
          )}
        </View>
        
        {/* Post Content */}
        <Text style={styles.postContent}>{getContentText(item.content)}</Text>
        
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
            onPress={() => handleLikePost(item.id, isLiked)}
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
            onPress={() => handleSharePost(item.id)}
            style={styles.actionButton}
          >
            <Text style={styles.actionIcon}>📤</Text>
            <Text style={styles.actionLabel}>Share</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };
  
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Community</Text>
      </View>
      
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
          style={[styles.tab, activeTab === 'my-posts' && styles.activeTab]}
          onPress={() => setActiveTab('my-posts')}
        >
          <Text style={[styles.tabText, activeTab === 'my-posts' && styles.activeTabText]}>
            My Posts
          </Text>
        </TouchableOpacity>
      </View>
      
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
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#0066cc" />
          <Text style={styles.loadingText}>Loading posts...</Text>
        </View>
      ) : (
        <FlatList
          data={filteredActivities}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderPost}
          contentContainerStyle={styles.feedContainer}
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={refetch} colors={['#0066cc']} />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>
                {activeTab === 'my-posts'
                  ? 'No posts yet.\nStart sharing your thoughts with the community!'
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
  header: {
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#dbdbdb',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#262626',
    letterSpacing: 0.3,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#dbdbdb',
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