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
import MentionInput from '../../components/MentionInput';
import PostCard from '../../components/PostCard';
import PostActionModals from '../../components/PostActionModals';
import {
  useActivityFeed,
  useCreatePost,
  useLikePost,
  useDeletePost,
  useUpdatePost
} from '../../hooks/useActivity';
import { useQueryClient } from '@tanstack/react-query';
import { getMemberById } from '../../lib/api';
import { useMe, useFriendsList } from '../../hooks/useQueries';
import { useMyGroups, useGroupActivity, useAllGroupsActivity } from '../../hooks/useGroups';
import { useEffect, useRef } from 'react';
import type { BPActivity } from '../../types';

type TabType = 'feed' | 'my-posts' | 'groups-feed';


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
  const { data: userGroups, isLoading: isLoadingMyGroups } = useMyGroups(token);
  const groups = useMemo(() => userGroups || [], [userGroups]);
  
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

  // "All Groups" — combined, paginated feed across every group the user is
  // in, with infinite scroll (only active while on that view).
  const isAllGroupsView = activeTab === 'groups-feed' && !selectedGroupId;
  const groupIds = useMemo(() => groups.map((g) => g.id), [groups]);
  const {
    data: allGroupsPages,
    isLoading: isLoadingAllGroups,
    isFetching: isFetchingAllGroups,
    fetchNextPage: fetchNextAllGroupsPage,
    hasNextPage: hasNextAllGroupsPage,
    isFetchingNextPage: isFetchingNextAllGroupsPage,
    refetch: refetchAllGroups,
  } = useAllGroupsActivity(isAllGroupsView ? token : null, isAllGroupsView ? groupIds : []);
  const allGroupsActivities = allGroupsPages?.pages?.flatMap((page) => page.activities) || [];

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
    if (isAllGroupsView) {
      if (hasNextAllGroupsPage && !isFetchingNextAllGroupsPage) {
        fetchNextAllGroupsPage();
      }
      return;
    }
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  };
  
  const renderPost = ({ item }: { item: BPActivity }) => {
    return (
      <PostCard
        item={item}
        token={token}
        profile={profile}
        onLike={handleLikePost}
        onDelete={handleDeletePost}
        onEdit={handleOpenEditPost}
        groups={groups}
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
      {(isLoading || !membersReady
        || (activeTab === 'groups-feed' && selectedGroupId && isLoadingGroupActivity)
        || (isAllGroupsView && (isLoadingMyGroups || isLoadingAllGroups || (groups.length > 0 && isFetchingAllGroups && allGroupsActivities.length === 0)))
      ) ? (
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
                  } else if (isAllGroupsView) {
                    refetchAllGroups();
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
              (isAllGroupsView ? isFetchingNextAllGroupsPage : isFetchingNextPage) ? (
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

          <PostActionModals
            isEditVisible={isEditModalVisible}
            editContent={editContent}
            onChangeEditContent={setEditContent}
            onCloseEdit={closeEditModal}
            onSaveEdit={handleSaveEditPost}
            isSaving={updatePostMutation.isPending}
            isDeleteVisible={isDeleteModalVisible}
            onCloseDelete={closeDeleteModal}
            onConfirmDelete={confirmDeletePost}
            isDeleting={deletePostMutation.isPending}
          />
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
