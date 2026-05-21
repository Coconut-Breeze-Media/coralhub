import { useState } from 'react';
import {
  Text,
  TextInput,
  FlatList,
  Pressable,
  View,
} from 'react-native';

import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '../../../lib/auth';
import { useMembersList } from '../../../hooks/useMembers';
import { useSendMessage } from '../../../hooks/useMessages';
import type { BPMember } from '../../../types';

export default function NewMessageScreen() {
  const { token } = useAuth();

  const [search, setSearch] = useState('');
  const [selectedMember, setSelectedMember] = useState<BPMember | null>(null);
  const [message, setMessage] = useState('');
  const sendMessageMutation = useSendMessage(token);
  const isSending = sendMessageMutation.isPending;
  const { data, isLoading, error } = useMembersList(token, {
    search,
    page: 1,
    perPage: 20,
  });
  const members = Array.isArray(data) ? data : [];

  return (
    <SafeAreaView style={{ flex: 1, padding: 16 }}>
      <Text
        style={{
          fontSize: 22,
          fontWeight: '700',
          marginBottom: 16,
        }}
      >
        New Message
      </Text>

      <TextInput
        value={search}
        onChangeText={setSearch}
        placeholder="Search members..."
        style={{
          borderWidth: 1,
          borderColor: '#d1d5db',
          borderRadius: 8,
          padding: 10,
          marginBottom: 16,
        }}
      />
      <Pressable
        onPress={() => {
            if (!selectedMember || !message.trim()) return;

            sendMessageMutation.mutate({
            recipients: [selectedMember.id],
            subject: 'New Message',
            message,
            });

            setMessage('');
        }}
        style={{
            backgroundColor: '#0077b6',
            padding: 12,
            borderRadius: 8,
            marginTop: 12,
            alignItems: 'center',
        }}
        >
        <Text style={{ color: 'white', fontWeight: '700' }}>
            {isSending ? 'Sending...' : 'Send Message'}
        </Text>
        </Pressable>
        {sendMessageMutation.isSuccess && (
        <Text style={{ color: 'green', marginTop: 8 }}>
            Message sent successfully
        </Text>
        )}

        {sendMessageMutation.isError && (
        <Text style={{ color: 'red', marginTop: 8 }}>
            Failed to send message
        </Text>
        )}
      {isLoading && <Text>Loading members...</Text>}

      {error && <Text>Error loading members</Text>}

      <FlatList
        data={members}
        keyExtractor={(item) => item.id.toString()}
        renderItem={({ item }) => (
          <Pressable
            onPress={() => setSelectedMember(item)}
            style={{
              padding: 12,
              borderBottomWidth: 1,
              borderBottomColor: '#e5e7eb',
            }}
          >
            <Text style={{ fontWeight: '700' }}>{item.name}</Text>
            <Text>ID: {item.id}</Text>
          </Pressable>
        )}
      />

      {selectedMember && (
        <View style={{ marginTop: 16 }}>
          <Text style={{ fontWeight: '700', marginBottom: 8 }}>
            Sending message to: {selectedMember.name}
          </Text>

          <TextInput
            value={message}
            onChangeText={setMessage}
            placeholder="Type your message..."
            style={{
              borderWidth: 1,
              borderColor: '#d1d5db',
              borderRadius: 8,
              padding: 10,
            }}
          />
        </View>
      )}
    </SafeAreaView>
  );
}
