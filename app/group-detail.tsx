// app/group-detail.tsx
/**
 * Group Detail Screen
 * Displays detailed information about a group and its activity feed
 */

import { View, Text, ScrollView, ActivityIndicator, RefreshControl, Image, TouchableOpacity, TextInput, Alert, Modal, Linking, KeyboardAvoidingView, Platform, Keyboard } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../lib/auth';
import { uploadImage } from '../lib/api';
import {
  useGroup, useGroupActivityInfinite, useGroupMembers,
  useJoinGroup, useLeaveGroup,
  useRequestMembership, useMyMembershipRequest,
  useGroupMembershipRequests, useAcceptMembershipRequest, useRejectMembershipRequest,
  useMyGroups,
} from '../hooks/useGroups';
import { useMember } from '../hooks/useMembers';
import { useCreateGroupPost, useLikePost, useUpdatePost, useDeletePost } from '../hooks/useActivity';
import BackButton from '../components/BackButton';
import PostCard from '../components/PostCard';
import PostActionModals from '../components/PostActionModals';
import { useState, useEffect, useRef } from 'react';
import { useLocalSearchParams } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import type { BPActivity } from '../types';

type TabType = 'home' | 'members' | 'media' | 'documents' | 'requests';

// Group status badge colors
const STATUS_COLORS: Record<string, { bg: string; text: string; icon: string }> = {
  public: { bg: '#dcfce7', text: '#15803d', icon: 'earth-outline' },
  private: { bg: '#fef3c7', text: '#a16207', icon: 'lock-closed-outline' },
  hidden: { bg: '#f3f4f6', text: '#4b5563', icon: 'eye-off-outline' },
};

// Activity type icons
const ACTIVITY_TYPE_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  'activity_update': 'chatbox-outline',
  'activity_comment': 'chatbubble-outline',
  'new_member': 'person-add-outline',
  'joined_group': 'people-outline',
  'created_group': 'add-circle-outline',
};

export default function GroupDetailScreen() {
  const { token, userId } = useAuth();
  const params = useLocalSearchParams();
  const groupId = params.id ? parseInt(params.id as string) : null;
  
  const { data: group, isLoading: loadingGroup, refetch: refetchGroup } = useGroup(token, groupId);
  const {
    data: activityPages,
    isLoading: loadingActivity,
    error: activityError,
    refetch: refetchActivity,
    fetchNextPage: fetchNextActivityPage,
    hasNextPage: hasNextActivityPage,
    isFetchingNextPage: isFetchingNextActivityPage,
  } = useGroupActivityInfinite(token, groupId);
  const activityData = activityPages?.pages?.[0];
  const { data: members, isLoading: loadingMembers, error: membersError, refetch: refetchMembers } = useGroupMembers(token, groupId);
  // 403 = private group, non-member — API intentionally denies access. Treat as "not a member, done loading".
  const membersAccessDenied = !!(membersError && (membersError as any)?.status === 403);

  // The members list above is capped (per_page) and can easily miss the
  // current user in a large group (e.g. 1000+ members) if they're not on the
  // first page. Cross-check against the user's own "my groups" list, which
  // is authoritative and not paginated the same way.
  const { data: myGroups, isLoading: loadingMyGroups } = useMyGroups(token);
  const isMemberViaMyGroups = !!(groupId && myGroups?.some((g) => g.id === groupId));

  const membersDoneLoading = (!loadingMembers || membersAccessDenied) && !loadingMyGroups;
  
  const createGroupPostMutation = useCreateGroupPost(token);
  const joinGroupMutation = useJoinGroup(token);
  const leaveGroupMutation = useLeaveGroup(token);
  const requestMembershipMutation = useRequestMembership(token);
  const acceptRequestMutation = useAcceptMembershipRequest(token);
  const rejectRequestMutation = useRejectMembershipRequest(token);

  // Like / Edit / Delete for posts in this group's activity list — shared
  // <PostCard> + <PostActionModals> components, same pattern as the News
  // Feed / All Groups screen, so behavior and styling stay identical.
  const likePostMutation = useLikePost(token);
  const updatePostMutation = useUpdatePost(token);
  const deletePostMutation = useDeletePost(token);

  const isMember = !!(userId && members?.some((m) => m.id === userId)) || isMemberViaMyGroups;
  const isGroupCreator = !!(userId && group?.creator_id === userId);
  const isAdmin = !!(userId && members?.some((m) => m.id === userId && m.roles?.includes('admin')));
  const canManageRequests = isGroupCreator || isAdmin;

  // Always check for a pending request when we have IDs — lets the query run regardless of group status
  const { data: myRequest } = useMyMembershipRequest(token, userId, groupId);
  const apiHasPendingRequest = !!(myRequest && myRequest.length > 0);
  const myPendingRequestId = apiHasPendingRequest ? myRequest![0].id : null;
  // Combine API result with local mutation state: if the mutation just succeeded this session, treat as pending
  const hasPendingRequest = apiHasPendingRequest || requestMembershipMutation.isSuccess;

  const { data: membershipRequests, refetch: refetchMembershipRequests } =
    useGroupMembershipRequests(canManageRequests ? token : null, canManageRequests ? groupId : null);
  
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('home');
  const [newPostContent, setNewPostContent] = useState('');
  const [isPostingActivity, setIsPostingActivity] = useState(false);
  const [selectedImages, setSelectedImages] = useState<string[]>([]);
  const [postLink, setPostLink] = useState('');
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [isEditModalVisible, setIsEditModalVisible] = useState(false);
  const [editingPost, setEditingPost] = useState<BPActivity | null>(null);
  const [editContent, setEditContent] = useState('');
  const [isDeleteModalVisible, setIsDeleteModalVisible] = useState(false);
  const [deletingPost, setDeletingPost] = useState<BPActivity | null>(null);
  const contentScrollRef = useRef<ScrollView | null>(null);
  const postComposerOffsetRef = useRef(0);
  const pendingScrollOffsetRef = useRef<number | null>(null);

  // Scroll the focused input fully above the keyboard once we know its real
  // height — a fixed offset doesn't work across devices (keyboard height
  // varies by device/OS, and further with predictive text/autofill bars).
  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';

    const showSub = Keyboard.addListener(showEvent, (e) => {
      if (pendingScrollOffsetRef.current === null) return;
      const keyboardHeight = e.endCoordinates?.height || 0;
      const targetOffset = pendingScrollOffsetRef.current;
      pendingScrollOffsetRef.current = null;
      requestAnimationFrame(() => {
        contentScrollRef.current?.scrollTo({
          y: Math.max(0, targetOffset - 40),
          animated: true,
        });
      });
      // keyboardHeight is available if we need finer control later; the
      // KeyboardAvoidingView already pads the ScrollView by this amount.
      void keyboardHeight;
    });

    return () => {
      showSub.remove();
    };
  }, []);

  // Log group data when loaded
  useEffect(() => {
    if (group) {
    }
  }, [group]);

  // Log activity data when loaded
  useEffect(() => {
    if (activityData) {
      if (activityData.activities && activityData.activities.length > 0) {
        const first = activityData.activities[0];
      } else {
      }
    }
  }, [activityData]);

  // Log members data
  useEffect(() => {
    if (members) {
      members.forEach((member, index) => {
      });
    }
  }, [members, group?.total_member_count]);

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([
      refetchGroup(), refetchActivity(), refetchMembers(),
      canManageRequests ? refetchMembershipRequests() : Promise.resolve(),
    ]);
    setRefreshing(false);
  };

  // Handle image picker
  const handlePickImage = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Please grant permission to access your photos');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsMultipleSelection: true,
        quality: 0.8,
        selectionLimit: 5,
      });

      if (!result.canceled && result.assets) {
        const newImages = result.assets.map(asset => asset.uri);
        setSelectedImages(prev => [...prev, ...newImages].slice(0, 5)); // Max 5 images
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to pick image');
    }
  };

  const handleCreatePost = async () => {
    if (!newPostContent.trim() && selectedImages.length === 0 && !postLink.trim()) {
      Alert.alert('Error', 'Please enter some content, add an image, or add a link');
      return;
    }

    if (!groupId) {
      Alert.alert('Error', 'Invalid group ID');
      return;
    }

    try {
      setIsPostingActivity(true);
      
      // Build content with text and link
      let fullContent = newPostContent.trim();
      
      // Add link if provided
      if (postLink.trim()) {
        fullContent += `\n\n<a href="${postLink}" target="_blank">${postLink}</a>`;
      }
      
      // Upload images to WordPress first and get public URLs
      if (selectedImages.length > 0) {
        
        const uploadedUrls: string[] = [];
        
        for (let i = 0; i < selectedImages.length; i++) {
          const imageUri = selectedImages[i];
          const fileName = `group-post-image-${Date.now()}-${i}.jpg`;
          
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
      
      await createGroupPostMutation.mutateAsync({
        groupId,
        content: fullContent,
      });
      
      // Reset all states
      setNewPostContent('');
      setSelectedImages([]);
      setPostLink('');
      
      await refetchActivity();
      Alert.alert('Success', 'Post created successfully!');
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to create post');
    } finally {
      setIsPostingActivity(false);
    }
  };

  const handleLikePost = async (activityId: number, isLiked: boolean) => {
    try {
      await likePostMutation.mutateAsync({ activityId, isLiked });
    } catch (error) {
      Alert.alert('Error', 'Failed to like post');
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

  const formatMemberCount = (count: number) => {
    if (count === 1) return '1 member';
    return `${count.toLocaleString()} members`;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInMs = now.getTime() - date.getTime();
    const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60));
    const diffInDays = Math.floor(diffInHours / 24);

    if (diffInHours < 1) {
      const diffInMinutes = Math.floor(diffInMs / (1000 * 60));
      return diffInMinutes <= 1 ? 'Just now' : `${diffInMinutes}m ago`;
    } else if (diffInHours < 24) {
      return `${diffInHours}h ago`;
    } else if (diffInDays < 7) {
      return `${diffInDays}d ago`;
    } else {
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      });
    }
  };

  const getStatusConfig = (status: string) => {
    return STATUS_COLORS[status] || STATUS_COLORS.public;
  };

  const getActivityIcon = (type: string): keyof typeof Ionicons.glyphMap => {
    return ACTIVITY_TYPE_ICONS[type] || 'ellipse-outline';
  };

  // Decodes both named (&amp;, &#8217;, ...) and numeric (&#123;, &#x7B;)
  // HTML entities — WordPress content is full of these (curly quotes,
  // em dashes, etc.) and without this they show up literally as "&#8217;"
  // instead of the character they represent.
  const decodeHtmlEntities = (text: string): string =>
    text
      .replace(/&#x([0-9a-f]+);/gi, (_match, hex) => String.fromCharCode(parseInt(hex, 16)))
      .replace(/&#(\d+);/g, (_match, dec) => String.fromCharCode(parseInt(dec, 10)))
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'");

  const getContentText = (content: string | { rendered: string; raw?: string }): string => {
    let html = '';
    if (typeof content === 'string') {
      html = content;
    } else {
      html = content.rendered || content.raw || '';
    }

    // Preserve paragraph/line breaks before stripping tags, same as post content.
    html = html
      .replace(/<\/p\s*>/gi, '\n\n')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/li\s*>/gi, '\n');

    const text = decodeHtmlEntities(html.replace(/<[^>]+>/g, ''));
    return text.replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
  };

  const getMemberRole = (roles?: string[]): { label: string; color: string; bgColor: string } | null => {
    if (!roles || roles.length === 0) return null;
    
    if (roles.includes('admin')) {
      return { label: 'Admin', color: '#dc2626', bgColor: '#fee2e2' };
    }
    if (roles.includes('mod')) {
      return { label: 'Moderator', color: '#ea580c', bgColor: '#ffedd5' };
    }
    if (roles.includes('member')) {
      return { label: 'Member', color: '#2563eb', bgColor: '#dbeafe' };
    }
    
    return null;
  };

  const activities = activityPages?.pages?.flatMap((page) => page.activities) || [];
  
  // Real post count — use the server's total (X-WP-Total) for the type-filtered
  // query, not activities.length, which is just whatever fit on the current
  // page (per_page-capped) and would badly undercount active groups.
  const postsCount = activityData?.total ?? 0;
  
  const isLoading = loadingGroup || loadingActivity;

  const revealPostComposer = () => {
    pendingScrollOffsetRef.current = postComposerOffsetRef.current;
    // If the keyboard is already up (e.g. tabbing between fields), the
    // 'will/did show' event won't fire again — scroll right away too.
    if (Keyboard.isVisible()) {
      requestAnimationFrame(() => {
        contentScrollRef.current?.scrollTo({
          y: Math.max(0, postComposerOffsetRef.current - 40),
          animated: true,
        });
      });
      pendingScrollOffsetRef.current = null;
    }
  };

  if (!groupId) {
    return (
      <View style={{ flex: 1, backgroundColor: '#f9fafb', alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: '#ef4444', fontSize: 16 }}>Invalid group ID</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#f9fafb' }}>
      {/* Header with Back Button */}
      <View
        style={{
          backgroundColor: '#fff',
          borderBottomWidth: 1,
          borderBottomColor: '#e5e7eb',
          paddingHorizontal: 16,
          paddingTop: 60,
          paddingBottom: 16,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <BackButton />
          <Text style={{ fontSize: 20, fontWeight: '700', color: '#1f2937', flex: 1 }} numberOfLines={1}>
            {loadingGroup ? 'Loading...' : group?.name || 'Group'}
          </Text>
        </View>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        <ScrollView
          ref={contentScrollRef}
          contentContainerStyle={{ paddingBottom: 20 }}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#2563eb']} />
          }
        >
        {isLoading && !group ? (
          <View style={{ paddingVertical: 40, alignItems: 'center' }}>
            <ActivityIndicator size="large" color="#2563eb" />
            <Text style={{ marginTop: 12, color: '#6b7280' }}>Loading group...</Text>
          </View>
        ) : group ? (
          <>
            {/* Hero Header with Avatar, Name, Status, and Stats */}
            <View style={{ backgroundColor: '#1e3a5f', paddingVertical: 24, paddingHorizontal: 16 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 16 }}>
                {/* Group Avatar */}
                {group.avatar_urls?.full ? (
                  <Image
                    source={{ uri: group.avatar_urls.full }}
                    style={{
                      width: 80,
                      height: 80,
                      borderRadius: 40,
                      borderWidth: 3,
                      borderColor: '#fff',
                      backgroundColor: '#f3f4f6',
                    }}
                  />
                ) : (
                  <View
                    style={{
                      width: 80,
                      height: 80,
                      borderRadius: 40,
                      borderWidth: 3,
                      borderColor: '#fff',
                      backgroundColor: '#eff6ff',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Ionicons name="people" size={36} color="#3b82f6" />
                  </View>
                )}

                {/* Group Name and Status */}
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 22, fontWeight: '700', color: '#fff', marginBottom: 6 }}>
                    {group.name}
                  </Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Ionicons
                      name={getStatusConfig(group.status).icon as any}
                      size={14}
                      color="#cbd5e1"
                    />
                    <Text style={{ fontSize: 13, color: '#cbd5e1', textTransform: 'uppercase', fontWeight: '600' }}>
                      {group.status} GROUP
                    </Text>
                  </View>
                  {(group.created_since || group.date_created) && (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 }}>
                      <Ionicons name="time-outline" size={12} color="#94a3b8" />
                      <Text style={{ fontSize: 12, color: '#94a3b8', textTransform: 'uppercase' }}>
                        {group.created_since || formatDate(group.date_created)}
                      </Text>
                    </View>
                  )}
                </View>
              </View>

              {/* Stats */}
              <View style={{ flexDirection: 'row', gap: 24 }}>
                <View style={{ alignItems: 'center' }}>
                  {loadingActivity && !activityData ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={{ fontSize: 24, fontWeight: '700', color: '#fff' }}>
                      {postsCount}
                    </Text>
                  )}
                  <Text style={{ fontSize: 12, color: '#cbd5e1', textTransform: 'uppercase', marginTop: 2 }}>
                    Posts
                  </Text>
                </View>
                <View style={{ alignItems: 'center' }}>
                  <Text style={{ fontSize: 24, fontWeight: '700', color: '#fff' }}>
                    {group.total_member_count || 0}
                  </Text>
                  <Text style={{ fontSize: 12, color: '#cbd5e1', textTransform: 'uppercase', marginTop: 2 }}>
                    Members
                  </Text>
                </View>
              </View>
              
              {/* Join / Leave Button — only for public groups, not the creator */}
              {!isGroupCreator && membersDoneLoading && (isMember || group.status === 'public' || group.status === 'private') && (
                <View style={{ marginTop: 16 }}>
                  {isMember ? (
                    <TouchableOpacity
                      onPress={() => {
                        setShowLeaveModal(true);
                      }}
                      disabled={leaveGroupMutation.isPending}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 6,
                        backgroundColor: 'rgba(239,68,68,0.15)',
                        borderWidth: 1.5,
                        borderColor: '#ef4444',
                        borderRadius: 8,
                        paddingVertical: 10,
                        paddingHorizontal: 20,
                        opacity: leaveGroupMutation.isPending ? 0.6 : 1,
                      }}
                    >
                      <Ionicons name="exit-outline" size={18} color="#ef4444" />
                      <Text style={{ fontSize: 14, fontWeight: '700', color: '#ef4444' }}>
                        {leaveGroupMutation.isPending ? 'Leaving...' : 'Leave Group'}
                      </Text>
                    </TouchableOpacity>
                  ) : group.status === 'private' ? (
                    /* ── PRIVATE GROUP: Request / Pending / Cancel ── */
                    hasPendingRequest ? (
                      /* Already sent a request — show pending state */
                      <View style={{
                        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10,
                      }}>
                        {/* Pending badge */}
                        <View style={{
                          flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
                          backgroundColor: 'rgba(234,179,8,0.12)', borderWidth: 1.5, borderColor: '#ca8a04',
                          borderRadius: 8, paddingVertical: 10, paddingHorizontal: 12,
                        }}>
                          <Ionicons name="time-outline" size={18} color="#ca8a04" />
                          <Text style={{ fontSize: 14, fontWeight: '700', color: '#ca8a04' }}>
                            Request Pending
                          </Text>
                        </View>
                        {/* Cancel button — only if we have the request ID from the API */}
                        {myPendingRequestId && (
                          <TouchableOpacity
                            onPress={() => {
                              rejectRequestMutation.mutate(
                                { groupId: groupId!, requestId: myPendingRequestId },
                                {
                                  onSuccess: () => {
                                    Alert.alert('Cancelled', 'Your membership request has been cancelled.');
                                  },
                                  onError: (err: any) => {
                                    Alert.alert('Error', err.message || 'Could not cancel the request.');
                                  },
                                }
                              );
                            }}
                            disabled={rejectRequestMutation.isPending}
                            style={{
                              flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4,
                              backgroundColor: 'rgba(239,68,68,0.1)', borderWidth: 1.5, borderColor: '#ef4444',
                              borderRadius: 8, paddingVertical: 10, paddingHorizontal: 14,
                              opacity: rejectRequestMutation.isPending ? 0.6 : 1,
                            }}
                          >
                            {rejectRequestMutation.isPending
                              ? <ActivityIndicator size="small" color="#ef4444" />
                              : <><Ionicons name="close" size={16} color="#ef4444" /><Text style={{ fontSize: 13, fontWeight: '700', color: '#ef4444' }}>Cancel</Text></>
                            }
                          </TouchableOpacity>
                        )}
                      </View>
                    ) : (
                      <TouchableOpacity
                        onPress={() => {
                          requestMembershipMutation.mutate(
                            { groupId: groupId!, userId: userId! },
                            {
                              onSuccess: () => {
                                Alert.alert('Request Sent', 'Your membership request is pending approval by an admin.');
                              },
                              onError: (err: any) => {
                                Alert.alert('Error', err.message || 'Could not send the request.');
                              },
                            }
                          );
                        }}
                        disabled={requestMembershipMutation.isPending || requestMembershipMutation.isSuccess}
                        style={{
                          flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
                          backgroundColor: '#2563eb', borderRadius: 8,
                          paddingVertical: 10, paddingHorizontal: 20,
                          opacity: (requestMembershipMutation.isPending || requestMembershipMutation.isSuccess) ? 0.6 : 1,
                        }}
                      >
                        {requestMembershipMutation.isPending
                          ? <ActivityIndicator size="small" color="#fff" />
                          : <Ionicons name="send-outline" size={18} color="#fff" />
                        }
                        <Text style={{ fontSize: 14, fontWeight: '700', color: '#fff' }}>
                          {requestMembershipMutation.isPending ? 'Sending...' : 'Request to Join'}
                        </Text>
                      </TouchableOpacity>
                    )
                  ) : (
                    /* ── PUBLIC GROUP: Join directly ── */
                    <TouchableOpacity
                      onPress={() => {
                        joinGroupMutation.mutate(
                          { groupId: groupId!, userId: userId! },
                          {
                            onSuccess: (data) => {
                              Alert.alert('Welcome!', `You joined "${group.name}".`);
                            },
                            onError: (err: any) => {
                              Alert.alert('Error', err.message || 'Could not join the group.');
                            },
                          }
                        );
                      }}
                      disabled={joinGroupMutation.isPending}
                      style={{
                        flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
                        backgroundColor: '#2563eb', borderRadius: 8,
                        paddingVertical: 10, paddingHorizontal: 20,
                        opacity: joinGroupMutation.isPending ? 0.6 : 1,
                      }}
                    >
                      <Ionicons name="person-add-outline" size={18} color="#fff" />
                      <Text style={{ fontSize: 14, fontWeight: '700', color: '#fff' }}>
                        {joinGroupMutation.isPending ? 'Joining...' : 'Join Group'}
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}

              {/* Additional Info */}
              {group.last_activity_diff && (
                <View style={{ marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.1)' }}>
                  <Text style={{ fontSize: 12, color: '#94a3b8', textAlign: 'center' }}>
                    Last activity: {group.last_activity_diff}
                  </Text>
                </View>
              )}
            </View>

            {/* Tab Navigation — only for members / group creator */}
            {(isMember || isGroupCreator) && (
            <View style={{ backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e5e7eb' }}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ paddingHorizontal: 8 }}
              >
                <TouchableOpacity
                  onPress={() => setActiveTab('home')}
                  style={{
                    paddingVertical: 12,
                    paddingHorizontal: 16,
                    borderBottomWidth: 3,
                    borderBottomColor: activeTab === 'home' ? '#2563eb' : 'transparent',
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Ionicons name="home" size={18} color={activeTab === 'home' ? '#2563eb' : '#6b7280'} />
                    <Text style={{
                      fontSize: 14,
                      fontWeight: '600',
                      color: activeTab === 'home' ? '#2563eb' : '#6b7280',
                    }}>
                      HOME
                    </Text>
                  </View>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => setActiveTab('members')}
                  style={{
                    paddingVertical: 12,
                    paddingHorizontal: 16,
                    borderBottomWidth: 3,
                    borderBottomColor: activeTab === 'members' ? '#2563eb' : 'transparent',
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Ionicons name="people" size={18} color={activeTab === 'members' ? '#2563eb' : '#6b7280'} />
                    <Text style={{
                      fontSize: 14,
                      fontWeight: '600',
                      color: activeTab === 'members' ? '#2563eb' : '#6b7280',
                    }}>
                      MEMBERS
                    </Text>
                    <View style={{
                      backgroundColor: activeTab === 'members' ? '#2563eb' : '#9ca3af',
                      borderRadius: 10,
                      paddingHorizontal: 6,
                      paddingVertical: 2,
                      minWidth: 20,
                      alignItems: 'center',
                    }}>
                      <Text style={{ fontSize: 11, fontWeight: '600', color: '#fff' }}>
                        {group.total_member_count}
                      </Text>
                    </View>
                  </View>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => setActiveTab('media')}
                  style={{
                    paddingVertical: 12,
                    paddingHorizontal: 16,
                    borderBottomWidth: 3,
                    borderBottomColor: activeTab === 'media' ? '#2563eb' : 'transparent',
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Ionicons name="images" size={18} color={activeTab === 'media' ? '#2563eb' : '#6b7280'} />
                    <Text style={{
                      fontSize: 14,
                      fontWeight: '600',
                      color: activeTab === 'media' ? '#2563eb' : '#6b7280',
                    }}>
                      MEDIA
                    </Text>
                  </View>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => setActiveTab('documents')}
                  style={{
                    paddingVertical: 12,
                    paddingHorizontal: 16,
                    borderBottomWidth: 3,
                    borderBottomColor: activeTab === 'documents' ? '#2563eb' : 'transparent',
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Ionicons name="document-text" size={18} color={activeTab === 'documents' ? '#2563eb' : '#6b7280'} />
                    <Text style={{
                      fontSize: 14,
                      fontWeight: '600',
                      color: activeTab === 'documents' ? '#2563eb' : '#6b7280',
                    }}>
                      DOCUMENTS
                    </Text>
                  </View>
                </TouchableOpacity>

                {/* Requests tab — admin / creator only, only for private groups */}
                {canManageRequests && group.status === 'private' && (
                  <TouchableOpacity
                    onPress={() => setActiveTab('requests')}
                    style={{
                      paddingVertical: 12,
                      paddingHorizontal: 16,
                      borderBottomWidth: 3,
                      borderBottomColor: activeTab === 'requests' ? '#2563eb' : 'transparent',
                    }}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Ionicons name="mail-unread" size={18} color={activeTab === 'requests' ? '#2563eb' : '#6b7280'} />
                      <Text style={{
                        fontSize: 14, fontWeight: '600',
                        color: activeTab === 'requests' ? '#2563eb' : '#6b7280',
                      }}>
                        REQUESTS
                      </Text>
                      {membershipRequests && membershipRequests.length > 0 && (
                        <View style={{
                          backgroundColor: '#ef4444', borderRadius: 10,
                          paddingHorizontal: 6, paddingVertical: 2, minWidth: 20, alignItems: 'center',
                        }}>
                          <Text style={{ fontSize: 11, fontWeight: '600', color: '#fff' }}>
                            {membershipRequests.length}
                          </Text>
                        </View>
                      )}
                    </View>
                  </TouchableOpacity>
                )}
              </ScrollView>
            </View>
            )}

            {/* ── NON-MEMBER VIEW: description + locked notice + members only ── */}
            {!isMember && !isGroupCreator && membersDoneLoading && (
              <View style={{ padding: 16, gap: 16 }}>
                {/* Description */}
                {group.description?.rendered && getContentText(group.description.rendered).length > 0 && (
                  <View style={{
                    backgroundColor: '#fff',
                    borderRadius: 12,
                    padding: 16,
                    borderWidth: 1,
                    borderColor: '#e5e7eb',
                  }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                      <Ionicons name="information-circle" size={20} color="#2563eb" />
                      <Text style={{ fontSize: 16, fontWeight: '700', color: '#1f2937' }}>Description</Text>
                    </View>
                    <Text style={{ fontSize: 14, color: '#4b5563', lineHeight: 22 }}>
                      {getContentText(group.description.rendered)}
                    </Text>
                  </View>
                )}

                {/* Members-only notice */}
                <View style={{
                  backgroundColor: '#eff6ff',
                  borderRadius: 12,
                  padding: 16,
                  borderWidth: 1,
                  borderColor: '#bfdbfe',
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 12,
                }}>
                  <Ionicons name="lock-closed" size={22} color="#2563eb" />
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 14, fontWeight: '700', color: '#1e40af', marginBottom: 2 }}>
                      Members only
                    </Text>
                    <Text style={{ fontSize: 13, color: '#3b82f6' }}>
                      Join this group to see posts, activity, media, and documents.
                    </Text>
                  </View>
                </View>

                {/* Members list */}
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4, marginBottom: 4 }}>
                  <Ionicons name="people" size={18} color="#6b7280" />
                  <Text style={{ fontSize: 15, fontWeight: '700', color: '#1f2937' }}>
                    Members · {group.total_member_count}
                  </Text>
                </View>
                {loadingMembers ? (
                  <View style={{ paddingVertical: 24, alignItems: 'center' }}>
                    <ActivityIndicator size="large" color="#2563eb" />
                  </View>
                ) : members && members.length > 0 ? (
                  <View style={{ gap: 12 }}>
                    {members.map((member) => (
                      <View
                        key={member.id}
                        style={{
                          backgroundColor: '#fff',
                          borderRadius: 12,
                          padding: 16,
                          borderWidth: 1,
                          borderColor: '#e5e7eb',
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: 12,
                        }}
                      >
                        {member.avatar_urls?.thumb ? (
                          <Image
                            source={{ uri: member.avatar_urls.thumb }}
                            style={{ width: 50, height: 50, borderRadius: 25, backgroundColor: '#f3f4f6' }}
                          />
                        ) : (
                          <View style={{
                            width: 50, height: 50, borderRadius: 25,
                            backgroundColor: '#eff6ff', alignItems: 'center', justifyContent: 'center',
                          }}>
                            <Ionicons name="person" size={24} color="#3b82f6" />
                          </View>
                        )}
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontSize: 15, fontWeight: '600', color: '#1f2937' }}>{member.name}</Text>
                          {member.roles && member.roles.length > 0 && (() => {
                            const roleInfo = getMemberRole(member.roles);
                            if (!roleInfo) return null;
                            return (
                              <View style={{
                                alignSelf: 'flex-start',
                                backgroundColor: roleInfo.bgColor,
                                paddingHorizontal: 8, paddingVertical: 2,
                                borderRadius: 10, marginTop: 4,
                              }}>
                                <Text style={{ fontSize: 11, fontWeight: '700', color: roleInfo.color, textTransform: 'uppercase' }}>
                                  {roleInfo.label}
                                </Text>
                              </View>
                            );
                          })()}
                        </View>
                      </View>
                    ))}
                  </View>
                ) : (
                  <View style={{ paddingVertical: 24, alignItems: 'center' }}>
                    <Text style={{ fontSize: 14, color: '#6b7280' }}>No members found.</Text>
                  </View>
                )}
              </View>
            )}

            {/* ── MEMBER / CREATOR FULL TAB CONTENT ── */}
            {(isMember || isGroupCreator) && activeTab === 'home' && (
              <View style={{ padding: 16, gap: 16 }}>
                {/* Description Card */}
                {group.description?.rendered && getContentText(group.description.rendered).length > 0 && (
                  <View style={{
                    backgroundColor: '#fff',
                    borderRadius: 12,
                    padding: 16,
                    borderWidth: 1,
                    borderColor: '#e5e7eb',
                  }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                      <Ionicons name="information-circle" size={20} color="#2563eb" />
                      <Text style={{ fontSize: 16, fontWeight: '700', color: '#1f2937' }}>
                        Description
                      </Text>
                    </View>
                    <Text style={{ fontSize: 14, color: '#4b5563', lineHeight: 22 }}>
                      {getContentText(group.description.rendered)}
                    </Text>
                  </View>
                )}

                {/* Create Post Section */}
                <View
                  onLayout={(event) => {
                    postComposerOffsetRef.current = event.nativeEvent.layout.y;
                  }}
                  style={{
                    backgroundColor: '#fff',
                    borderRadius: 12,
                    padding: 16,
                    borderWidth: 1,
                    borderColor: '#e5e7eb',
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                    <Ionicons name="create-outline" size={20} color="#2563eb" />
                    <Text style={{ fontSize: 16, fontWeight: '700', color: '#1f2937' }}>
                      Create Post
                    </Text>
                  </View>
                  <TextInput
                    style={{
                      backgroundColor: '#f9fafb',
                      borderWidth: 1,
                      borderColor: '#d1d5db',
                      borderRadius: 8,
                      padding: 12,
                      fontSize: 14,
                      color: '#1f2937',
                      minHeight: 80,
                      textAlignVertical: 'top',
                    }}
                    placeholder="What's on your mind?"
                    placeholderTextColor="#9ca3af"
                    multiline
                    value={newPostContent}
                    onChangeText={setNewPostContent}
                    onFocus={revealPostComposer}
                    editable={!isPostingActivity}
                  />

                  {/* Image Picker Button */}
                  <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
                    <TouchableOpacity
                      onPress={handlePickImage}
                      disabled={isPostingActivity}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 6,
                        paddingHorizontal: 12,
                        paddingVertical: 8,
                        backgroundColor: '#f3f4f6',
                        borderRadius: 8,
                        borderWidth: 1,
                        borderColor: '#e5e7eb',
                      }}
                    >
                      <Ionicons name="image-outline" size={18} color="#0095f6" />
                      <Text style={{ fontSize: 13, color: '#374151', fontWeight: '500' }}>
                        Add Photo
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {/* Selected Images Preview */}
                  {selectedImages.length > 0 && (
                    <ScrollView 
                      horizontal 
                      showsHorizontalScrollIndicator={false}
                      style={{ marginTop: 12, borderTopWidth: 1, borderTopColor: '#e5e7eb', paddingTop: 12 }}
                      contentContainerStyle={{ gap: 8 }}
                    >
                      {selectedImages.map((imageUri, index) => (
                        <View key={index} style={{ position: 'relative' }}>
                          <Image
                            source={{ uri: imageUri }}
                            style={{
                              width: 100,
                              height: 100,
                              borderRadius: 8,
                              backgroundColor: '#f3f4f6',
                            }}
                          />
                          <TouchableOpacity
                            onPress={() => setSelectedImages(prev => prev.filter((_, i) => i !== index))}
                            style={{
                              position: 'absolute',
                              top: 4,
                              right: 4,
                              backgroundColor: '#ff3b30',
                              borderRadius: 12,
                              width: 24,
                              height: 24,
                              justifyContent: 'center',
                              alignItems: 'center',
                              shadowColor: '#000',
                              shadowOffset: { width: 0, height: 2 },
                              shadowOpacity: 0.3,
                              shadowRadius: 3,
                              elevation: 5,
                            }}
                          >
                            <Ionicons name="close" size={16} color="#fff" />
                          </TouchableOpacity>
                        </View>
                      ))}
                    </ScrollView>
                  )}

                  {/* Link Input */}
                  <View style={{ marginTop: 12, borderTopWidth: 1, borderTopColor: '#e5e7eb', paddingTop: 12 }}>
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                        <Ionicons name="link-outline" size={18} color="#6b7280" />
                        <TextInput
                          style={{
                            flex: 1,
                            backgroundColor: '#f9fafb',
                            borderWidth: 1,
                            borderColor: '#d1d5db',
                            borderRadius: 8,
                            padding: 10,
                            fontSize: 14,
                            color: '#1f2937',
                          }}
                          placeholder="Add a link (optional)"
                          placeholderTextColor="#9ca3af"
                          value={postLink}
                          onChangeText={setPostLink}
                          onFocus={revealPostComposer}
                          editable={!isPostingActivity}
                          keyboardType="url"
                          autoCapitalize="none"
                        />
                      </View>
                      {postLink.length > 0 && (
                        <TouchableOpacity
                          onPress={() => setPostLink('')}
                          style={{
                            justifyContent: 'center',
                            alignItems: 'center',
                            width: 36,
                            height: 36,
                            backgroundColor: '#f3f4f6',
                            borderRadius: 8,
                          }}
                        >
                          <Ionicons name="close-circle" size={20} color="#6b7280" />
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>

                  <TouchableOpacity
                    onPress={handleCreatePost}
                    disabled={isPostingActivity || (!newPostContent.trim() && selectedImages.length === 0 && !postLink.trim())}
                    style={{
                      backgroundColor: (!newPostContent.trim() && selectedImages.length === 0 && !postLink.trim() || isPostingActivity) ? '#d1d5db' : '#2563eb',
                      borderRadius: 8,
                      padding: 12,
                      alignItems: 'center',
                      marginTop: 12,
                      flexDirection: 'row',
                      justifyContent: 'center',
                      gap: 8,
                    }}
                  >
                    {isPostingActivity ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Ionicons name="send" size={18} color="#fff" />
                    )}
                    <Text style={{ fontSize: 15, fontWeight: '600', color: '#fff' }}>
                      {isPostingActivity ? 'Posting...' : 'Post'}
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* Activity Feed Section */}
                <View>
                  <Text style={{ fontSize: 18, fontWeight: '700', color: '#1f2937', marginBottom: 12 }}>
                    Recent Activity
                  </Text>

                  {loadingActivity && activities.length === 0 ? (
                    <View style={{ paddingVertical: 20, alignItems: 'center' }}>
                      <ActivityIndicator size="small" color="#2563eb" />
                    </View>
                  ) : activities.length > 0 ? (
                    <View style={{ gap: 12 }}>
                      {activities.map((activity) => (
                        <PostCard
                          key={activity.id}
                          item={activity}
                          token={token}
                          profile={{ user_id: userId }}
                          onLike={handleLikePost}
                          onDelete={handleDeletePost}
                          onEdit={handleOpenEditPost}
                          canModifyOverride={isGroupCreator}
                        />
                      ))}
                      {hasNextActivityPage && (
                        <TouchableOpacity
                          onPress={() => fetchNextActivityPage()}
                          disabled={isFetchingNextActivityPage}
                          style={{
                            paddingVertical: 12,
                            alignItems: 'center',
                            borderRadius: 8,
                            backgroundColor: '#f3f4f6',
                          }}
                        >
                          {isFetchingNextActivityPage ? (
                            <ActivityIndicator size="small" color="#2563eb" />
                          ) : (
                            <Text style={{ color: '#2563eb', fontWeight: '600', fontSize: 14 }}>
                              Load more posts
                            </Text>
                          )}
                        </TouchableOpacity>
                      )}
                    </View>
                  ) : (
                    <View
                      style={{
                        backgroundColor: '#fff',
                        borderRadius: 12,
                        padding: 40,
                        alignItems: 'center',
                        borderWidth: 1,
                        borderColor: '#e5e7eb',
                      }}
                    >
                      <View
                        style={{
                          width: 80,
                          height: 80,
                          borderRadius: 40,
                          backgroundColor: '#f3f4f6',
                          alignItems: 'center',
                          justifyContent: 'center',
                          marginBottom: 16,
                        }}
                      >
                        <Ionicons name="chatbox-outline" size={40} color="#9ca3af" />
                      </View>
                      <Text style={{ fontSize: 18, fontWeight: '600', color: '#1f2937', marginBottom: 8 }}>
                        {activityError ? 'Couldn’t load posts' : 'No Activity Yet'}
                      </Text>
                      <Text style={{ fontSize: 14, color: '#6b7280', textAlign: 'center' }}>
                        {activityError
                          ? (activityError as any)?.message || 'Something went wrong loading this group’s posts.'
                          : 'Be the first to post in this group!'}
                      </Text>
                    </View>
                  )}
                </View>
              </View>
            )}

            {(isMember || isGroupCreator) && activeTab === 'members' && (
              <View style={{ padding: 16 }}>
                {loadingMembers ? (
                  <View style={{ paddingVertical: 40, alignItems: 'center' }}>
                    <ActivityIndicator size="large" color="#2563eb" />
                    <Text style={{ marginTop: 12, color: '#6b7280' }}>Loading members...</Text>
                  </View>
                ) : members && members.length > 0 ? (
                  <View style={{ gap: 12 }}>
                    {members.map((member) => (
                      <View
                        key={member.id}
                        style={{
                          backgroundColor: '#fff',
                          borderRadius: 12,
                          padding: 16,
                          borderWidth: 1,
                          borderColor: '#e5e7eb',
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: 12,
                        }}
                      >
                        {/* Member Avatar */}
                        {member.avatar_urls?.thumb ? (
                          <Image
                            source={{ uri: member.avatar_urls.thumb }}
                            style={{
                              width: 50,
                              height: 50,
                              borderRadius: 25,
                              backgroundColor: '#f3f4f6',
                            }}
                          />
                        ) : (
                          <View
                            style={{
                              width: 50,
                              height: 50,
                              borderRadius: 25,
                              backgroundColor: '#eff6ff',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                          >
                            <Ionicons name="person" size={24} color="#3b82f6" />
                          </View>
                        )}

                        {/* Member Info */}
                        <View style={{ flex: 1 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                            <Text style={{ fontSize: 16, fontWeight: '600', color: '#1f2937' }}>
                              {member.name}
                            </Text>
                            {/* Always show role badge if member has roles */}
                            {member.roles && member.roles.length > 0 && (() => {
                              const roleInfo = getMemberRole(member.roles);
                              if (roleInfo) {
                                return (
                                  <View
                                    style={{
                                      backgroundColor: roleInfo.bgColor,
                                      paddingHorizontal: 10,
                                      paddingVertical: 4,
                                      borderRadius: 14,
                                      borderWidth: 1,
                                      borderColor: roleInfo.color.replace('26', '40'), // Slightly darker border
                                    }}
                                  >
                                    <Text
                                      style={{
                                        fontSize: 12,
                                        fontWeight: '700',
                                        color: roleInfo.color,
                                        textTransform: 'uppercase',
                                        letterSpacing: 0.5,
                                      }}
                                    >
                                      {roleInfo.label}
                                    </Text>
                                  </View>
                                );
                              }
                              // If role exists but not matched, show debug info
                              return (
                                <View
                                  style={{
                                    backgroundColor: '#f3f4f6',
                                    paddingHorizontal: 10,
                                    paddingVertical: 4,
                                    borderRadius: 14,
                                  }}
                                >
                                  <Text
                                    style={{
                                      fontSize: 11,
                                      fontWeight: '600',
                                      color: '#6b7280',
                                    }}
                                  >
                                    {member.roles.join(', ')}
                                  </Text>
                                </View>
                              );
                            })()}
                          </View>
                          {member.mention_name && (
                            <Text style={{ fontSize: 13, color: '#6b7280' }}>@{member.mention_name}</Text>
                          )}
                          {member.registered_date && (
                            <Text style={{ fontSize: 12, color: '#9ca3af', marginTop: 4 }}>
                              Member since {new Date(member.registered_date).toLocaleDateString('en-US', {
                                month: 'short',
                                year: 'numeric',
                              })}
                            </Text>
                          )}
                        </View>

                        {/* Action Button */}
                        <TouchableOpacity
                          style={{
                            padding: 8,
                            borderRadius: 8,
                            backgroundColor: '#f9fafb',
                          }}
                        >
                          <Ionicons name="chevron-forward" size={20} color="#6b7280" />
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>
                ) : (
                  <View
                    style={{
                      backgroundColor: '#fff',
                      borderRadius: 12,
                      padding: 40,
                      alignItems: 'center',
                      borderWidth: 1,
                      borderColor: '#e5e7eb',
                    }}
                  >
                    <View
                      style={{
                        width: 80,
                        height: 80,
                        borderRadius: 40,
                        backgroundColor: '#f3f4f6',
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginBottom: 16,
                      }}
                    >
                      <Ionicons name="people-outline" size={40} color="#9ca3af" />
                    </View>
                    <Text style={{ fontSize: 18, fontWeight: '600', color: '#1f2937', marginBottom: 8 }}>
                      No Members Yet
                    </Text>
                    <Text style={{ fontSize: 14, color: '#6b7280', textAlign: 'center' }}>
                      This group doesn't have any members yet.
                    </Text>
                  </View>
                )}
              </View>
            )}

            {(isMember || isGroupCreator) && activeTab === 'media' && (
              <View style={{ padding: 16 }}>
                <Text style={{ fontSize: 16, fontWeight: '600', color: '#6b7280', textAlign: 'center', paddingVertical: 32 }}>
                  Media gallery coming soon
                </Text>
              </View>
            )}

            {(isMember || isGroupCreator) && activeTab === 'documents' && (
              <View style={{ padding: 16 }}>
                <Text style={{ fontSize: 16, fontWeight: '600', color: '#6b7280', textAlign: 'center', paddingVertical: 32 }}>
                  Documents coming soon
                </Text>
              </View>
            )}

            {/* ── REQUESTS TAB (admin / creator only) ── */}
            {canManageRequests && activeTab === 'requests' && (
              <View style={{ padding: 16, gap: 12 }}>
                {!membershipRequests || membershipRequests.length === 0 ? (
                  <View style={{ paddingVertical: 48, alignItems: 'center' }}>
                    <Ionicons name="checkmark-circle-outline" size={52} color="#9ca3af" />
                    <Text style={{ fontSize: 16, fontWeight: '600', color: '#374151', marginTop: 12 }}>
                      No pending requests
                    </Text>
                    <Text style={{ fontSize: 13, color: '#6b7280', marginTop: 4 }}>
                      All membership requests will appear here.
                    </Text>
                  </View>
                ) : (
                  membershipRequests.map((req) => (
                    <MembershipRequestCard
                      key={req.id}
                      request={req}
                      token={token}
                      groupId={groupId!}
                      acceptMutation={acceptRequestMutation}
                      rejectMutation={rejectRequestMutation}
                    />
                  ))
                )}
              </View>
            )}
          </>
        ) : (
          <View style={{ padding: 40, alignItems: 'center' }}>
            <Text style={{ color: '#ef4444', fontSize: 16 }}>Failed to load group</Text>
          </View>
        )}
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Leave Group Confirmation Modal */}
      <Modal
        visible={showLeaveModal}
        animationType="fade"
        transparent={true}
        onRequestClose={() => {
          if (!leaveGroupMutation.isPending) setShowLeaveModal(false);
        }}
      >
        <View style={{
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.6)',
          justifyContent: 'center',
          alignItems: 'center',
          padding: 24,
        }}>
          <View style={{
            backgroundColor: '#fff',
            borderRadius: 16,
            padding: 24,
            width: '100%',
            maxWidth: 360,
          }}>
            <View style={{ alignItems: 'center', marginBottom: 16 }}>
              <View style={{
                width: 56,
                height: 56,
                borderRadius: 28,
                backgroundColor: '#fee2e2',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                <Ionicons name="exit-outline" size={28} color="#ef4444" />
              </View>
            </View>

            <Text style={{ fontSize: 18, fontWeight: '700', color: '#111827', textAlign: 'center', marginBottom: 8 }}>
              Leave Group
            </Text>
            <Text style={{ fontSize: 14, color: '#6b7280', textAlign: 'center', marginBottom: 24 }}>
              Are you sure you want to leave{'\n'}
              <Text style={{ fontWeight: '600', color: '#374151' }}>{group?.name}</Text>?
            </Text>

            <View style={{ flexDirection: 'row', gap: 12 }}>
              <TouchableOpacity
                onPress={() => {
                  setShowLeaveModal(false);
                }}
                disabled={leaveGroupMutation.isPending}
                style={{
                  flex: 1,
                  backgroundColor: '#f3f4f6',
                  borderRadius: 8,
                  paddingVertical: 14,
                  alignItems: 'center',
                }}
              >
                <Text style={{ fontSize: 15, fontWeight: '600', color: '#6b7280' }}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => {
                  leaveGroupMutation.mutate(
                    { groupId: groupId!, userId: userId! },
                    {
                      onSuccess: (data) => {
                        setShowLeaveModal(false);
                        Alert.alert('Done', 'You have left the group.');
                      },
                      onError: (err: any) => {
                        setShowLeaveModal(false);
                        Alert.alert('Error', err.message || 'Could not leave the group.');
                      },
                    }
                  );
                }}
                disabled={leaveGroupMutation.isPending}
                style={{
                  flex: 1,
                  backgroundColor: '#ef4444',
                  borderRadius: 8,
                  paddingVertical: 14,
                  alignItems: 'center',
                  opacity: leaveGroupMutation.isPending ? 0.6 : 1,
                }}
              >
                {leaveGroupMutation.isPending ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={{ fontSize: 15, fontWeight: '700', color: '#fff' }}>Leave</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

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
    </View>
  );
}

/**
 * Membership Request Card — shown in the Requests tab (admin/creator only)
 */
function MembershipRequestCard({
  request, token, groupId, acceptMutation, rejectMutation,
}: {
  request: { id: number; user_id: number; group_id: number; status: string; date_modified: string };
  token: string | null;
  groupId: number;
  acceptMutation: ReturnType<typeof import('../hooks/useGroups').useAcceptMembershipRequest>;
  rejectMutation: ReturnType<typeof import('../hooks/useGroups').useRejectMembershipRequest>;
}) {
  const { data: member } = useMember(token, request.user_id);
  const avatarUrl = member?.avatar_urls?.thumb || member?.avatar_urls?.full;
  const name = member?.name || 'Loading...';
  const isPending = acceptMutation.isPending || rejectMutation.isPending;

  return (
    <View style={{
      backgroundColor: '#fff', borderRadius: 12, padding: 14,
      borderWidth: 1, borderColor: '#e5e7eb',
      shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 3, elevation: 2,
    }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 }}>
        {avatarUrl ? (
          <Image source={{ uri: avatarUrl }} style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: '#f3f4f6' }} />
        ) : (
          <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: '#eff6ff', alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="person" size={22} color="#3b82f6" />
          </View>
        )}
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 15, fontWeight: '700', color: '#111827' }}>{name}</Text>
          <Text style={{ fontSize: 12, color: '#9ca3af', marginTop: 2 }}>
            Requested {request.date_modified ? new Date(request.date_modified).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : ''}
          </Text>
        </View>
      </View>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <TouchableOpacity
          onPress={() => {
            acceptMutation.mutate(
              { groupId, requestId: request.id },
              {
                onSuccess: () => { Alert.alert('Accepted', `${name} is now a member.`); },
                onError: (err: any) => { Alert.alert('Error', err.message || 'Could not accept.'); },
              }
            );
          }}
          disabled={isPending}
          style={{
            flex: 1, flexDirection: 'row', backgroundColor: '#2563eb',
            borderRadius: 8, paddingVertical: 10, alignItems: 'center', justifyContent: 'center', gap: 6,
            opacity: isPending ? 0.6 : 1,
          }}
        >
          <Ionicons name="checkmark" size={16} color="#fff" />
          <Text style={{ fontSize: 14, fontWeight: '700', color: '#fff' }}>Accept</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => {
            rejectMutation.mutate(
              { groupId, requestId: request.id },
              {
                onSuccess: () => { Alert.alert('Rejected', 'Membership request rejected.'); },
                onError: (err: any) => { Alert.alert('Error', err.message || 'Could not reject.'); },
              }
            );
          }}
          disabled={isPending}
          style={{
            flex: 1, flexDirection: 'row', backgroundColor: '#fff',
            borderWidth: 1.5, borderColor: '#ef4444',
            borderRadius: 8, paddingVertical: 10, alignItems: 'center', justifyContent: 'center', gap: 6,
            opacity: isPending ? 0.6 : 1,
          }}
        >
          <Ionicons name="close" size={16} color="#ef4444" />
          <Text style={{ fontSize: 14, fontWeight: '700', color: '#ef4444' }}>Reject</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

