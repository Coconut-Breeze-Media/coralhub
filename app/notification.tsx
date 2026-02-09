// app/notifications.tsx
import { SafeAreaView, Text, View } from 'react-native';

export default function NotificationsScreen() {
  return (
    <SafeAreaView style={{ flex: 1, padding: 16, gap: 12 }}>
      <Text style={{ fontSize: 22, fontWeight: '700' }}>Notifications</Text>
      <View>
        <Text>- Messages and friend requests combined (placeholder)</Text>
        <Text>- Later: tabs for “Messages” / “Requests”, filters, unread badges</Text>
      </View>
    </SafeAreaView>
  );
}