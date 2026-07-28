// app/group-detail.tsx
/**
 * Group Detail Screen
 * Displays detailed information about a group and its activity feed
 */

import { View, Text, ScrollView, ActivityIndicator, RefreshControl, Image, TouchableOpacity, TextInput, Alert, Modal, Linking, KeyboardAvoidingView, Platform } from 'react-native';
import CommentsModal from '../components/CommentsModal';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../lib/auth';
import { uploadImage } from '../lib/api';
import {
  useGroup, useGroupActivity, useGroupMembers,
  useJoinGroup, useLeaveGroup,
  useRequestMembership, useMyMembershipRequest,
  useGroupMembershipRequests, useAcceptMembershipRequest, useRejectMembershipRequest,
} from '../hooks/useGroups';
import { useMember } from '../hooks/useMembers';
import { useCreateGroupPost, useLikePost, useUpdatePost, useDeletePost } from '../hooks/useActivity';
import ShareButton from '../components/ShareButton';
import BackButton from '../components/BackButton';
import { useState, useEffect, useRef } from 'react';
import { useLocalSearchParams } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';

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

// Helper function to extract image URLs from HTML content
const extractImageUrls = (htmlContent: string): string[] => {
  const imgRegex = /<img[^>]+src="([^">]+)"/g;
  const urls: string[] = [];
  let match;
  while ((match = imgRegex.exec(htmlContent)) !== null) {
    urls.push(match[1]);
  }
  return urls;
};

// Helper function to extract links from HTML content
const extractLinks = (htmlContent: string): Array<{ url: string; text: string }> => {
  const linkRegex = /<a[^>]+href="([^">]+)"[^>]*>([^<]+)<\/a>/g;
  const links: Array<{ url: string; text: string }> = [];
  let match;
  while ((match = linkRegex.exec(htmlContent)) !== null) {
    links.push({ url: match[1], text: match[2] });
  }
  return links;
};

export default function GroupDetailScreen() {
  const { token, userId } = useAuth();
  const params = useLocalSearchParams();
  const groupId = params.id ? parseInt(params.id as string) : null;
  
  const { data: group, isLoading: loadingGroup, refetch: refetchGroup } = useGroup(token, groupId);
  const { data: activityData, isLoading: loadingActivity, refetch: refetchActivity } = useGroupActivity(token, groupId);
  const { data: members, isLoading: loadingMembers, error: membersError, refetch: refetchMembers } = useGroupMembers(token, groupId);
  // 403 = private group, non-member — API intentionally denies access. Treat as "not a member, done loading".
  const membersAccessDenied = !!(membersError && (membersError as any)?.status === 403);
  const membersDoneLoading = !loadingMembers || membersAccessDenied;
  
  const createGroupPostMutation = useCreateGroupPost(token);
  const joinGroupMutation = useJoinGroup(token);
  const leaveGroupMutation = useLeaveGroup(token);
  const requestMembershipMutation = useRequestMembership(token);
  const acceptRequestMutation = useAcceptMembershipRequest(token);
  const rejectRequestMutation = useRejectMembershipRequest(token);

  const isMember = !!(userId && members?.some((m) => m.id === userId));
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
  const contentScrollRef = useRef<ScrollView | null>(null);
  const postComposerOffsetRef = useRef(0);

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

  const getContentText = (content: string | { rendered: string; raw?: string }): string => {
    let text = '';
    if (typeof content === 'string') {
      text = content;
    } else {
      text = content.rendered || content.raw || '';
    }
    return text.replace(/<[^>]+>/g, '').trim();
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

  const activities = activityData?.activities || [];
  
  // Calculate real post count - only activity_update and activity_comment are actual posts
  // Exclude system activities like joined_group, created_group, new_member, etc.
  const POST_TYPES = ['activity_update', 'activity_comment'];
  const postsCount = activities.filter(activity => POST_TYPES.includes(activity.type)).length;
  
  const isLoading = loadingGroup || loadingActivity;

  const revealPostComposer = () => {
    requestAnimationFrame(() => {
      contentScrollRef.current?.scrollTo({
        y: Math.max(0, postComposerOffsetRef.current - 120),
        animated: true,
      });
    });
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
                  <Text style={{ fontSize: 24, fontWeight: '700', color: '#fff' }}>
                    {postsCount}
                  </Text>
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
                        <ActivityCard 
                          key={activity.id} 
                          activity={activity} 
                          token={token}
                          currentUserId={userId}
                          groupCreatorId={group?.creator_id}
                          onActivityUpdate={refetchActivity}
                        />
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
                        <Ionicons name="chatbox-outline" size={40} color="#9ca3af" />
                      </View>
                      <Text style={{ fontSize: 18, fontWeight: '600', color: '#1f2937', marginBottom: 8 }}>
                        No Activity Yet
                      </Text>
                      <Text style={{ fontSize: 14, color: '#6b7280', textAlign: 'center' }}>
                        Be the first to post in this group!
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

/**
 * Activity Card Component
 */
function ActivityCard({ 
  activity, 
  token, 
  currentUserId,
  groupCreatorId,
  onActivityUpdate 
}: { 
  activity: any; 
  token: string | null;
  currentUserId?: number | null;
  groupCreatorId?: number;
  onActivityUpdate: () => void;
}) {
  const userId = activity.user_id;
  const { data: member } = useMember(token, userId);
  const likePostMutation = useLikePost(token);
  const updatePostMutation = useUpdatePost(token);
  const deletePostMutation = useDeletePost(token);
  
  const [isLiked, setIsLiked] = useState(activity.favorited || false);
  const [likeCount, setLikeCount] = useState(activity.favorite_count || 0);
  const [commentModalVisible, setCommentModalVisible] = useState(false);
  const [isEditModalVisible, setIsEditModalVisible] = useState(false);
  const [isDeleteModalVisible, setIsDeleteModalVisible] = useState(false);
  const [editContent, setEditContent] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [imageModalVisible, setImageModalVisible] = useState(false);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);

  // Check if this is an interactive post (not a system activity)
  // Only activity_update types can be liked, commented, edited, or deleted
  const isInteractivePost = activity.type === 'activity_update';

  // Check if current user can edit/delete this post
  // User can edit/delete if they are the post creator OR the group creator/admin
  // AND it's an interactive post
  // Use Number() to ensure type-safe comparison
  const isPostCreator = currentUserId && activity.user_id && Number(currentUserId) === Number(activity.user_id);
  const isGroupCreator = currentUserId && groupCreatorId && Number(currentUserId) === Number(groupCreatorId);
  const canModify = isInteractivePost && (isPostCreator || isGroupCreator);

  const getContentText = (content: string | { rendered: string; raw?: string }): string => {
    let text = '';
    if (typeof content === 'string') {
      text = content;
    } else {
      text = content.rendered || content.raw || '';
    }
    return text.replace(/<[^>]+>/g, '').trim();
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInMs = now.getTime() - date.getTime();
    const diffInMinutes = Math.floor(diffInMs / (1000 * 60));
    const diffInHours = Math.floor(diffInMinutes / 60);
    const diffInDays = Math.floor(diffInHours / 24);

    if (diffInMinutes < 1) return 'Just now';
    if (diffInMinutes < 60) return `${diffInMinutes}m`;
    if (diffInHours < 24) return `${diffInHours}h`;
    if (diffInDays < 7) return `${diffInDays}d`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  // Activity type labels and icons
  const getActivityInfo = (type: string) => {
    const types: Record<string, { label: string; icon: keyof typeof Ionicons.glyphMap; color: string }> = {
      'joined_group': { label: 'joined the group', icon: 'person-add', color: '#10b981' },
      'created_group': { label: 'created the group', icon: 'add-circle', color: '#3b82f6' },
      'activity_update': { label: 'posted an update', icon: 'chatbox', color: '#6366f1' },
      'activity_comment': { label: 'commented', icon: 'chatbubble', color: '#8b5cf6' },
      'new_member': { label: 'became a member', icon: 'person-add', color: '#10b981' },
      'new_avatar': { label: 'changed profile picture', icon: 'image', color: '#ec4899' },
      'friendship_created': { label: 'made a connection', icon: 'link', color: '#f59e0b' },
    };
    return types[type] || { label: 'posted', icon: 'chatbox-outline' as keyof typeof Ionicons.glyphMap, color: '#6b7280' };
  };

  const handleLike = async () => {
    try {
      const newLikedState = !isLiked;
      setIsLiked(newLikedState);
      setLikeCount(newLikedState ? likeCount + 1 : Math.max(0, likeCount - 1));
      
      await likePostMutation.mutateAsync({
        activityId: activity.id,
        isLiked: isLiked,
      });
    } catch (error) {
      // Revert on error
      setIsLiked(!isLiked);
      setLikeCount(activity.favorite_count || 0);
      Alert.alert('Error', 'Failed to update like status');
    }
  };

  const handleEdit = () => {
    setEditContent(getContentText(activity.content));
    setIsEditModalVisible(true);
  };

  const handleSaveEdit = async () => {
    if (!editContent.trim()) {
      Alert.alert('Error', 'Post content cannot be empty');
      return;
    }

    try {
      setIsUpdating(true);
      await updatePostMutation.mutateAsync({
        activityId: activity.id,
        content: editContent.trim(),
        component: activity.component,
        primary_item_id: activity.primary_item_id,
      });
      setIsEditModalVisible(false);
      onActivityUpdate();
      Alert.alert('Success', 'Post updated successfully!');
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to update post');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDelete = () => {
    setIsDeleteModalVisible(true);
  };

  const confirmDelete = async () => {
    try {
      setIsDeleting(true);
      await deletePostMutation.mutateAsync(activity.id);
      setIsDeleteModalVisible(false);
      onActivityUpdate();
      Alert.alert('Success', 'Post deleted successfully!');
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to delete post');
      setIsDeleteModalVisible(false);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleComment = () => {
    setCommentModalVisible(true);
  };

  const activityInfo = getActivityInfo(activity.type);
  const content = getContentText(activity.content);
  
  // Extract text from title if content is empty
  const displayText = content || (activity.title ? getContentText(activity.title) : '');

  // Extract images and links from HTML content
  const htmlContent = typeof activity.content === 'string' ? activity.content : (activity.content.rendered || '');
  const imageUrls = extractImageUrls(htmlContent);
  const links = extractLinks(htmlContent);

  // Filter out image URLs from links (images already shown separately)
  const textLinks = links.filter(link => !link.url.match(/\.(jpg|jpeg|png|gif|webp)$/i));

  return (
    <>
      <View
        style={{
          backgroundColor: '#fff',
          borderRadius: 12,
          padding: 16,
          borderWidth: 1,
          borderColor: '#e5e7eb',
          opacity: isDeleting ? 0.5 : 1,
        }}
      >
        <View style={{ flexDirection: 'row', gap: 12 }}>
          {/* User Avatar */}
          {member?.avatar_urls?.thumb ? (
            <Image
              source={{ uri: member.avatar_urls.thumb }}
              style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                backgroundColor: '#f3f4f6',
              }}
            />
          ) : (
            <View
              style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                backgroundColor: '#eff6ff',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Ionicons name="person" size={20} color="#3b82f6" />
            </View>
          )}

          {/* Content */}
          <View style={{ flex: 1 }}>
            {/* User name, time, and actions */}
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Text style={{ fontSize: 15, fontWeight: '600', color: '#1f2937' }}>
                  {member?.name || 'Loading...'}
                </Text>
                <Text style={{ fontSize: 13, color: '#9ca3af' }}>
                  {formatDate(activity.date)}
                </Text>
              </View>
              {canModify && (
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <TouchableOpacity onPress={handleEdit} style={{ padding: 4 }}>
                    <Ionicons name="pencil" size={18} color="#6b7280" />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={handleDelete} style={{ padding: 4 }} disabled={isDeleting}>
                    <Ionicons name="trash" size={18} color="#ef4444" />
                  </TouchableOpacity>
                </View>
              )}
            </View>

            {/* Activity type */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 }}>
              <Ionicons name={activityInfo.icon} size={14} color={activityInfo.color} />
              <Text style={{ fontSize: 13, color: activityInfo.color, fontWeight: '600' }}>
                {activityInfo.label}
              </Text>
            </View>

            {/* Content text */}
            {displayText && (
              <Text style={{ fontSize: 14, color: '#4b5563', lineHeight: 20, marginBottom: imageUrls.length > 0 || textLinks.length > 0 ? 12 : 0 }}>
                {displayText}
              </Text>
            )}

            {/* Post Images */}
            {imageUrls.length > 0 && (
              <View style={{ marginBottom: textLinks.length > 0 ? 12 : 0 }}>
                <ScrollView 
                  horizontal 
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ gap: 8 }}
                >
                  {imageUrls.map((url, index) => (
                    <TouchableOpacity 
                      key={index}
                      onPress={() => {
                        setSelectedImageIndex(index);
                        setImageModalVisible(true);
                      }}
                    >
                      <Image
                        source={{ uri: url }}
                        style={{
                          width: imageUrls.length === 1 ? 280 : 200,
                          minHeight: 200,
                          maxHeight: 400,
                          borderRadius: 8,
                          backgroundColor: '#f3f4f6',
                        }}
                        resizeMode="contain"
                      />
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}

            {/* Post Links */}
            {textLinks.length > 0 && (
              <View style={{ gap: 6, marginBottom: 12 }}>
                {textLinks.map((link, index) => (
                  <TouchableOpacity
                    key={index}
                    onPress={() => Linking.openURL(link.url)}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 8,
                      padding: 10,
                      backgroundColor: '#eff6ff',
                      borderRadius: 8,
                      borderWidth: 1,
                      borderColor: '#bfdbfe',
                    }}
                  >
                    <Ionicons name="link" size={16} color="#0095f6" />
                    <Text
                      style={{
                        flex: 1,
                        fontSize: 13,
                        color: '#0095f6',
                        fontWeight: '500',
                      }}
                      numberOfLines={1}
                    >
                      {link.text || link.url}
                    </Text>
                    <Ionicons name="open-outline" size={14} color="#0095f6" />
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* Action Buttons - Only show for interactive posts */}
            {isInteractivePost && (
              <View style={{ flexDirection: 'row', gap: 16, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#f3f4f6' }}>
                {/* Like Button */}
                <TouchableOpacity
                  onPress={handleLike}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}
                >
                  <Ionicons 
                    name={isLiked ? "heart" : "heart-outline"} 
                    size={20} 
                    color={isLiked ? "#ef4444" : "#6b7280"} 
                  />
                  <Text style={{ fontSize: 14, color: isLiked ? "#ef4444" : "#6b7280", fontWeight: '600' }}>
                    {likeCount > 0 ? likeCount : 'Like'}
                  </Text>
                </TouchableOpacity>

                {/* Comment Button */}
                <TouchableOpacity
                  onPress={handleComment}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}
                >
                  <Ionicons name="chatbubble-outline" size={18} color="#6b7280" />
                  <Text style={{ fontSize: 14, color: '#6b7280', fontWeight: '600' }}>
                    {activity.comment_count > 0 ? activity.comment_count : 'Comment'}
                  </Text>
                </TouchableOpacity>

                <ShareButton
                  activityId={activity.id}
                  postUrl={activity.link}
                  previewAuthorName={member?.name || 'User'}
                  previewAuthorAvatarUrl={member?.avatar_urls?.thumb}
                  previewTimeLabel={formatDate(activity.date)}
                  previewText={displayText}
                  previewImageUrl={imageUrls[0]}
                  previewLinkUrl={textLinks[0]?.url || activity.link}
                />
              </View>
            )}
          </View>
        </View>
      </View>

      {/* Comments Modal */}
      <CommentsModal
        visible={commentModalVisible}
        onClose={() => setCommentModalVisible(false)}
        postId={activity.id}
        token={token}
        currentUserId={currentUserId}
      />

      {/* Edit Modal */}
      <Modal
        visible={isEditModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setIsEditModalVisible(false)}
      >
        <View style={{ 
          flex: 1, 
          backgroundColor: 'rgba(0, 0, 0, 0.5)', 
          justifyContent: 'center', 
          padding: 20 
        }}>
          <View style={{ 
            backgroundColor: '#fff', 
            borderRadius: 16, 
            padding: 20,
            maxHeight: '80%',
          }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <Text style={{ fontSize: 18, fontWeight: '700', color: '#1f2937' }}>
                Edit Post
              </Text>
              <TouchableOpacity onPress={() => setIsEditModalVisible(false)}>
                <Ionicons name="close" size={24} color="#6b7280" />
              </TouchableOpacity>
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
                minHeight: 120,
                textAlignVertical: 'top',
                marginBottom: 16,
              }}
              placeholder="Edit your post..."
              placeholderTextColor="#9ca3af"
              multiline
              value={editContent}
              onChangeText={setEditContent}
              editable={!isUpdating}
            />
            
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <TouchableOpacity
                onPress={() => setIsEditModalVisible(false)}
                style={{
                  flex: 1,
                  backgroundColor: '#f3f4f6',
                  borderRadius: 8,
                  padding: 12,
                  alignItems: 'center',
                }}
                disabled={isUpdating}
              >
                <Text style={{ fontSize: 15, fontWeight: '600', color: '#6b7280' }}>
                  Cancel
                </Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                onPress={handleSaveEdit}
                disabled={isUpdating || !editContent.trim()}
                style={{
                  flex: 1,
                  backgroundColor: (!editContent.trim() || isUpdating) ? '#d1d5db' : '#2563eb',
                  borderRadius: 8,
                  padding: 12,
                  alignItems: 'center',
                  flexDirection: 'row',
                  justifyContent: 'center',
                  gap: 8,
                }}
              >
                {isUpdating && <ActivityIndicator size="small" color="#fff" />}
                <Text style={{ fontSize: 15, fontWeight: '600', color: '#fff' }}>
                  {isUpdating ? 'Saving...' : 'Save'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        visible={isDeleteModalVisible}
        animationType="fade"
        transparent={true}
        onRequestClose={() => !isDeleting && setIsDeleteModalVisible(false)}
      >
        <View style={{ 
          flex: 1, 
          backgroundColor: 'rgba(0, 0, 0, 0.6)', 
          justifyContent: 'center', 
          alignItems: 'center',
          padding: 20 
        }}>
          <View style={{ 
            backgroundColor: '#fff', 
            borderRadius: 16, 
            padding: 24,
            width: '100%',
            maxWidth: 400,
          }}>
            {/* Warning Icon */}
            <View style={{
              width: 56,
              height: 56,
              borderRadius: 28,
              backgroundColor: '#fee2e2',
              alignItems: 'center',
              justifyContent: 'center',
              alignSelf: 'center',
              marginBottom: 16,
            }}>
              <Ionicons name="warning" size={32} color="#dc2626" />
            </View>

            {/* Title */}
            <Text style={{ 
              fontSize: 20, 
              fontWeight: '700', 
              color: '#1f2937',
              textAlign: 'center',
              marginBottom: 8,
            }}>
              Delete Post?
            </Text>

            {/* Description */}
            <Text style={{ 
              fontSize: 14, 
              color: '#6b7280',
              textAlign: 'center',
              lineHeight: 20,
              marginBottom: 24,
            }}>
              Are you sure you want to delete this post? This action cannot be undone and the post will be permanently removed.
            </Text>
            
            {/* Buttons */}
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <TouchableOpacity
                onPress={() => setIsDeleteModalVisible(false)}
                style={{
                  flex: 1,
                  backgroundColor: '#f3f4f6',
                  borderRadius: 8,
                  padding: 14,
                  alignItems: 'center',
                }}
                disabled={isDeleting}
              >
                <Text style={{ fontSize: 15, fontWeight: '600', color: '#6b7280' }}>
                  Cancel
                </Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                onPress={confirmDelete}
                disabled={isDeleting}
                style={{
                  flex: 1,
                  backgroundColor: isDeleting ? '#fca5a5' : '#dc2626',
                  borderRadius: 8,
                  padding: 14,
                  alignItems: 'center',
                  flexDirection: 'row',
                  justifyContent: 'center',
                  gap: 8,
                }}
              >
                {isDeleting ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Ionicons name="trash" size={18} color="#fff" />
                )}
                <Text style={{ fontSize: 15, fontWeight: '600', color: '#fff' }}>
                  {isDeleting ? 'Deleting...' : 'Delete'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Image Modal */}
      <Modal
        visible={imageModalVisible}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setImageModalVisible(false)}
      >
        <View style={{ 
          flex: 1, 
          backgroundColor: 'rgba(0, 0, 0, 0.95)',
          justifyContent: 'center',
          alignItems: 'center',
        }}>
          {/* Header */}
          <View style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: 16,
            paddingTop: 48,
            zIndex: 10,
          }}>
            <Text style={{ color: '#fff', fontSize: 16, fontWeight: '600' }}>
              {selectedImageIndex + 1} / {imageUrls.length}
            </Text>
            <TouchableOpacity
              onPress={() => setImageModalVisible(false)}
              style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                backgroundColor: 'rgba(0, 0, 0, 0.6)',
                justifyContent: 'center',
                alignItems: 'center',
              }}
            >
              <Ionicons name="close" size={24} color="#fff" />
            </TouchableOpacity>
          </View>

          {/* Image */}
          <Image
            source={{ uri: imageUrls[selectedImageIndex] }}
            style={{
              width: '100%',
              height: '70%',
            }}
            resizeMode="contain"
          />

          {/* Navigation Buttons */}
          {imageUrls.length > 1 && (
            <>
              {selectedImageIndex > 0 && (
                <TouchableOpacity
                  onPress={() => setSelectedImageIndex(prev => prev - 1)}
                  style={{
                    position: 'absolute',
                    left: 16,
                    width: 48,
                    height: 48,
                    borderRadius: 24,
                    backgroundColor: 'rgba(0, 0, 0, 0.6)',
                    justifyContent: 'center',
                    alignItems: 'center',
                  }}
                >
                  <Ionicons name="chevron-back" size={28} color="#fff" />
                </TouchableOpacity>
              )}
              
              {selectedImageIndex < imageUrls.length - 1 && (
                <TouchableOpacity
                  onPress={() => setSelectedImageIndex(prev => prev + 1)}
                  style={{
                    position: 'absolute',
                    right: 16,
                    width: 48,
                    height: 48,
                    borderRadius: 24,
                    backgroundColor: 'rgba(0, 0, 0, 0.6)',
                    justifyContent: 'center',
                    alignItems: 'center',
                  }}
                >
                  <Ionicons name="chevron-forward" size={28} color="#fff" />
                </TouchableOpacity>
              )}
            </>
          )}
        </View>
      </Modal>

    </>
  );
}
