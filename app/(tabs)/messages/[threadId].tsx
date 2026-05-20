import { Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';

export default function ThreadScreen() {
  const { threadId } = useLocalSearchParams();

  return (
    <SafeAreaView style={{ flex: 1, padding: 16 }}>
      <Text style={{ fontSize: 22, fontWeight: '700' }}>
        Conversation
      </Text>

      <Text>Thread ID: {threadId}</Text>
    </SafeAreaView>
  );
}