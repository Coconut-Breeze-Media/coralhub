// app/(tabs)/_layout.tsx
import { Tabs, router } from 'expo-router';
import { Pressable, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../lib/auth';

export default function TabsLayout() {
  const { ready, token } = useAuth();

  // Wait for auth restore to finish
  if (!ready) return null;

  // Logged out? Do NOT navigate here. Leave it blank; the screen that initiated
  // sign-out will perform a single navigation out of (tabs).
  if (!token) return null;

  return (
    <Tabs
      initialRouteName="index"
      screenOptions={{
        headerTitleAlign: 'center',
        tabBarActiveTintColor: '#0077b6',
        headerRight: () => (
          <Pressable
            onPress={() => router.push('/notifications')}
            hitSlop={8}
            style={{ paddingRight: 12 }}
            accessibilityLabel="Open notifications"
          >
            <View>
              <Ionicons name="notifications-outline" size={24} color="#1f2937" />
              <View
                style={{
                  position: 'absolute', top: -2, right: -2, width: 8, height: 8,
                  borderRadius: 4, backgroundColor: '#ef4444',
                }}
              />
            </View>
          </Pressable>
        ),
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Community', tabBarIcon: ({ color, size }) => <Ionicons name="home-outline" color={color} size={size} /> }} />
      <Tabs.Screen name="resources" options={{ title: 'Resources', tabBarIcon: ({ color, size }) => <Ionicons name="people-outline" color={color} size={size} /> }} />
      <Tabs.Screen name="networking" options={{ title: 'Networking', tabBarIcon: ({ color, size }) => <Ionicons name="book-outline" color={color} size={size} /> }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile', tabBarIcon: ({ color, size }) => <Ionicons name="person-circle-outline" color={color} size={size} /> }} />
    </Tabs>
  );
}