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
  const canSend = !!selectedMember && !!message.trim() && !isSending;

  return (
    <SafeAreaView style={{ flex: 1, padding: 16, backgroundColor: '#f8fafc' }}>
      <Text
        style={{
          fontSize: 22,
          fontWeight: '700',
          marginBottom: 16,
          color: '#0f172a',
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
          borderRadius: 12,
          paddingHorizontal: 12,
          paddingVertical: 10,
          marginBottom: 16,
          backgroundColor: '#ffffff',
        }}
      />

      <View style={{ flex: 1 }}>
        {isLoading && <Text>Loading members...</Text>}

        {error && <Text>Error loading members</Text>}

        <FlatList
          data={members}
          keyExtractor={(item) => item.id.toString()}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{
            paddingBottom: 12,
            flexGrow: members.length === 0 ? 1 : undefined,
          }}
          ListEmptyComponent={
            !isLoading && !error ? (
              <View
                style={{
                  borderWidth: 1,
                  borderColor: '#e2e8f0',
                  borderRadius: 14,
                  padding: 16,
                  backgroundColor: '#ffffff',
                }}
              >
                <Text style={{ fontWeight: '700', color: '#0f172a', marginBottom: 4 }}>
                  No members found
                </Text>
                <Text style={{ color: '#64748b' }}>
                  Try another name or username.
                </Text>
              </View>
            ) : null
          }
          renderItem={({ item }) => {
            const isSelected = selectedMember?.id === item.id;

            return (
              <Pressable
                onPress={() => setSelectedMember(item)}
                style={{
                  padding: 12,
                  borderWidth: 1,
                  borderColor: isSelected ? '#0284c7' : '#e5e7eb',
                  backgroundColor: isSelected ? '#e0f2fe' : '#ffffff',
                  borderRadius: 12,
                  marginBottom: 10,
                }}
              >
                <Text style={{ fontWeight: '700', color: '#0f172a' }}>{item.name}</Text>
                <Text style={{ color: '#64748b', marginTop: 2 }}>ID: {item.id}</Text>
              </Pressable>
            );
          }}
        />
      </View>

      {selectedMember && (
        <View style={{ marginTop: 12 }}>
          <View
            style={{
              borderWidth: 1,
              borderColor: '#bae6fd',
              backgroundColor: '#f0f9ff',
              borderRadius: 14,
              padding: 14,
              marginBottom: 12,
            }}
          >
            <Text
              style={{
                fontSize: 12,
                fontWeight: '700',
                color: '#0369a1',
                marginBottom: 4,
                textTransform: 'uppercase',
              }}
            >
              Selected recipient
            </Text>
            <Text style={{ fontSize: 16, fontWeight: '700', color: '#0f172a' }}>
              {selectedMember.name}
            </Text>
            <Text style={{ color: '#64748b', marginTop: 2 }}>
              Member ID: {selectedMember.id}
            </Text>
          </View>

          <TextInput
            value={message}
            onChangeText={setMessage}
            placeholder="Type your message..."
            multiline
            textAlignVertical="top"
            style={{
              borderWidth: 1,
              borderColor: '#d1d5db',
              borderRadius: 14,
              paddingHorizontal: 12,
              paddingVertical: 12,
              minHeight: 96,
              maxHeight: 160,
              backgroundColor: '#ffffff',
            }}
          />

          <Pressable
            disabled={!canSend}
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
              backgroundColor: canSend ? '#0077b6' : '#94a3b8',
              padding: 12,
              borderRadius: 12,
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
        </View>
      )}
    </SafeAreaView>
  );
}
