// app/_layout.tsx
/**
 * Root layout component for the application
 * Sets up the navigation stack and authentication provider
 */

import { Stack } from 'expo-router';
import { AuthProvider } from '../lib/auth';
import BackButton from '../components/BackButton';
import { DEFAULT_HEADER_OPTIONS, SCREEN_TITLES } from '../constants/navigation';

export default function RootLayout() {
  return (
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

        {/* Sign-in screen with back button */}
        <Stack.Screen
          name="sign-in"
          options={{
            headerShown: true,
            headerTitle: SCREEN_TITLES.SIGN_IN,
            headerLeft: () => <BackButton />,
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
      </Stack>
    </AuthProvider>
  );
}