// app/_layout.tsx
import { Stack, Slot, router, usePathname } from 'expo-router';
import { useEffect, useRef } from 'react';
import { AuthProvider, useAuth } from '../lib/auth';
import { detectBpRoutes } from "../lib/api/buddypress/routes";
import BackButton from '../components/BackButton';

function AuthGate() {
  const { token, ready } = useAuth();
  const pathname = usePathname();
  const lastToken = useRef<string | null | undefined>(undefined);
  const redirecting = useRef(false);

  useEffect(() => {
    if (!ready) return;
    if (redirecting.current) return;

    const isAuthRoute = pathname?.startsWith('/(auth)');
    const isTabsRoute = pathname?.startsWith('/(tabs)');
    const isIndex = pathname === '/' || pathname === '/index';

    // only act when token value actually changes
    if (lastToken.current !== token) {
      lastToken.current = token;

      if (!token) {
        // ✅ allow landing page, don't auto-redirect
        if (!isAuthRoute && !isIndex) {
          redirecting.current = true;
          router.replace('/'); // go back to index landing
          setTimeout(() => (redirecting.current = false), 200);
        }
      } else {
        // logged in but stuck in auth pages → push them into tabs
        if (isAuthRoute && !isTabsRoute) {
          redirecting.current = true;
          router.replace('/(tabs)');
          setTimeout(() => (redirecting.current = false), 200);
        }
      }
    }
  }, [token, ready, pathname]);

  return null;
}


export default function RootLayout() {
  useEffect(() => {
    detectBpRoutes()
      .then((r) => console.log('[routes] detected:', r))
      .catch((e) => console.warn('[routes] detection failed:', e));
  }, []);

  return (
    <AuthProvider>
      <AuthGate />
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