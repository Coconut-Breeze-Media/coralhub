// app/(tabs)/_layout.tsx
/**
 * Tab navigator layout with bottom tab navigation
 * Requires authentication to access
 */

import { Tabs, Redirect, router } from 'expo-router';
import { Pressable, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../lib/auth';
import { TAB_SCREENS, DEFAULT_HEADER_OPTIONS, ROUTES } from '../../constants/navigation';
import type { TabScreen } from '../../types';

/**
 * Notification bell header button component
 */
function NotificationButton() {
  return (
    <Pressable
      onPress={() => router.push(ROUTES.NOTIFICATIONS)}
      hitSlop={8}
      style={{ paddingRight: 12 }}
      accessibilityLabel="Open notifications"
    >
      <View>
        <Ionicons name="notifications-outline" size={24} color="#1f2937" />
        {/* Notification badge indicator */}
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
    </Tabs>
  );
}