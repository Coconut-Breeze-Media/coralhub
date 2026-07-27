import {
  ActivityIndicator,
  Keyboard,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useEffect, useMemo, useRef, useState } from 'react';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { useAuth } from '../../../lib/auth';
import {
  useDeleteConversation,
  useMarkConversationAsRead,
  useMessages,
  useReplyToThread,
} from '../../../hooks/useMessages';
import {
  extractConversationParticipantNames,
  extractConversationParticipantUserIds,
  extractParticipantNamesFromMessages,
  formatConversationTitle,
  getMessageTextValue,
} from '../../../lib/messagePresentation';
import { MessageMarkdownText } from '../../../components/MessageMarkdownText';
import { MessageNotice } from '../../../components/MessageNotice';
import DeleteConversationModal from '../../../components/DeleteConversationModal';

type NormalizedMessage = {
  id: string;
  body: string;
  senderName: string;
  sentAt: string;
  sentAtValue: number;
  isOwn: boolean;
};

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

function unwrapThreadRecord(data: unknown): Record<string, unknown> | null {
  if (Array.isArray(data)) {
    const [firstItem] = data;
    if (firstItem && typeof firstItem === 'object' && !Array.isArray(firstItem)) {
      return firstItem as Record<string, unknown>;
    }
    return null;
  }

  if (data && typeof data === 'object') {
    return data as Record<string, unknown>;
  }

  return null;
}

function getThreadItems(data: unknown): Record<string, unknown>[] {
  const record = unwrapThreadRecord(data);
  if (!record) return [];
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

function mergeMessagePages(pages: unknown[]): Record<string, unknown> | undefined {
  const firstThread = unwrapThreadRecord(pages[0]);
  if (!firstThread) return undefined;

  const messagesById = new Map<string, Record<string, unknown>>();
  for (const page of pages) {
    for (const message of getThreadItems(page)) {
      const messageId = message.id ?? message.message_id;
      if (messageId != null) messagesById.set(String(messageId), message);
    }
  }

  return {
    ...firstThread,
    messages: [...messagesById.values()],
  };
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

function getTimestampValue(value: unknown): number {
  const timestamp =
    typeof value === 'number'
      ? value
      : typeof value === 'string'
        ? new Date(value).getTime()
        : Number.NaN;

  return Number.isFinite(timestamp) ? timestamp : 0;
}

function getConversationSubject(data: unknown): string {
  const record = unwrapThreadRecord(data);
  if (!record) return 'Conversation';

  return (
    getMessageTextValue(record.subject) ||
    getMessageTextValue(record.title) ||
    getMessageTextValue((record.thread as Record<string, unknown> | undefined)?.subject) ||
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
        getMessageTextValue(item.message) ||
        getMessageTextValue(item.content) ||
        getMessageTextValue(item.excerpt) ||
        getMessageTextValue(item.subject) ||
        'Message unavailable',
      senderName:
        getMessageTextValue(item.sender_name) ||
        getMessageTextValue(item.display_name) ||
        getMessageTextValue(item.user_name) ||
        getMessageTextValue((item.sender as Record<string, unknown> | undefined)?.name) ||
        'Member',
      sentAt: formatTimestamp(
        item.date_sent ?? item.date ?? item.date_gmt ?? item.created_at
      ),
      sentAtValue: getTimestampValue(
        item.date_sent ?? item.date ?? item.date_gmt ?? item.created_at
      ),
      isOwn: currentUserId != null && senderId === currentUserId,
    };
  });
}

export default function ThreadScreen() {
  const { threadId, sent } = useLocalSearchParams<{
    threadId?: string | string[];
    sent?: string | string[];
  }>();
  const parsedThreadId = Array.isArray(threadId)
    ? Number(threadId[0])
    : Number(threadId);
  const sentValue = Array.isArray(sent) ? sent[0] : sent;

  const { token, userId, profile } = useAuth();
  const deleteConversationMutation = useDeleteConversation(token);
  const { mutate: markConversationAsRead } = useMarkConversationAsRead(token);
  const replyToThreadMutation = useReplyToThread(token);
  const insets = useSafeAreaInsets();
  const conversationLayoutRef = useRef<View | null>(null);
  const scrollViewRef = useRef<ScrollView | null>(null);
  const composerInputRef = useRef<TextInput | null>(null);
  const keyboardTopRef = useRef<number | null>(null);
  const contentHeightRef = useRef(0);
  const previousMessageCountRef = useRef(0);
  const isLoadingEarlierMessagesRef = useRef(false);
  const [message, setMessage] = useState('');
  const [composerHeight, setComposerHeight] = useState(74);
  const [keyboardOverlap, setKeyboardOverlap] = useState(0);
  const [isDeleteConfirmVisible, setIsDeleteConfirmVisible] = useState(false);
  const {
    data: messagePages,
    isLoading,
    isRefetching,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    refetch,
  } = useMessages(
    Number.isFinite(parsedThreadId) ? parsedThreadId : null,
    token
  );
  const [showSentNotice, setShowSentNotice] = useState(false);
  const [deleteErrorMessage, setDeleteErrorMessage] = useState('');

  const data = useMemo(
    () => mergeMessagePages(messagePages?.pages ?? []),
    [messagePages?.pages]
  );
  const threadItems = getThreadItems(data);
  const threadRecord = unwrapThreadRecord(data);
  const replyRecipientIds = extractConversationParticipantUserIds(threadRecord, [userId]);
  const participantNames = [
    ...extractConversationParticipantNames(threadRecord, {
      excludeNames: [profile?.user_display_name],
      excludeUserIds: [userId],
    }),
    ...extractParticipantNamesFromMessages(threadItems, {
      currentUserId: userId,
      currentUserDisplayName: profile?.user_display_name,
    }),
  ];
  const title = formatConversationTitle(
    participantNames,
    getConversationSubject(data),
    'Conversation'
  );
  const messages = normalizeMessages(threadItems, userId).sort(
    (first, second) => first.sentAtValue - second.sentAtValue
  );
  const hasMessages = messages.length > 0;
  const isRefreshing = isRefetching && !isLoading;
  const canSendReply =
    Number.isFinite(parsedThreadId) &&
    replyRecipientIds.length > 0 &&
    !!message.trim() &&
    !replyToThreadMutation.isPending;
  const canDeleteConversation =
    Number.isFinite(parsedThreadId) && !deleteConversationMutation.isPending;

  useEffect(() => {
    if (!data) return;
  }, [data, messages, parsedThreadId, threadItems]);

  useEffect(() => {
    if (!Number.isFinite(parsedThreadId)) {
      return;
    }

    markConversationAsRead(parsedThreadId, {
      onSuccess: () => {
      },
      onError: (error) => {
      },
    });
  }, [parsedThreadId, markConversationAsRead, threadId]);

  function updateKeyboardOverlap() {
    const keyboardTop = keyboardTopRef.current;

    if (keyboardTop == null) {
      setKeyboardOverlap(0);
      return;
    }

    conversationLayoutRef.current?.measureInWindow((_x, y, _width, height) => {
      setKeyboardOverlap(Math.max(0, y + height - keyboardTop));
    });
  }

  function loadEarlierMessages() {
    if (!hasNextPage || isFetchingNextPage) return;

    isLoadingEarlierMessagesRef.current = true;
    const previousHeight = contentHeightRef.current;

    void fetchNextPage().finally(() => {
      requestAnimationFrame(() => {
        if (contentHeightRef.current === previousHeight) {
          isLoadingEarlierMessagesRef.current = false;
        }
      });
    });
  }

  useEffect(() => {
    const scrollToLatestMessage = () => {
      requestAnimationFrame(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      });
    };

    const handleKeyboardFrame = (event: { endCoordinates: { screenY: number } }) => {
      keyboardTopRef.current = event.endCoordinates.screenY;
      updateKeyboardOverlap();
      scrollToLatestMessage();
    };
    const handleKeyboardHide = () => {
      keyboardTopRef.current = null;
      setKeyboardOverlap(0);
    };

    const frameSubscription = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillChangeFrame' : 'keyboardDidShow',
      handleKeyboardFrame
    );
    const hideSubscription = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      handleKeyboardHide
    );

    return () => {
      frameSubscription.remove();
      hideSubscription.remove();
    };
  }, []);

  useEffect(() => {
    const previousCount = previousMessageCountRef.current;
    previousMessageCountRef.current = messages.length;
    if (!hasMessages || isLoadingEarlierMessagesRef.current || messages.length < previousCount) {
      return;
    }

    const frameId = requestAnimationFrame(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    });

    return () => cancelAnimationFrame(frameId);
  }, [hasMessages, messages.length]);

  useEffect(() => {
    if (sentValue === '1') {
      setShowSentNotice(true);
    }
  }, [sentValue]);

  function handleDeleteConversation() {
    if (!Number.isFinite(parsedThreadId)) return;

    setDeleteErrorMessage('');
    setIsDeleteConfirmVisible(true);
  }

  function confirmDeleteConversation() {
    if (!Number.isFinite(parsedThreadId)) return;

    deleteConversationMutation.mutate(parsedThreadId, {
      onSuccess: () => {
        setIsDeleteConfirmVisible(false);
        router.replace('/messages?deleted=1');
      },
      onError: (deleteError) => {
        setIsDeleteConfirmVisible(false);
        setDeleteErrorMessage(
          deleteError.message || 'Could not delete the conversation.'
        );
      },
    });
  }

  function handleSendReply() {
    if (!Number.isFinite(parsedThreadId) || !message.trim()) return;
    if (replyRecipientIds.length === 0 || replyToThreadMutation.isPending) return;

    replyToThreadMutation.mutate(
      {
        threadId: parsedThreadId,
        message: message.trim(),
        recipients: replyRecipientIds,
      },
      {
        onSuccess: () => {
          setMessage('');
          requestAnimationFrame(() => {
            composerInputRef.current?.focus();
          });
        },
      }
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f8fafc' }}>
      <DeleteConversationModal
        visible={isDeleteConfirmVisible}
        isDeleting={deleteConversationMutation.isPending}
        onCancel={() => {
          if (!deleteConversationMutation.isPending) {
            setIsDeleteConfirmVisible(false);
          }
        }}
        onConfirm={confirmDeleteConversation}
      />

      <Stack.Screen
        options={{
          title,
          headerRight: Number.isFinite(parsedThreadId)
            ? () => (
                <Pressable
                  onPress={deleteConversationMutation.isPending ? undefined : handleDeleteConversation}
                  disabled={!canDeleteConversation}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel="Delete conversation"
                  style={{
                    paddingHorizontal: 4,
                    opacity: canDeleteConversation ? 1 : 0.45,
                  }}
                >
                  {deleteConversationMutation.isPending ? (
                    <ActivityIndicator size="small" color="#dc2626" />
                  ) : (
                    <Ionicons name="trash-outline" size={20} color="#dc2626" />
                  )}
                </Pressable>
              )
            : undefined,
        }}
      />

      <View
        ref={conversationLayoutRef}
        onLayout={updateKeyboardOverlap}
        style={{ flex: 1, minHeight: 0, position: 'relative' }}
      >
        <View style={{ flex: 1, minHeight: 0, paddingHorizontal: 16, paddingTop: 16 }}>
          {showSentNotice && (
            <MessageNotice
              tone="success"
              title="Message sent"
              description="Your new conversation was created successfully."
              onDismiss={() => {
                setShowSentNotice(false);
                if (Number.isFinite(parsedThreadId)) {
                  router.replace(`/messages/${parsedThreadId}`);
                }
              }}
            />
          )}

          {!!deleteErrorMessage && (
            <MessageNotice
              tone="error"
              title="Could not delete conversation"
              description={deleteErrorMessage}
              onDismiss={() => setDeleteErrorMessage('')}
            />
          )}

          <View style={{ flex: 1, minHeight: 0 }}>
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
                contentContainerStyle={{
                  flexGrow: 1,
                  justifyContent: 'flex-end',
                  paddingTop: 12,
                  paddingBottom: composerHeight + keyboardOverlap + 16,
                }}
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
                onContentSizeChange={(_width, nextHeight) => {
                  const previousHeight = contentHeightRef.current;
                  contentHeightRef.current = nextHeight;

                  if (isLoadingEarlierMessagesRef.current) {
                    scrollViewRef.current?.scrollTo({
                      y: Math.max(0, nextHeight - previousHeight),
                      animated: false,
                    });
                    isLoadingEarlierMessagesRef.current = false;
                  }
                }}
                onScroll={({ nativeEvent }) => {
                  if (nativeEvent.contentOffset.y <= 24) loadEarlierMessages();
                }}
                scrollEventThrottle={16}
              >
                {isFetchingNextPage && (
                  <ActivityIndicator size="small" color="#0284c7" style={{ marginBottom: 12 }} />
                )}
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
          onLayout={(event) => {
            const nextHeight = event.nativeEvent.layout.height;
            setComposerHeight((currentHeight) =>
              currentHeight === nextHeight ? currentHeight : nextHeight
            );
          }}
          style={{
            position: 'absolute',
            bottom: keyboardOverlap,
            left: 0,
            right: 0,
            paddingHorizontal: 16,
            paddingTop: 10,
            paddingBottom: Math.max(insets.bottom, 16),
            borderTopWidth: 1,
            borderTopColor: '#e2e8f0',
            backgroundColor: '#ffffff',
          }}
        >
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'flex-end',
              gap: 8,
            }}
          >
            <TextInput
              ref={composerInputRef}
              value={message}
              onChangeText={(value) => {
                if (replyToThreadMutation.isError) {
                  replyToThreadMutation.reset();
                }

                setMessage(value);
              }}
              onFocus={() => {
                requestAnimationFrame(() => {
                  scrollViewRef.current?.scrollToEnd({ animated: true });
                });
              }}
              placeholder="Write a message..."
              multiline
              editable={!replyToThreadMutation.isPending}
              textAlignVertical="top"
              maxLength={2000}
              style={{
                flex: 1,
                minHeight: 46,
                maxHeight: 120,
                borderWidth: 1,
                borderColor: '#cbd5e1',
                borderRadius: 22,
                paddingHorizontal: 14,
                paddingVertical: 11,
                backgroundColor: '#f8fafc',
                color: '#0f172a',
              }}
            />

            <Pressable
              disabled={!canSendReply}
              onPress={handleSendReply}
              accessibilityRole="button"
              accessibilityLabel="Send message"
              style={{
                backgroundColor: canSendReply ? '#0284c7' : '#94a3b8',
                width: 46,
                height: 46,
                justifyContent: 'center',
                alignItems: 'center',
                borderRadius: 23,
              }}
            >
              {replyToThreadMutation.isPending ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <Ionicons name="send" size={19} color="#ffffff" />
              )}
            </Pressable>
          </View>

          {replyToThreadMutation.isError && (
            <Text style={{ color: '#b91c1c', marginTop: 10, lineHeight: 20 }}>
              {replyToThreadMutation.error.message ||
                'Failed to send your reply. Please try again.'}
            </Text>
          )}

          {!replyToThreadMutation.isError &&
            !isLoading &&
            !error &&
            replyRecipientIds.length === 0 && (
              <Text style={{ color: '#b91c1c', marginTop: 10, lineHeight: 20 }}>
                We could not resolve the recipients for this conversation yet.
              </Text>
            )}

        </View>
      </View>
    </SafeAreaView>
  );
}
