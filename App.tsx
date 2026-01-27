// App.tsx
/**
 * Root application component
 * Sets up providers for authentication and data fetching
 */

import { QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from './lib/auth';
import { queryClient } from './lib/queryClient';
import { Slot } from 'expo-router';

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Slot />
      </AuthProvider>
    </QueryClientProvider>
  );
}