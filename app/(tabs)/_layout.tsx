// app/(tabs)/_layout.tsx
/**
 * Tab navigator layout with bottom tab navigation
 * Requires authentication to access
 */

import { Tabs, Redirect, router } from 'expo-router';
import { Pressable, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../lib/auth';
import BackButton from '../../components/BackButton';
import { useMe, usePendingFriendRequests, useFriendsList } from '../../hooks/useQueries';
import { useConversations } from '../../hooks/useMessages';
import { TAB_SCREENS, DEFAULT_HEADER_OPTIONS, ROUTES } from '../../constants/navigation';
import { getUnreadMessageNotifications } from '../../lib/messageNotifications';
import type { TabScreen } from '../../types';

/**
 * Notification bell header button component
 */
function NotificationButton() {
  const { token, userId: authUserId } = useAuth();
  const { data: currentUser } = useMe();
  const userId = currentUser?.id ?? authUserId ?? undefined;
  const { data: pendingRequests } = usePendingFriendRequests(userId);
  const { data: friendsData } = useFriendsList(userId, 1, 200);
  const { data: conversationsData } = useConversations(token);

  const currentUserId = Number(userId);
  const friendIds = new Set((friendsData?.friends || []).map((friend) => Number(friend.id)));
  const hasPendingFriendRequests = Boolean(
    userId &&
      (pendingRequests || []).some((request) => {
        const requestFriendId = Number(request.friend_id);
        const requestInitiatorId = Number(request.initiator_id);
        const isConfirmed = request.is_confirmed === true || Number(request.is_confirmed) === 1;
        if (isConfirmed) return false;
        return requestFriendId === currentUserId && !friendIds.has(requestInitiatorId);
      })
  );
  const hasUnreadMessages = getUnreadMessageNotifications(conversationsData, userId).length > 0;
  const hasPendingNotifications = hasPendingFriendRequests || hasUnreadMessages;

  return (
    <Pressable
      onPress={() => router.push(ROUTES.NOTIFICATIONS)}
      hitSlop={8}
      style={{ paddingRight: 12 }}
      accessibilityLabel="Open notifications"
    >
      <View>
        <Ionicons name="notifications-outline" size={24} color="#1f2937" />
        {hasPendingNotifications && (
          <View
            style={{
              position: 'absolute',
              top: -2,
              right: -2,
              width: 8,
              height: 8,
              borderRadius: 4,
              backgroundColor: '#ef4444',
            }}
          />
        )}
      </View>
    </Pressable>
  );
}

export default function TabsLayout() {
  const { ready, token } = useAuth();
  
  // Wait for auth to be ready
  if (!ready) return null;
  
  // Redirect to sign in if not authenticated
  if (!token) return <Redirect href={ROUTES.SIGN_IN} />;

  return (
    <Tabs
      initialRouteName="index"
      screenOptions={{
        ...DEFAULT_HEADER_OPTIONS,
        tabBarActiveTintColor: '#0077b6',
        headerRight: () => <NotificationButton />,
      }}
    >
      {TAB_SCREENS.map((tab) => (
        <Tabs.Screen
          key={tab.name}
          name={tab.name}
          options={{
            title: tab.title,
            tabBarIcon: ({ color, size, focused }) => (
              <Ionicons 
                name={focused ? tab.icon as any : tab.iconOutline as any} 
                color={color} 
                size={size} 
              />
            ),
          }}
        />
      ))}
      <Tabs.Screen
      name="messages/[threadId]"
      options={{
        href: null,
        title: 'Conversation',
        headerLeft: () => (
          <BackButton fallbackRoute={ROUTES.MESSAGES} useHistory={false} />
        ),
      }}
    />
      <Tabs.Screen
      name="messages/new"
      options={{
        href: null,
        title: 'New Message',
        headerLeft: () => (
          <BackButton fallbackRoute={ROUTES.MESSAGES} useHistory={false} />
        ),
      }}
    />
      </Tabs>);
}
