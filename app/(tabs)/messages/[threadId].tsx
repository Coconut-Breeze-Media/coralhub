import {
  ActivityIndicator,
  KeyboardAvoidingView,
  NativeSyntheticEvent,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  TextInputKeyPressEventData,
  View,
} from 'react-native';
import { useEffect, useMemo, useRef, useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
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
import {
  applyComposerFormat,
  MessageFormattingToolbar,
  insertComposerText,
  type ComposerSelection,
} from '../../../components/MessageFormattingToolbar';
import { MessageEmojiPicker } from '../../../components/MessageEmojiPicker';
import { MessageMarkdownText } from '../../../components/MessageMarkdownText';
import { MessageNotice } from '../../../components/MessageNotice';
import DeleteConversationModal from '../../../components/DeleteConversationModal';

type NormalizedMessage = {
  id: string;
  body: string;
  senderName: string;
  sentAt: string;
  isOwn: boolean;
};

type ComposerKeyPressEvent = NativeSyntheticEvent<
  TextInputKeyPressEventData & { shiftKey?: boolean }
>;

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
      isOwn: currentUserId != null && senderId === currentUserId,
    };
  });
}

function shouldSendOnEnterPress(event: ComposerKeyPressEvent): boolean {
  if (event.nativeEvent.key !== 'Enter') return false;
  if (event.nativeEvent.shiftKey) return false;

  event.preventDefault();
  return true;
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
  const scrollViewRef = useRef<ScrollView | null>(null);
  const composerInputRef = useRef<TextInput | null>(null);
  const [message, setMessage] = useState('');
  const [selection, setSelection] = useState<ComposerSelection>({
    start: 0,
    end: 0,
  });
  const [requestedSelection, setRequestedSelection] = useState<ComposerSelection | undefined>();
  const [isDeleteConfirmVisible, setIsDeleteConfirmVisible] = useState(false);
  const { data, isLoading, isRefetching, error, refetch } = useMessages(
    Number.isFinite(parsedThreadId) ? parsedThreadId : null,
    token
  );
  const [showSentNotice, setShowSentNotice] = useState(false);
  const [deleteErrorMessage, setDeleteErrorMessage] = useState('');

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
  const messages = normalizeMessages(threadItems, userId);
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

  useEffect(() => {
    if (!hasMessages) return;

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

  function applyComposerChange(nextText: string, nextSelection: ComposerSelection) {
    setMessage(nextText);
    setSelection(nextSelection);
    setRequestedSelection(nextSelection);

    requestAnimationFrame(() => {
      composerInputRef.current?.focus();
      requestAnimationFrame(() => {
        setRequestedSelection(undefined);
      });
    });
  }

  function handleFormatAction(action: Parameters<typeof applyComposerFormat>[2]) {
    if (replyToThreadMutation.isError) {
      replyToThreadMutation.reset();
    }

    const next = applyComposerFormat(message, selection, action);
    applyComposerChange(next.text, next.selection);
  }

  function handleEmojiPress(emoji: string) {
    if (replyToThreadMutation.isError) {
      replyToThreadMutation.reset();
    }

    const next = insertComposerText(message, selection, emoji);
    applyComposerChange(next.text, next.selection);
  }

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
          setSelection({ start: 0, end: 0 });
          setRequestedSelection(undefined);
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
          title: 'Conversation',
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

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 18 : 0}
      >
        <View style={{ flex: 1, paddingHorizontal: 16, paddingTop: 16 }}>
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
          <MessageFormattingToolbar
            disabled={replyToThreadMutation.isPending}
            onActionPress={handleFormatAction}
          />

          <MessageEmojiPicker
            disabled={replyToThreadMutation.isPending}
            onEmojiPress={handleEmojiPress}
          />

          <View
            style={{
              flexDirection: 'row',
              alignItems: 'flex-end',
              gap: 10,
              marginTop: 12,
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
              onSelectionChange={(event) => {
                setSelection(event.nativeEvent.selection);
              }}
              onKeyPress={(event) => {
                if (!shouldSendOnEnterPress(event) || !canSendReply) return;
                handleSendReply();
              }}
              placeholder="Type a message..."
              multiline
              editable={!replyToThreadMutation.isPending}
              selection={requestedSelection}
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
              disabled={!canSendReply}
              onPress={handleSendReply}
              style={{
                backgroundColor: canSendReply ? '#0284c7' : '#94a3b8',
                minHeight: 46,
                paddingHorizontal: 18,
                justifyContent: 'center',
                alignItems: 'center',
                borderRadius: 16,
              }}
            >
              <Text style={{ color: 'white', fontWeight: '700' }}>
                {replyToThreadMutation.isPending ? 'Sending...' : 'Send'}
              </Text>
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
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
