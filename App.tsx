// App.tsx
/**
 * Root application component
 * Sets up providers for authentication and data fetching
 */

import { QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from './lib/auth';
import { queryClient } from './lib/queryClient';
import { Slot } from 'expo-router';
import { useEffect } from 'react';
import { useNotifications } from './hooks/useNotifications';

export default function App() {
  const { expoPushToken, notification } = useNotifications();

  useEffect(() => {
  }, []);

  useEffect(() => {
    if (expoPushToken) {
      // TODO: Send token to your backend server to store it
      // Example: sendPushTokenToServer(expoPushToken);
    } else {
    }
  }, [expoPushToken]);

  useEffect(() => {
    if (notification) {
      // TODO: Handle notification data (e.g., navigate to specific screen)
    }
  }, [notification]);

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Slot />
      </AuthProvider>
    </QueryClientProvider>
  );
}