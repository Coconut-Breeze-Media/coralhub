// App.tsx
/**
 * Root application component
 * Sets up providers for authentication and data fetching
 */

import { QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from './lib/auth';
import { queryClient } from './lib/queryClient';
import { Slot } from 'expo-router';
import { useNotifications } from './hooks/useNotifications';

export default function App() {
  useNotifications();

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Slot />
      </AuthProvider>
    </QueryClientProvider>
  );
}
