// app/_layout.tsx
import { Stack } from 'expo-router';
import { useEffect } from 'react';
import { AuthProvider } from '../lib/auth';
import { detectBpRoutes } from "../lib/api/buddypress/routes";
import BackButton from '../components/BackButton';

export default function RootLayout() {
  useEffect(() => {
    // warm up + log what the server supports
    detectBpRoutes()
      .then((r) => console.log('[routes] detected:', r))
      .catch((e) => console.warn('[routes] detection failed:', e));
  }, []);

  return (
    <AuthProvider>
      <Stack
        screenOptions={{
          headerTitleAlign: 'center',
          headerShadowVisible: false,
          headerBackVisible: false,
        }}
      >
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen
          name="sign-in"
          options={{
            headerShown: true,
            headerTitle: '',
            headerLeft: () => <BackButton />,
          }}
        />
        <Stack.Screen
          name="(auth)/membership-levels"
          options={{
            headerShown: true,
            headerTitle: 'Choose a Plan',
            headerLeft: () => <BackButton />,
          }}
        />
        <Stack.Screen
          name="replies/[id]"
          options={{
            headerShown: true,
            headerTitle: 'Replies',
            headerLeft: () => <BackButton />,
          }}
        />
      </Stack>
    </AuthProvider>
  );
}