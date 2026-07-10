// app/_layout.tsx
/**
 * Root layout component for the application
 * Sets up the navigation stack and authentication provider
 */

import { Stack } from 'expo-router';
import { QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '../lib/auth';
import { queryClient } from '../lib/queryClient';
import BackButton from '../components/BackButton';
import { DEFAULT_HEADER_OPTIONS, SCREEN_TITLES } from '../constants/navigation';

export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Stack screenOptions={DEFAULT_HEADER_OPTIONS}>
          {/* Welcome screen: full-bleed, no header */}
          <Stack.Screen 
            name="index" 
            options={{ headerShown: false }} 
          />

          {/* Tabs group: manages its own headers */}
          <Stack.Screen 
            name="(tabs)" 
            options={{ headerShown: false }} 
          />

          {/* Sign-in screen */}
          <Stack.Screen
            name="sign-in"
            options={{
              headerShown: false,
            }}
          />
          {/* Membership levels screen with back button */}
          <Stack.Screen
            name="(auth)/membership-levels"
            options={{
              headerShown: true,
              headerTitle: SCREEN_TITLES.MEMBERSHIP_LEVELS,
              headerLeft: () => <BackButton />,
            }}
          />

          {/* Notifications screen */}
          <Stack.Screen
            name="notification"
            options={{
              headerShown: true,
              headerTitle: SCREEN_TITLES.NOTIFICATIONS,
              headerLeft: () => <BackButton />,
            }}
          />

          {/* Profile settings screen */}
          <Stack.Screen
            name="profile/settings"
            options={{
              headerShown: false,
            }}
          />

          {/* Credits screen (renders its own header) */}
          <Stack.Screen
            name="profile/credits"
            options={{
              headerShown: false,
            }}
          />

          {/* Profile activity screen */}
          <Stack.Screen
            name="profile/activity"
            options={{
              headerShown: false,
            }}
          />

          {/* Profile groups screen */}
          <Stack.Screen
            name="profile/groups"
            options={{
              headerShown: false,
            }}
          />

          {/* Profile connections screen */}
          <Stack.Screen
            name="profile/connections"
            options={{
              headerShown: false,
            }}
          />

          {/* Group detail screen */}
          <Stack.Screen
            name="group-detail"
            options={{
              headerShown: false,
            }}
          />

          {/* Explore groups screen */}
          <Stack.Screen
            name="explore-groups"
            options={{
              headerShown: false,
            }}
          />

          {/* In-app resource viewer (WebView) with back button */}
          <Stack.Screen
            name="resource-viewer"
            options={{
              headerShown: true,
              headerLeft: () => <BackButton />,
            }}
          />
        </Stack>
      </AuthProvider>
    </QueryClientProvider>
  );
}
