// app/components/RequireAuth.tsx
import { Redirect } from 'expo-router';
import { View, ActivityIndicator } from 'react-native';
import { useAuth } from '@/lib/auth';   

export default function RequireAuth({ children }: { children: React.ReactNode }) {
  const { ready, token } = useAuth();
  if (!ready) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator />
      </View>
    );
  }
  if (!token) return <Redirect href="/" />;
  return <>{children}</>;
}