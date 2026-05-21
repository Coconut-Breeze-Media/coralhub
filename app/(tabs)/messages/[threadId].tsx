import { Text, TextInput, Pressable, View, ScrollView } from 'react-native';
import { useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';
import { useAuth } from '../../../lib/auth';
import { useMessages } from '../../../hooks/useMessages';

type NormalizedMessage = {
  id: string;
  body: string;
  senderName: string;
  sentAt: string;
  isOwn: boolean;
};

function stripHtml(value: string) {
  return value.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function getTextValue(value: unknown): string {
  if (typeof value === 'string') return stripHtml(value);
  if (!value || typeof value !== 'object') return '';

  const record = value as Record<string, unknown>;

  return (
    getTextValue(record.rendered) ||
    getTextValue(record.raw) ||
    getTextValue(record.message) ||
    getTextValue(record.content) ||
    ''
  );
}

function getArrayFromCandidate(value: unknown): Record<string, unknown>[] {
  if (Array.isArray(value)) {
    return value.filter(
      (item): item is Record<string, unknown> =>
        !!item && typeof item === 'object' && !Array.isArray(item)
    );
  }

  if (value && typeof value === 'object') {
    return Object.values(value).filter(
      (item): item is Record<string, unknown> =>
        !!item && typeof item === 'object' && !Array.isArray(item)
    );
  }

  return [];
}

function getThreadItems(data: unknown): Record<string, unknown>[] {
  if (Array.isArray(data)) {
    return data.filter(
      (item): item is Record<string, unknown> =>
        !!item && typeof item === 'object' && !Array.isArray(item)
    );
  }

  if (!data || typeof data !== 'object') return [];

  const record = data as Record<string, unknown>;
  const candidates = [
    record.messages,
    (record.thread as Record<string, unknown> | undefined)?.messages,
    record.items,
    (record.thread as Record<string, unknown> | undefined)?.items,
  ];

  for (const candidate of candidates) {
    const items = getArrayFromCandidate(candidate);
    if (items.length > 0) return items;
  }

  return [];
}

function formatTimestamp(value: unknown): string {
  if (typeof value !== 'string' || !value.trim()) return '';

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;

  return parsed.toLocaleString();
}

function getConversationTitle(data: unknown): string {
  if (!data || typeof data !== 'object') return 'Conversation';

  const record = data as Record<string, unknown>;

  return (
    getTextValue(record.subject) ||
    getTextValue(record.title) ||
    getTextValue((record.thread as Record<string, unknown> | undefined)?.subject) ||
    'Conversation'
  );
}

function normalizeMessages(
  items: Record<string, unknown>[],
  currentUserId: number | null
): NormalizedMessage[] {
  return items.map((item, index) => {
    const senderId =
      typeof item.sender_id === 'number'
        ? item.sender_id
        : typeof item.user_id === 'number'
          ? item.user_id
          : typeof (item.sender as Record<string, unknown> | undefined)?.id === 'number'
            ? ((item.sender as Record<string, unknown>).id as number)
            : null;

    return {
      id: String(item.id ?? item.message_id ?? item.ID ?? index),
      body:
        getTextValue(item.message) ||
        getTextValue(item.content) ||
        getTextValue(item.excerpt) ||
        getTextValue(item.subject) ||
        'Message unavailable',
      senderName:
        getTextValue(item.sender_name) ||
        getTextValue(item.display_name) ||
        getTextValue(item.user_name) ||
        getTextValue((item.sender as Record<string, unknown> | undefined)?.name) ||
        'Member',
      sentAt: formatTimestamp(
        item.date_sent ?? item.date ?? item.date_gmt ?? item.created_at
      ),
      isOwn: currentUserId != null && senderId === currentUserId,
    };
  });
}

export default function ThreadScreen() {
  const { threadId } = useLocalSearchParams();
  const { token, userId } = useAuth();
  const [message, setMessage] = useState('');
  const { data, isLoading, error } = useMessages(Number(threadId), token);
  const title = getConversationTitle(data);
  const messages = normalizeMessages(getThreadItems(data), userId);

  return (
    <SafeAreaView style={{ flex: 1, padding: 16 }}>
      <Text style={{ fontSize: 22, fontWeight: '700' }}>
        {title}
      </Text>

      <View style={{ flex: 1, marginTop: 16, marginBottom: 12 }}>
        {isLoading && <Text>Loading messages...</Text>}

        {error && <Text>Error loading messages</Text>}

        {!isLoading && !error && messages.length > 0 && (
          <ScrollView
            contentContainerStyle={{ paddingBottom: 8 }}
            showsVerticalScrollIndicator={false}
          >
            {messages.map((item) => (
              <View
                key={item.id}
                style={{
                  alignItems: item.isOwn ? 'flex-end' : 'flex-start',
                  marginBottom: 12,
                }}
              >
                <View
                  style={{
                    maxWidth: '82%',
                    backgroundColor: item.isOwn ? '#0077b6' : '#f3f4f6',
                    paddingHorizontal: 12,
                    paddingVertical: 10,
                    borderRadius: 14,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 12,
                      fontWeight: '700',
                      marginBottom: 4,
                      color: item.isOwn ? '#dbeafe' : '#6b7280',
                    }}
                  >
                    {item.senderName}
                  </Text>

                  <Text style={{ color: item.isOwn ? 'white' : '#111827' }}>
                    {item.body}
                  </Text>
                </View>

                {!!item.sentAt && (
                  <Text
                    style={{
                      fontSize: 12,
                      color: '#9ca3af',
                      marginTop: 4,
                    }}
                  >
                    {item.sentAt}
                  </Text>
                )}
              </View>
            ))}
          </ScrollView>
        )}

        {!isLoading && !error && !!data && messages.length === 0 && (
          <View
            style={{
              borderWidth: 1,
              borderColor: '#e5e7eb',
              borderRadius: 12,
              padding: 14,
              backgroundColor: '#f9fafb',
            }}
          >
            <Text style={{ fontWeight: '700', marginBottom: 4 }}>
              Conversation loaded
            </Text>
            <Text style={{ color: '#6b7280' }}>
              The thread response did not include message items in a recognized format yet.
            </Text>
          </View>
        )}

        {!isLoading && !error && !data && (
          <Text>No messages found</Text>
        )}
      </View>

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
            if (!message.trim()) return;

            console.log('thread reply not implemented yet', {
              threadId,
              message,
            });
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
