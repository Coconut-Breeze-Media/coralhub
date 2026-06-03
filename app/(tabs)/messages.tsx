import { useEffect, useState } from 'react';
import {
  Text,
  FlatList,
  Pressable,
  View,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';

import { useAuth } from '../../lib/auth';
import { useConversations } from '../../hooks/useMessages';
import {
  extractConversationParticipantNames,
  formatConversationTitle,
  getMessageTextValue,
} from '../../lib/messagePresentation';
import type {
  BPConversationsResponse,
  BPConversationSummary,
  BPMessageText,
} from '../../types';
import { MessageNotice } from '../../components/MessageNotice';

function stripMarkdown(value: string): string {
  return value
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/(^|[\s(])\*([^*]+)\*(?=[\s).,!?:;]|$)/g, '$1$2')
    .replace(/(^|[\s(])_([^_]+)_(?=[\s).,!?:;]|$)/g, '$1$2')
    .replace(/\s+/g, ' ')
    .trim();
}

function truncatePreview(value: string, maxLength = 96): string {
  if (value.length <= maxLength) return value;

  return `${value.slice(0, maxLength).trimEnd()}...`;
}

function getPreviewText(value?: string | BPMessageText): string {
  const normalizedText = getMessageTextValue(value);
  if (!normalizedText) return '';

  return truncatePreview(stripMarkdown(normalizedText));
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

function StateCard({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children?: React.ReactNode;
}) {
  return (
    <View
      style={{
        borderWidth: 1,
        borderColor: '#e2e8f0',
        borderRadius: 18,
        padding: 18,
        backgroundColor: '#ffffff',
        alignItems: 'center',
      }}
    >
      <View
        style={{
          width: 48,
          height: 48,
          borderRadius: 24,
          backgroundColor: '#e0f2fe',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 12,
        }}
      >
        <Text style={{ fontSize: 20, fontWeight: '700', color: '#0369a1' }}>M</Text>
      </View>

      <Text
        style={{
          fontSize: 18,
          fontWeight: '700',
          color: '#0f172a',
          marginBottom: 6,
          textAlign: 'center',
        }}
      >
        {title}
      </Text>

      <Text
        style={{
          color: '#64748b',
          textAlign: 'center',
          lineHeight: 20,
        }}
      >
        {description}
      </Text>

      {children}
    </View>
  );
}

export default function MessagesScreen() {
  const { sent } = useLocalSearchParams<{ sent?: string | string[] }>();
  const { token, userId, profile } = useAuth();
  const { data, isLoading, isRefetching, error, refetch } = useConversations(token);
  const [showSentNotice, setShowSentNotice] = useState(false);

  const conversations = useMemo(() => getConversationItems(data), [data]);
  const isRefreshing = isRefetching && !isLoading;
  const sentValue = Array.isArray(sent) ? sent[0] : sent;

  useEffect(() => {
    if (sentValue === '1') {
      setShowSentNotice(true);
    }
  }, [sentValue]);

  useEffect(() => {
    if (!data) return;

    console.log('[MessagesScreen] raw messages response:', data);
    console.log('[MessagesScreen] messages:', conversations);
  }, [data, conversations]);

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

      {showSentNotice && (
        <MessageNotice
          tone="success"
          title="Message sent"
          description="Your conversation was created and your inbox has been refreshed."
          onDismiss={() => {
            setShowSentNotice(false);
            router.replace('/messages');
          }}
        />
      )}

      {isLoading && (
        <View style={{ flex: 1, justifyContent: 'center' }}>
          <StateCard
            title="Loading conversations"
            description="Pulling in your latest private messages."
          >
            <ActivityIndicator
              size="small"
              color="#0284c7"
              style={{ marginTop: 14 }}
            />
          </StateCard>
        </View>
      )}

      {error && (
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={() => {
                void refetch();
              }}
            />
          }
        >
          <StateCard
            title="Could not load messages"
            description="Pull down to try again, or check your connection and come back in a moment."
          >
            <Pressable
              onPress={() => {
                void refetch();
              }}
              style={{
                marginTop: 14,
                backgroundColor: '#0077b6',
                paddingHorizontal: 16,
                paddingVertical: 10,
                borderRadius: 10,
              }}
            >
              <Text style={{ color: '#ffffff', fontWeight: '700' }}>Try Again</Text>
            </Pressable>
          </StateCard>
        </ScrollView>
      )}

      {!isLoading && !error && conversations.length === 0 && (
        <ScrollView
          contentContainerStyle={{
            flexGrow: 1,
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
          }}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={() => {
                void refetch();
              }}
            />
          }
        >
          <StateCard
            title="No conversations yet"
            description="Start a private message with another member when you're ready."
          >
            <Pressable
              onPress={() => router.push('/messages/new')}
              style={{
                backgroundColor: '#0077b6',
                paddingHorizontal: 16,
                paddingVertical: 10,
                borderRadius: 10,
                marginTop: 14,
              }}
            >
              <Text style={{ color: 'white', fontWeight: '700' }}>
                Start Message
              </Text>
            </Pressable>
          </StateCard>
        </ScrollView>
      )}

      {conversations.length > 0 && (
        <FlatList
          data={conversations}
          contentContainerStyle={{ paddingBottom: 8 }}
          refreshing={isRefreshing}
          onRefresh={() => {
            void refetch();
          }}
          keyExtractor={(item, index) =>
            String(item.id ?? item.thread_id ?? index)
          }
          renderItem={({ item, index }) => {
            const participantNames = extractConversationParticipantNames(item, {
              excludeNames: [profile?.user_display_name],
              excludeUserIds: [userId],
            });
            const title = formatConversationTitle(
              participantNames,
              item.subject,
              'Conversation'
            );
            const preview = getPreviewText(item.last_message_content) || 'Open conversation';
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
                    {getInitial(title)}
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
                    {title}
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
