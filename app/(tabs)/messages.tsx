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

function getInitial(value: string): string {
  const safeValue = value.trim();
  return safeValue ? safeValue[0].toUpperCase() : 'C';
}

function getUnreadCount(value: unknown): number {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  return 0;
}

export default function MessagesScreen() {
  const { token } = useAuth();
  const { data, isLoading, error } = useConversations(token);

  const conversations = getConversationItems(data);

  return (
    <SafeAreaView style={{ flex: 1, padding: 16, backgroundColor: '#f8fafc' }}>
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
          contentContainerStyle={{ paddingBottom: 8 }}
          keyExtractor={(item, index) =>
            String(item.id ?? item.thread_id ?? index)
          }
          renderItem={({ item, index }) => {
            const subject = getTextValue(item.subject) || 'Conversation';
            const preview = getTextValue(item.last_message_content) || 'Open conversation';
            const unreadCount = getUnreadCount(item.unread_count);

            return (
              <Pressable
                onPress={() =>
                  router.push(
                    `/messages/${String(item.id ?? item.thread_id ?? index)}`
                  )
                }
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  padding: 14,
                  borderWidth: 1,
                  borderColor: '#e2e8f0',
                  borderRadius: 16,
                  marginBottom: 12,
                  backgroundColor: '#ffffff',
                  shadowColor: '#0f172a',
                  shadowOpacity: 0.05,
                  shadowRadius: 8,
                  shadowOffset: { width: 0, height: 3 },
                  elevation: 1,
                }}
              >
                <View
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 22,
                    backgroundColor: '#e0f2fe',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginRight: 12,
                  }}
                >
                  <Text style={{ fontSize: 18, fontWeight: '700', color: '#0369a1' }}>
                    {getInitial(subject)}
                  </Text>
                </View>

                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text
                    numberOfLines={1}
                    style={{
                      fontWeight: '700',
                      marginBottom: 4,
                      color: '#0f172a',
                    }}
                  >
                    {subject}
                  </Text>

                  <Text
                    numberOfLines={2}
                    style={{
                      color: '#64748b',
                      lineHeight: 19,
                    }}
                  >
                    {preview}
                  </Text>
                </View>

                {unreadCount > 0 && (
                  <View
                    style={{
                      minWidth: 22,
                      height: 22,
                      paddingHorizontal: 6,
                      borderRadius: 11,
                      backgroundColor: '#0284c7',
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginLeft: 12,
                    }}
                  >
                    <Text style={{ color: '#ffffff', fontSize: 12, fontWeight: '700' }}>
                      {unreadCount}
                    </Text>
                  </View>
                )}
              </Pressable>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}
