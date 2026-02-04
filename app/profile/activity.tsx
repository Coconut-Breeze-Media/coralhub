// app/profile/activity.tsx
/**
 * Activity Screen
 * Displays all user activities in chronological order (most recent first)
 */

import { View, Text, ScrollView, ActivityIndicator, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useCurrentMember, useUserActivity } from '../../hooks';
import BackButton from '../../components/BackButton';
import { useState } from 'react';

// Activity type labels for better display
const ACTIVITY_TYPE_LABELS: Record<string, string> = {
  'new_avatar': 'Changed profile picture',
  'new_member': 'Joined the community',
  'updated_profile': 'Updated profile',
  'activity_update': 'Posted an update',
  'activity_comment': 'Commented on a post',
  'joined_group': 'Joined a group',
  'created_group': 'Created a group',
  'friendship_created': 'Made a new connection',
  'new_blog_post': 'Published a blog post',
  'new_blog_comment': 'Commented on a blog',
};

// Activity type icons
const ACTIVITY_TYPE_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  'new_avatar': 'image-outline',
  'new_member': 'person-add-outline',
  'updated_profile': 'create-outline',
  'activity_update': 'chatbox-outline',
  'activity_comment': 'chatbubble-outline',
  'joined_group': 'people-outline',
  'created_group': 'add-circle-outline',
  'friendship_created': 'link-outline',
  'new_blog_post': 'document-text-outline',
  'new_blog_comment': 'chatbubbles-outline',
};

export default function ActivityScreen() {
  const { data: member } = useCurrentMember();
  const { data: activities, isLoading, refetch } = useUserActivity(member?.id || 0);
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  const getActivityLabel = (type: string) => {
    return ACTIVITY_TYPE_LABELS[type] || type.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase());
  };

  const getActivityIcon = (type: string): keyof typeof Ionicons.glyphMap => {
    return ACTIVITY_TYPE_ICONS[type] || 'ellipse-outline';
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInMs = now.getTime() - date.getTime();
    const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60));
    const diffInDays = Math.floor(diffInHours / 24);

    if (diffInHours < 1) {
      const diffInMinutes = Math.floor(diffInMs / (1000 * 60));
      return diffInMinutes <= 1 ? 'Just now' : `${diffInMinutes} minutes ago`;
    } else if (diffInHours < 24) {
      return diffInHours === 1 ? '1 hour ago' : `${diffInHours} hours ago`;
    } else if (diffInDays < 7) {
      return diffInDays === 1 ? '1 day ago' : `${diffInDays} days ago`;
    } else {
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    }
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
            Activity
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
            <Text style={{ marginTop: 12, color: '#6b7280' }}>Loading activities...</Text>
          </View>
        ) : activities && activities.length > 0 ? (
          <View style={{ gap: 12 }}>
            {activities.map((activity, index) => (
              <View
                key={activity.id || index}
                style={{
                  backgroundColor: '#fff',
                  borderRadius: 12,
                  padding: 16,
                  borderWidth: 1,
                  borderColor: '#e5e7eb',
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 1 },
                  shadowOpacity: 0.05,
                  shadowRadius: 2,
                  elevation: 1,
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
                  {/* Icon */}
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
                    <Ionicons
                      name={getActivityIcon(activity.type)}
                      size={20}
                      color="#2563eb"
                    />
                  </View>

                  {/* Content */}
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 16, fontWeight: '600', color: '#1f2937', marginBottom: 4 }}>
                      {getActivityLabel(activity.type)}
                    </Text>
                    
                    {activity.content?.rendered && activity.content.rendered.trim() !== '' && (
                      <Text
                        style={{ fontSize: 14, color: '#4b5563', marginBottom: 6, lineHeight: 20 }}
                        numberOfLines={3}
                      >
                        {activity.content.rendered.replace(/<[^>]*>/g, '')}
                      </Text>
                    )}

                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Ionicons name="time-outline" size={14} color="#9ca3af" />
                      <Text style={{ fontSize: 13, color: '#9ca3af' }}>
                        {formatDate(activity.date_recorded || activity.date)}
                      </Text>
                    </View>
                  </View>
                </View>
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
              <Ionicons name="time-outline" size={40} color="#9ca3af" />
            </View>
            <Text style={{ fontSize: 18, fontWeight: '600', color: '#1f2937', marginBottom: 8 }}>
              No Activity Yet
            </Text>
            <Text style={{ fontSize: 14, color: '#6b7280', textAlign: 'center' }}>
              Your activities will appear here once you start interacting with the community.
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}
