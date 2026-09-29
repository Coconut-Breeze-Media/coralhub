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
import { brandHeaderTitle } from '../components/AppHeader';
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
          {/* Password recovery remains inside the application WebView. */}
          <Stack.Screen
            name="password-reset"
            options={{
              headerShown: true,
              headerTitle: 'Reset password',
              headerLeft: () => <BackButton />,
            }}
          />

          {/* Membership levels screen with back button */}
          <Stack.Screen
            name="(auth)/membership-levels"
            options={{
              headerShown: true,
              headerTitle: brandHeaderTitle(SCREEN_TITLES.MEMBERSHIP_LEVELS),
              headerLeft: () => <BackButton />,
            }}
          />
        </Stack>
      </AuthProvider>
    </QueryClientProvider>
  );
}
