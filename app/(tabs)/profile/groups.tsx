// app/profile/groups.tsx
/**
 * Groups Screen
 * Displays all groups the current user is a member of
 */

import { View, Text, ScrollView, ActivityIndicator, RefreshControl, Image, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useAuth } from '../../lib/auth';
import { useMyGroups } from '../../hooks/useGroups';
import BackButton from '../../components/BackButton';
import { useState } from 'react';

// Group status badge colors
const STATUS_COLORS: Record<string, { bg: string; text: string; icon: string }> = {
  public: { bg: '#dcfce7', text: '#15803d', icon: 'earth-outline' },
  private: { bg: '#fef3c7', text: '#a16207', icon: 'lock-closed-outline' },
  hidden: { bg: '#f3f4f6', text: '#4b5563', icon: 'eye-off-outline' },
};

export default function GroupsScreen() {
  const { token } = useAuth();
  const { data: groups, isLoading, refetch } = useMyGroups(token);
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  const formatMemberCount = (count: number) => {
    if (count === 1) return '1 member';
    return `${count} members`;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const getStatusConfig = (status: string) => {
    return STATUS_COLORS[status] || STATUS_COLORS.public;
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#f9fafb' }}>
      {/* Header */}
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
          <Text style={{ fontSize: 20, fontWeight: '700', color: '#1f2937', flex: 1 }}>
            My Groups
          </Text>
        </View>
      </View>

      {/* Content */}
      <ScrollView
        contentContainerStyle={{ padding: 16 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#2563eb']} />
        }
      >
        {isLoading ? (
          <View style={{ paddingVertical: 40, alignItems: 'center' }}>
            <ActivityIndicator size="large" color="#2563eb" />
            <Text style={{ marginTop: 12, color: '#6b7280' }}>Loading groups...</Text>
          </View>
        ) : groups && groups.length > 0 ? (
          <View style={{ gap: 12 }}>
            {groups.map((group) => (
              <TouchableOpacity
                key={group.id}
                activeOpacity={0.7}
                onPress={() => router.push(`/group-detail?id=${group.id}`)}
                style={{
                  backgroundColor: '#fff',
                  borderRadius: 12,
                  overflow: 'hidden',
                  borderWidth: 1,
                  borderColor: '#e5e7eb',
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 1 },
                  shadowOpacity: 0.05,
                  shadowRadius: 2,
                  elevation: 1,
                }}
              >
                {/* Group Avatar/Cover */}
                {group.avatar_urls?.full || group.cover_image ? (
                  <Image
                    source={{ uri: group.cover_image || group.avatar_urls?.full || '' }}
                    style={{
                      width: '100%',
                      height: 120,
                      backgroundColor: '#f3f4f6',
                    }}
                    resizeMode="cover"
                  />
                ) : (
                  <View
                    style={{
                      width: '100%',
                      height: 120,
                      backgroundColor: '#eff6ff',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Ionicons name="people" size={48} color="#3b82f6" />
                  </View>
                )}

                {/* Group Info */}
                <View style={{ padding: 16 }}>
                  {/* Name and Status Badge */}
                  <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 8 }}>
                    <Text
                      style={{
                        flex: 1,
                        fontSize: 18,
                        fontWeight: '700',
                        color: '#1f2937',
                        lineHeight: 24,
                      }}
                    >
                      {group.name}
                    </Text>
                    <View
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 4,
                        paddingHorizontal: 8,
                        paddingVertical: 4,
                        borderRadius: 8,
                        backgroundColor: getStatusConfig(group.status).bg,
                      }}
                    >
                      <Ionicons
                        name={getStatusConfig(group.status).icon as any}
                        size={12}
                        color={getStatusConfig(group.status).text}
                      />
                      <Text
                        style={{
                          fontSize: 12,
                          fontWeight: '600',
                          color: getStatusConfig(group.status).text,
                          textTransform: 'capitalize',
                        }}
                      >
                        {group.status}
                      </Text>
                    </View>
                  </View>

                  {/* Description */}
                  {group.description?.rendered && (
                    <Text
                      style={{
                        fontSize: 14,
                        color: '#6b7280',
                        lineHeight: 20,
                        marginBottom: 12,
                      }}
                      numberOfLines={2}
                    >
                      {group.description.rendered.replace(/<[^>]*>/g, '')}
                    </Text>
                  )}

                  {/* Meta Information */}
                  <View style={{ gap: 8 }}>
                    {/* Member Count */}
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Ionicons name="people-outline" size={16} color="#6b7280" />
                      <Text style={{ fontSize: 14, color: '#6b7280' }}>
                        {formatMemberCount(group.total_member_count)}
                      </Text>
                    </View>

                    {/* Last Activity */}
                    {group.last_activity && (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Ionicons name="time-outline" size={16} color="#6b7280" />
                        <Text style={{ fontSize: 14, color: '#6b7280' }}>
                          Active {group.last_activity_diff || formatDate(group.last_activity)}
                        </Text>
                      </View>
                    )}

                    {/* Created Date */}
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Ionicons name="calendar-outline" size={16} color="#6b7280" />
                      <Text style={{ fontSize: 14, color: '#6b7280' }}>
                        Created {formatDate(group.date_created)}
                      </Text>
                    </View>
                  </View>

                  {/* Admin Badge */}
                  {group.admins && group.admins.length > 0 && group.admins.some(admin => admin.is_admin) && (
                    <View
                      style={{
                        marginTop: 12,
                        paddingTop: 12,
                        borderTopWidth: 1,
                        borderTopColor: '#e5e7eb',
                      }}
                    >
                      <View
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: 6,
                        }}
                      >
                        <Ionicons name="shield-checkmark" size={16} color="#2563eb" />
                        <Text style={{ fontSize: 13, fontWeight: '600', color: '#2563eb' }}>
                          Admin
                        </Text>
                      </View>
                    </View>
                  )}
                </View>
              </TouchableOpacity>
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
              No Groups Yet
            </Text>
            <Text style={{ fontSize: 14, color: '#6b7280', textAlign: 'center' }}>
              You haven't joined any groups yet. Join groups to connect with other members!
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}
