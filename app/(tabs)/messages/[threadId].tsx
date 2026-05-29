import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useEffect, useRef, useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';

import { useAuth } from '../../../lib/auth';
import {
  useMarkConversationAsRead,
  useMessages,
} from '../../../hooks/useMessages';
import {
  applyComposerFormat,
  MessageFormattingToolbar,
  type ComposerSelection,
} from '../../../components/MessageFormattingToolbar';
import { MessageMarkdownText } from '../../../components/MessageMarkdownText';

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
    getTextValue(record.raw) ||
    getTextValue(record.rendered) ||
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
  if (typeof value === 'number') {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? String(value) : parsed.toLocaleString();
  }

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

function toNumberOrNull(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function normalizeMessages(
  items: Record<string, unknown>[],
  currentUserId: number | null
): NormalizedMessage[] {
  return items.map((item, index) => {
    const senderId =
      toNumberOrNull(item.sender_id) ??
      toNumberOrNull(item.user_id) ??
      toNumberOrNull((item.sender as Record<string, unknown> | undefined)?.id);

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
  const parsedThreadId = Array.isArray(threadId)
    ? Number(threadId[0])
    : Number(threadId);

  const { token, userId } = useAuth();
  const { mutate: markConversationAsRead } = useMarkConversationAsRead(token);
  const scrollViewRef = useRef<ScrollView | null>(null);
  const [message, setMessage] = useState('');
  const [selection, setSelection] = useState<ComposerSelection>({
    start: 0,
    end: 0,
  });
  const { data, isLoading, isRefetching, error, refetch } = useMessages(
    Number.isFinite(parsedThreadId) ? parsedThreadId : null,
    token
  );

  const title = getConversationTitle(data);
  const messages = normalizeMessages(getThreadItems(data), userId);
  const hasMessages = messages.length > 0;
  const isRefreshing = isRefetching && !isLoading;

  useEffect(() => {
    if (!Number.isFinite(parsedThreadId)) return;

    markConversationAsRead(parsedThreadId);
  }, [parsedThreadId, markConversationAsRead]);

  useEffect(() => {
    if (!hasMessages) return;

    const frameId = requestAnimationFrame(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    });

    return () => cancelAnimationFrame(frameId);
  }, [hasMessages, messages.length]);

  function handleFormatAction(action: Parameters<typeof applyComposerFormat>[2]) {
    const next = applyComposerFormat(message, selection, action);
    setMessage(next.text);
    requestAnimationFrame(() => {
      setSelection(next.selection);
    });
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f8fafc' }}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 18 : 0}
      >
        <View style={{ flex: 1, paddingHorizontal: 16, paddingTop: 16 }}>
          <View style={{ marginBottom: 16 }}>
            <Text style={{ fontSize: 22, fontWeight: '700', color: '#0f172a' }}>
              {title}
            </Text>
            <Text style={{ marginTop: 4, color: '#64748b', fontSize: 13 }}>
              {hasMessages
                ? `${messages.length} message${messages.length === 1 ? '' : 's'}`
                : 'Private conversation'}
            </Text>
          </View>

          <View style={{ flex: 1 }}>
            {isLoading && <Text style={{ color: '#64748b' }}>Loading messages...</Text>}

            {error && (
              <ScrollView
                contentContainerStyle={{ flexGrow: 1 }}
                keyboardShouldPersistTaps="handled"
                refreshControl={
                  <RefreshControl
                    refreshing={isRefreshing}
                    onRefresh={() => {
                      void refetch();
                    }}
                  />
                }
              >
                <Text style={{ color: '#b91c1c' }}>Error loading messages</Text>
              </ScrollView>
            )}

            {!isLoading && !error && hasMessages && (
              <ScrollView
                ref={scrollViewRef}
                contentContainerStyle={{ paddingBottom: 16 }}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
                refreshControl={
                  <RefreshControl
                    refreshing={isRefreshing}
                    onRefresh={() => {
                      void refetch();
                    }}
                  />
                }
                onContentSizeChange={() => {
                  scrollViewRef.current?.scrollToEnd({ animated: true });
                }}
              >
                {messages.map((item) => (
                  <View
                    key={item.id}
                    style={{
                      alignItems: item.isOwn ? 'flex-end' : 'flex-start',
                      marginBottom: 14,
                    }}
                  >
                    {!item.isOwn && (
                      <Text
                        style={{
                          fontSize: 12,
                          fontWeight: '700',
                          color: '#64748b',
                          marginBottom: 6,
                          marginLeft: 4,
                        }}
                      >
                        {item.senderName}
                      </Text>
                    )}

                    <View
                      style={{
                        maxWidth: '82%',
                        backgroundColor: item.isOwn ? '#0ea5e9' : '#ffffff',
                        paddingHorizontal: 14,
                        paddingVertical: 11,
                        borderRadius: 18,
                        borderTopRightRadius: item.isOwn ? 6 : 18,
                        borderTopLeftRadius: item.isOwn ? 18 : 6,
                        borderWidth: item.isOwn ? 0 : 1,
                        borderColor: '#e2e8f0',
                        shadowColor: '#0f172a',
                        shadowOpacity: item.isOwn ? 0.14 : 0.06,
                        shadowRadius: 8,
                        shadowOffset: { width: 0, height: 3 },
                        elevation: item.isOwn ? 2 : 1,
                      }}
                    >
                      <MessageMarkdownText
                        value={item.body}
                        textStyle={{
                          color: item.isOwn ? '#ffffff' : '#0f172a',
                          fontSize: 15,
                          lineHeight: 21,
                        }}
                        linkColor={item.isOwn ? '#e0f2fe' : '#0369a1'}
                      />
                    </View>

                    {!!item.sentAt && (
                      <Text
                        style={{
                          fontSize: 11,
                          color: '#94a3b8',
                          marginTop: 5,
                          marginHorizontal: 4,
                        }}
                      >
                        {item.sentAt}
                      </Text>
                    )}
                  </View>
                ))}
              </ScrollView>
            )}

            {!isLoading && !error && !!data && !hasMessages && (
              <ScrollView
                contentContainerStyle={{ flexGrow: 1 }}
                keyboardShouldPersistTaps="handled"
                refreshControl={
                  <RefreshControl
                    refreshing={isRefreshing}
                    onRefresh={() => {
                      void refetch();
                    }}
                  />
                }
              >
                <View
                  style={{
                    borderWidth: 1,
                    borderColor: '#e2e8f0',
                    borderRadius: 18,
                    padding: 16,
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
                    <Text style={{ fontSize: 20, fontWeight: '700', color: '#0369a1' }}>
                      M
                    </Text>
                  </View>
                  <Text
                    style={{
                      fontSize: 18,
                      fontWeight: '700',
                      marginBottom: 6,
                      color: '#0f172a',
                      textAlign: 'center',
                    }}
                  >
                    No messages yet
                  </Text>
                  <Text style={{ color: '#64748b', lineHeight: 20, textAlign: 'center' }}>
                    This conversation is ready, but there are not any message items to display yet.
                  </Text>
                </View>
              </ScrollView>
            )}

            {!isLoading && !error && !data && (
              <ScrollView
                contentContainerStyle={{ flexGrow: 1 }}
                keyboardShouldPersistTaps="handled"
                refreshControl={
                  <RefreshControl
                    refreshing={isRefreshing}
                    onRefresh={() => {
                      void refetch();
                    }}
                  />
                }
              >
                <View
                  style={{
                    borderWidth: 1,
                    borderColor: '#e2e8f0',
                    borderRadius: 18,
                    padding: 16,
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
                    <Text style={{ fontSize: 20, fontWeight: '700', color: '#0369a1' }}>
                      M
                    </Text>
                  </View>
                  <Text
                    style={{
                      color: '#0f172a',
                      fontWeight: '700',
                      fontSize: 18,
                      marginBottom: 6,
                      textAlign: 'center',
                    }}
                  >
                    No messages found
                  </Text>
                  <Text style={{ color: '#64748b', textAlign: 'center', lineHeight: 20 }}>
                    Pull to refresh or come back later to check this conversation again.
                  </Text>
                </View>
              </ScrollView>
            )}
          </View>
        </View>

        <View
          style={{
            paddingHorizontal: 16,
            paddingTop: 12,
            paddingBottom: 16,
            borderTopWidth: 1,
            borderTopColor: '#e2e8f0',
            backgroundColor: '#ffffff',
          }}
        >
          <MessageFormattingToolbar onActionPress={handleFormatAction} />

          <View
            style={{
              flexDirection: 'row',
              alignItems: 'flex-end',
              gap: 10,
              marginTop: 12,
            }}
          >
            <TextInput
              value={message}
              onChangeText={setMessage}
              onSelectionChange={(event) => {
                setSelection(event.nativeEvent.selection);
              }}
              placeholder="Type a message..."
              multiline
              selection={selection}
              textAlignVertical="top"
              style={{
                flex: 1,
                minHeight: 46,
                maxHeight: 110,
                borderWidth: 1,
                borderColor: '#cbd5e1',
                borderRadius: 18,
                paddingHorizontal: 14,
                paddingVertical: 12,
                backgroundColor: '#f8fafc',
                color: '#0f172a',
              }}
            />

            <Pressable
              onPress={() => {
                if (!message.trim()) return;

                console.log('thread reply not implemented yet', {
                  threadId,
                  message,
                });

                setMessage('');
                setSelection({ start: 0, end: 0 });
              }}
              style={{
                backgroundColor: '#0284c7',
                minHeight: 46,
                paddingHorizontal: 18,
                justifyContent: 'center',
                alignItems: 'center',
                borderRadius: 16,
              }}
            >
              <Text style={{ color: 'white', fontWeight: '700' }}>Send</Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
