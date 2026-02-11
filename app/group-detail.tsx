// app/group-detail.tsx
/**
 * Group Detail Screen
 * Displays detailed information about a group and its activity feed
 */

import { View, Text, ScrollView, ActivityIndicator, RefreshControl, Image, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../lib/auth';
import { useGroup, useGroupActivity, useGroupMembers } from '../hooks/useGroups';
import { useMember } from '../hooks/useMembers';
import BackButton from '../components/BackButton';
import { useState, useEffect } from 'react';
import { useLocalSearchParams } from 'expo-router';

type TabType = 'home' | 'members' | 'media' | 'documents';

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
  const { token } = useAuth();
  const params = useLocalSearchParams();
  const groupId = params.id ? parseInt(params.id as string) : null;
  
  const { data: group, isLoading: loadingGroup, refetch: refetchGroup } = useGroup(token, groupId);
  const { data: activityData, isLoading: loadingActivity, refetch: refetchActivity } = useGroupActivity(token, groupId);
  const { data: members, isLoading: loadingMembers, refetch: refetchMembers } = useGroupMembers(token, groupId);
  
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('home');

  // Log group data when loaded
  useEffect(() => {
    if (group) {
      console.log('========== GROUP INFO ==========');
      console.log('✓ Group ID:', group.id);
      console.log('✓ Group Name:', group.name);
      console.log('✓ Status:', group.status);
      console.log('✓ Description (raw):', group.description?.raw || 'N/A');
      console.log('✓ Total Members:', group.total_member_count);
      console.log('✓ Creator ID:', group.creator_id);
      console.log('✓ Date Created:', group.date_created);
      console.log('✓ Last Activity:', group.last_activity);
      console.log('✓ Last Activity Diff:', group.last_activity_diff);
      console.log('✓ Avatar URLs:', group.avatar_urls);
      console.log('✓ Cover Image:', group.cover_image);
      console.log('✓ Link:', group.link);
      console.log('✓ Slug:', group.slug);
      console.log('✓ Types:', group.types);
      console.log('================================');
    }
  }, [group]);

  // Log activity data when loaded
  useEffect(() => {
    if (activityData) {
      console.log('========== GROUP ACTIVITY ==========');
      console.log('📊 Total Activities:', activityData.total);
      console.log('📄 Total Pages:', activityData.pages);
      console.log('📝 Activities Count:', activityData.activities?.length || 0);
      if (activityData.activities && activityData.activities.length > 0) {
        console.log('🔍 First Activity:');
        const first = activityData.activities[0];
        console.log('   - Type:', first.type);
        console.log('   - User ID:', first.user_id);
        console.log('   - Component:', first.component);
        console.log('   - Date:', first.date);
        console.log('   - Title:', first.title);
        console.log('   - Content:', first.content);
        console.log('   - Full Data:', first);
      } else {
        console.log('⚠️ No activities found for this group');
      }
      console.log('====================================');
    }
  }, [activityData]);

  // Log members data
  useEffect(() => {
    if (members) {
      console.log('========== GROUP MEMBERS ==========');
      console.log('👥 Total Members Received:', members.length);
      console.log('👥 Group Member Count:', group?.total_member_count);
      members.forEach((member, index) => {
        console.log(`\n📋 Member ${index + 1}:`);
        console.log('   - Name:', member.name);
        console.log('   - ID:', member.id);
        console.log('   - Roles:', member.roles);
        console.log('   - Has roles array:', Array.isArray(member.roles));
        console.log('   - Role detection:', getMemberRole(member.roles));
      });
      console.log('\n📝 Full Members Data:', JSON.stringify(members, null, 2));
      console.log('====================================');
    }
  }, [members, group?.total_member_count]);

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([refetchGroup(), refetchActivity(), refetchMembers()]);
    setRefreshing(false);
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

      <ScrollView
        contentContainerStyle={{ paddingBottom: 20 }}
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
              
              {/* Additional Info */}
              {group.last_activity_diff && (
                <View style={{ marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.1)' }}>
                  <Text style={{ fontSize: 12, color: '#94a3b8', textAlign: 'center' }}>
                    Last activity: {group.last_activity_diff}
                  </Text>
                </View>
              )}
            </View>

            {/* Tab Navigation */}
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
              </ScrollView>
            </View>

            {/* Tab Content */}
            {activeTab === 'home' && (
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
                        <ActivityCard key={activity.id} activity={activity} token={token} />
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

            {activeTab === 'members' && (
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

            {activeTab === 'media' && (
              <View style={{ padding: 16 }}>
                <Text style={{ fontSize: 16, fontWeight: '600', color: '#6b7280', textAlign: 'center', paddingVertical: 32 }}>
                  Media gallery coming soon
                </Text>
              </View>
            )}

            {activeTab === 'documents' && (
              <View style={{ padding: 16 }}>
                <Text style={{ fontSize: 16, fontWeight: '600', color: '#6b7280', textAlign: 'center', paddingVertical: 32 }}>
                  Documents coming soon
                </Text>
              </View>
            )}
          </>
        ) : (
          <View style={{ padding: 40, alignItems: 'center' }}>
            <Text style={{ color: '#ef4444', fontSize: 16 }}>Failed to load group</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

/**
 * Activity Card Component
 */
function ActivityCard({ activity, token }: { activity: any; token: string | null }) {
  const userId = activity.user_id;
  const { data: member } = useMember(token, userId);

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

  const activityInfo = getActivityInfo(activity.type);
  const content = getContentText(activity.content);
  
  // Extract text from title if content is empty
  const displayText = content || (activity.title ? getContentText(activity.title) : '');

  return (
    <View
      style={{
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 16,
        borderWidth: 1,
        borderColor: '#e5e7eb',
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
          {/* User name and time */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <Text style={{ fontSize: 15, fontWeight: '600', color: '#1f2937' }}>
              {member?.name || 'Loading...'}
            </Text>
            <Text style={{ fontSize: 13, color: '#9ca3af' }}>
              {formatDate(activity.date)}
            </Text>
          </View>

          {/* Activity type */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 }}>
            <Ionicons name={activityInfo.icon} size={14} color={activityInfo.color} />
            <Text style={{ fontSize: 13, color: activityInfo.color, fontWeight: '600' }}>
              {activityInfo.label}
            </Text>
          </View>

          {/* Content text */}
          {content && (
            <Text style={{ fontSize: 14, color: '#4b5563', lineHeight: 20 }}>
              {content}
            </Text>
          )}

          {/* Engagement Stats */}
          {(activity.favorite_count > 0 || activity.comment_count > 0) && (
            <View style={{ flexDirection: 'row', gap: 16, marginTop: 12 }}>
              {activity.favorite_count > 0 && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <Ionicons name="heart" size={16} color="#ef4444" />
                  <Text style={{ fontSize: 13, color: '#6b7280' }}>
                    {activity.favorite_count}
                  </Text>
                </View>
              )}
              {activity.comment_count > 0 && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <Ionicons name="chatbubble" size={16} color="#3b82f6" />
                  <Text style={{ fontSize: 13, color: '#6b7280' }}>
                    {activity.comment_count}
                  </Text>
                </View>
              )}
            </View>
          )}
        </View>
      </View>
    </View>
  );
}
