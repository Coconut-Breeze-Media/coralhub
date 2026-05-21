import { Text, FlatList, Pressable, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';

import { useAuth } from '../../lib/auth';
import { useConversations } from '../../hooks/useMessages';
import type {
  BPConversationsResponse,
  BPConversationSummary,
  BPMessageText,
} from '../../types';

function stripHtml(value: string) {
  return value.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function getTextValue(value?: string | BPMessageText): string {
  if (typeof value === 'string') return stripHtml(value);
  if (!value) return '';

  return stripHtml(value.rendered ?? value.raw ?? '');
}

function getConversationItems(
  data: BPConversationsResponse | undefined
): BPConversationSummary[] {
  if (Array.isArray(data)) return data;
  if (!data) return [];
  if (Array.isArray(data.threads)) return data.threads;
  if (Array.isArray(data.messages)) return data.messages;
  if (Array.isArray(data.items)) return data.items;
  return [];
}

export default function MessagesScreen() {
  const { token } = useAuth();
  const { data, isLoading, error } = useConversations(token);

  const conversations = getConversationItems(data);

  return (
    <SafeAreaView style={{ flex: 1, padding: 16 }}>
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 16,
        }}
      >
        <Text style={{ fontSize: 24, fontWeight: '700' }}>Messages</Text>

        <Pressable
          onPress={() => router.push('/messages/new')}
          style={{
            backgroundColor: '#0077b6',
            paddingHorizontal: 14,
            paddingVertical: 8,
            borderRadius: 999,
          }}
        >
          <Text style={{ color: 'white', fontWeight: '700' }}>New</Text>
        </Pressable>
      </View>

      {isLoading && <Text>Loading conversations...</Text>}

      {error && <Text>Error loading conversations</Text>}

      {!isLoading && !error && conversations.length === 0 && (
        <View
          style={{
            flex: 1,
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
          }}
        >
          <Text style={{ fontSize: 18, fontWeight: '700' }}>
            No conversations yet
          </Text>

          <Text style={{ textAlign: 'center', color: '#6b7280' }}>
            Start a private message with another member.
          </Text>

          <Pressable
            onPress={() => router.push('/messages/new')}
            style={{
              backgroundColor: '#0077b6',
              paddingHorizontal: 16,
              paddingVertical: 10,
              borderRadius: 8,
              marginTop: 8,
            }}
          >
            <Text style={{ color: 'white', fontWeight: '700' }}>
              Start Message
            </Text>
          </Pressable>
        </View>
      )}

      {conversations.length > 0 && (
        <FlatList
          data={conversations}
          keyExtractor={(item, index) =>
            String(item.id ?? item.thread_id ?? index)
          }
          renderItem={({ item, index }) => (
            <Pressable
              onPress={() =>
                router.push(
                  `/messages/${String(item.id ?? item.thread_id ?? index)}`
                )
              }
              style={{
                padding: 14,
                borderWidth: 1,
                borderColor: '#e5e7eb',
                borderRadius: 12,
                marginBottom: 10,
              }}
            >
              <Text style={{ fontWeight: '700', marginBottom: 4 }}>
                {getTextValue(item.subject) || 'Conversation'}
              </Text>

              <Text numberOfLines={1} style={{ color: '#6b7280' }}>
                {getTextValue(item.last_message_content) || 'Open conversation'}
              </Text>
            </Pressable>
          )}
        />
      )}
    </SafeAreaView>
  );
}
