// app/_layout.tsx
import { Stack } from 'expo-router';
import { AuthProvider } from '../lib/auth';
import BackButton from '../components/BackButton';

export default function RootLayout() {
  return (
    <AuthProvider>
      <Stack
        screenOptions={{
          headerTitleAlign: 'center',
          headerShadowVisible: false,
          headerBackVisible: false, // iOS: hide text next to back chevron
        }}
      >
        {/* Welcome: full-bleed, no header */}
        <Stack.Screen name="index" options={{ headerShown: false }} />

        {/* Tabs group: it manages its own headers */}
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />

        {/* Sign-in: show header with our back chevron */}
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

        {/* Add more stack screens here; they’ll inherit the header.
            If you want the back chevron on them too, add headerLeft: BackButton. */}
      </Stack>
    </AuthProvider>
  );
}