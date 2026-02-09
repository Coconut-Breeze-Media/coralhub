// app/_layout.tsx
/**
 * Root layout component for the application
 * Sets up the navigation stack and authentication provider
 */

import { Stack } from 'expo-router';
import { AuthProvider } from '../lib/auth';
import BackButton from '../components/BackButton';
import { DEFAULT_HEADER_OPTIONS, SCREEN_TITLES } from '../constants/navigation';
import { useNotifications } from '../hooks/useNotifications';
import { useEffect } from 'react';

export default function RootLayout() {
  const { expoPushToken, notification } = useNotifications();

  useEffect(() => {
    console.log('🔔 RootLayout: Notification hook initialized');
    console.log('📱 Push Token Status:', expoPushToken ? 'RECEIVED' : 'PENDING');
  }, []);

  useEffect(() => {
    if (expoPushToken) {
      console.log('✅ Expo Push Token:', expoPushToken);
      // TODO: Send token to your backend server
    } else {
      console.log('⏳ Waiting for push token...');
    }
  }, [expoPushToken]);

  useEffect(() => {
    if (notification) {
      console.log('📬 Notification received:', notification);
      // TODO: Handle notification
    }
  }, [notification]);

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