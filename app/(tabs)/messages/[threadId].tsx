import { Text, TextInput, Pressable, View } from 'react-native';
import { useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';
import { useAuth } from '../../../lib/auth';
import {
  useMessages,
  useSendMessage,
} from '../../../hooks/useMessages';

export default function ThreadScreen() {
  const { threadId } = useLocalSearchParams();
  const { token } = useAuth();
  const [message, setMessage] = useState('');
  const { data, isLoading, error } = useMessages(
    
    Number(threadId),
    token
  );
  const sendMessageMutation = useSendMessage(token);
  return (
    <SafeAreaView style={{ flex: 1, padding: 16 }}>
      <Text style={{ fontSize: 22, fontWeight: '700' }}>
        Conversation
      </Text>

      {isLoading && <Text>Loading messages...</Text>}

      {error && <Text>Error loading messages</Text>}

      {data && (
        <Text>{JSON.stringify(data).slice(0, 500)}</Text>
      )}

      {!isLoading && !error && !data && (
        <Text>No messages found</Text>
      )}
      <View style={{ flexDirection: 'row', gap: 8, marginTop: 'auto' }}>
        <TextInput
          value={message}
          onChangeText={setMessage}
          placeholder="Type a message..."
          style={{
            flex: 1,
            borderWidth: 1,
            borderColor: '#d1d5db',
            borderRadius: 8,
            padding: 10,
          }}
        />

        <Pressable
          onPress={() => {
            sendMessageMutation.mutate({
              recipients: [],
              subject: 'New Message',
              message,
            });

            setMessage('');
          }}
          style={{
            backgroundColor: '#0077b6',
            paddingHorizontal: 16,
            justifyContent: 'center',
            borderRadius: 8,
          }}
        >
          <Text style={{ color: 'white', fontWeight: '700' }}>Send</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}