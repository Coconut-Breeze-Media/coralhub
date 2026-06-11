import { useMemo, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  NativeSyntheticEvent,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TextInputKeyPressEventData,
  useWindowDimensions,
  FlatList,
  Pressable,
  View,
} from 'react-native';

import { SafeAreaView } from 'react-native-safe-area-context';
import { router, Stack } from 'expo-router';
import { useAuth } from '../../../lib/auth';
import { useMembersList } from '../../../hooks/useMembers';
import {
  useConversations,
  useReplyToThread,
  useSendMessage,
} from '../../../hooks/useMessages';
import type {
  BPMember,
  BPConversationSummary,
  BPConversationsResponse,
  BPMessageMutationResponse,
} from '../../../types';
import {
  applyComposerFormat,
  insertComposerText,
  MessageFormattingToolbar,
  type ComposerSelection,
} from '../../../components/MessageFormattingToolbar';
import { MessageEmojiPicker } from '../../../components/MessageEmojiPicker';
import { MessageNotice } from '../../../components/MessageNotice';
import {
  dedupeConversationSummaries,
  extractConversationParticipantNames,
  extractConversationParticipantUserIds,
  formatConversationTitle,
  getMessageTextValue,
} from '../../../lib/messagePresentation';

function getInitial(name: string): string {
  const safeName = name.trim();
  return safeName ? safeName[0].toUpperCase() : 'M';
}

function toNumberOrNull(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function getCreatedThreadId(response: BPMessageMutationResponse): number | null {
  const payload: Record<string, unknown> | null = Array.isArray(response)
    ? response[0] && typeof response[0] === 'object'
      ? (response[0] as Record<string, unknown>)
      : null
    : response && typeof response === 'object'
      ? (response as Record<string, unknown>)
      : null;

  const threadId =
    toNumberOrNull(payload?.thread_id) ??
    toNumberOrNull(payload?.id);

  if (threadId != null) return threadId;

  const nestedThread = (payload as Record<string, unknown> | undefined)?.thread;
  if (!nestedThread || typeof nestedThread !== 'object') return null;

  const nestedRecord = nestedThread as Record<string, unknown>;
  return (
    toNumberOrNull(nestedRecord.thread_id) ??
    toNumberOrNull(nestedRecord.id)
  );
}

type ExistingDirectConversation = {
  threadId: number;
  title: string;
  participantName: string;
};

function normalizeLookupKey(value: string): string {
  return value.trim().toLocaleLowerCase();
}

function getConversationItems(
  data: BPConversationsResponse | undefined
): BPConversationSummary[] {
  const rawItems = Array.isArray(data)
    ? data
    : !data
      ? []
      : Array.isArray(data.threads)
        ? data.threads
        : Array.isArray(data.messages)
          ? data.messages
          : Array.isArray(data.items)
            ? data.items
            : [];

  return rawItems.filter(
    (item): item is BPConversationSummary =>
      !!item && typeof item === 'object' && !Array.isArray(item)
  );
}

function getMemberItems(data: unknown): BPMember[] {
  if (!Array.isArray(data)) return [];

  return data.filter(
    (item): item is BPMember =>
      !!item &&
      typeof item === 'object' &&
      !Array.isArray(item) &&
      typeof (item as BPMember).id === 'number' &&
      typeof (item as BPMember).name === 'string'
  );
}

type ComposerKeyPressEvent = NativeSyntheticEvent<
  TextInputKeyPressEventData & { shiftKey?: boolean }
>;

function shouldSendOnEnterPress(event: ComposerKeyPressEvent): boolean {
  if (event.nativeEvent.key !== 'Enter') return false;
  if (event.nativeEvent.shiftKey) return false;

  event.preventDefault();
  return true;
}

export default function NewMessageScreen() {
  const { token, userId, profile } = useAuth();
  const { height: viewportHeight } = useWindowDimensions();

  const [search, setSearch] = useState('');
  const [selectedMember, setSelectedMember] = useState<BPMember | null>(null);
  const [message, setMessage] = useState('');
  const [selection, setSelection] = useState<ComposerSelection>({
    start: 0,
    end: 0,
  });
  const [requestedSelection, setRequestedSelection] = useState<ComposerSelection | undefined>();
  const composerInputRef = useRef<TextInput | null>(null);
  const sendMessageMutation = useSendMessage(token);
  const replyToThreadMutation = useReplyToThread(token);
  const isSending =
    sendMessageMutation.isPending || replyToThreadMutation.isPending;
  const { data: conversationsData } = useConversations(token);
  const { data, isLoading, error } = useMembersList(token, {
    search,
    page: 1,
    perPage: 20,
  });
  const members = getMemberItems(data);
  const conversations = dedupeConversationSummaries(
    getConversationItems(conversationsData),
    {
      excludeNames: [profile?.user_display_name],
      excludeUserIds: [userId],
    }
  );
  const canSend = !!selectedMember && !!message.trim() && !isSending;
  const trimmedSearch = search.trim();
  const isCompactHeight = viewportHeight < 820;
  const isVeryCompactHeight = viewportHeight < 700;
  const screenPadding = isCompactHeight ? 12 : 16;
  const sectionSpacing = isCompactHeight ? 12 : 16;
  const composerSpacing = isCompactHeight ? 10 : 12;
  const composerMinHeight = isVeryCompactHeight ? 72 : 96;
  const composerMaxHeight = isVeryCompactHeight ? 120 : 160;
  const existingConversationLookups = useMemo(() => {
    const byUserId = new Map<number, ExistingDirectConversation>();
    const byExactName = new Map<string, ExistingDirectConversation[]>();

    for (const conversation of conversations) {
      const threadId = toNumberOrNull(conversation.id ?? conversation.thread_id);
      if (threadId == null) continue;

      const participantIds = extractConversationParticipantUserIds(conversation, [userId]);
      const participantNames = extractConversationParticipantNames(conversation, {
        excludeNames: [profile?.user_display_name],
        excludeUserIds: [userId],
      });

      const hasSingleIdentifiableParticipant =
        participantIds.length === 1 || participantNames.length === 1;

      if (!hasSingleIdentifiableParticipant) {
        continue;
      }

      const title = formatConversationTitle(
        participantNames,
        conversation.subject,
        'Conversation'
      );
      const participantName =
        participantNames[0] || getMessageTextValue(conversation.subject) || title;
      const match: ExistingDirectConversation = {
        threadId,
        title,
        participantName,
      };

      if (participantIds.length === 1 && !byUserId.has(participantIds[0])) {
        byUserId.set(participantIds[0], match);
      }

      for (const candidate of [participantName, title]) {
        const key = normalizeLookupKey(candidate);
        if (!key) continue;

        const currentMatches = byExactName.get(key) ?? [];
        currentMatches.push(match);
        byExactName.set(key, currentMatches);
      }
    }

    return { byUserId, byExactName };
  }, [conversations, profile?.user_display_name, userId]);

  const findExistingConversationForMember = useMemo(
    () => (member: BPMember | null) => {
      if (!member) return null;
      if (!member.name?.trim()) return null;

      const byIdMatch = existingConversationLookups.byUserId.get(member.id);
      if (byIdMatch) return byIdMatch;

      const byNameMatches =
        existingConversationLookups.byExactName.get(
          normalizeLookupKey(member.name)
        ) ?? [];

      return byNameMatches.length === 1 ? byNameMatches[0] : null;
    },
    [existingConversationLookups]
  );

  const existingConversationForSelectedMember = useMemo(
    () => findExistingConversationForMember(selectedMember),
    [findExistingConversationForMember, selectedMember]
  );

  const emptyTitle = useMemo(
    () => (trimmedSearch ? 'No matching members' : 'No members to show'),
    [trimmedSearch]
  );
  const emptyDescription = useMemo(
    () =>
      trimmedSearch
        ? `We could not find anyone matching "${trimmedSearch}". Try another name or username.`
        : 'Start by searching for a member you want to message.',
    [trimmedSearch]
  );

  function resetComposerState() {
    setMessage('');
    setSelection({ start: 0, end: 0 });
    setRequestedSelection(undefined);
    setSelectedMember(null);
    setSearch('');
  }

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
    if (sendMessageMutation.isError) sendMessageMutation.reset();
    if (replyToThreadMutation.isError) replyToThreadMutation.reset();

    const next = applyComposerFormat(message, selection, action);
    applyComposerChange(next.text, next.selection);
  }

  function handleEmojiPress(emoji: string) {
    if (sendMessageMutation.isError) sendMessageMutation.reset();
    if (replyToThreadMutation.isError) replyToThreadMutation.reset();

    const next = insertComposerText(message, selection, emoji);
    applyComposerChange(next.text, next.selection);
  }

  function handleSendMessage() {
    if (!selectedMember || !message.trim() || isSending) return;
    const existingConversation = existingConversationForSelectedMember;

    if (existingConversation) {
      replyToThreadMutation.mutate(
        {
          threadId: existingConversation.threadId,
          message: message.trim(),
          recipients: [selectedMember.id],
        },
        {
          onSuccess: () => {
            resetComposerState();
            router.replace(`/messages/${existingConversation.threadId}`);
          },
        }
      );
      return;
    }

    sendMessageMutation.mutate(
      {
        recipients: [selectedMember.id],
        subject: selectedMember.name.trim() || 'Conversation',
        message: message.trim(),
      },
      {
        onSuccess: (response) => {
          const threadId = getCreatedThreadId(response);
          resetComposerState();

          if (threadId != null) {
            router.replace(`/messages/${threadId}?sent=1`);
            return;
          }

          router.replace('/messages?sent=1');
        },
      }
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f8fafc' }}>
      <Stack.Screen options={{ title: 'New Message' }} />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 18 : 0}
      >
        <View
          style={{
            flex: 1,
            minHeight: 0,
            paddingHorizontal: screenPadding,
            paddingTop: screenPadding,
            paddingBottom: screenPadding,
          }}
        >
          <Text
            style={{
              fontSize: isCompactHeight ? 20 : 22,
              fontWeight: '700',
              marginBottom: sectionSpacing,
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
              marginBottom: sectionSpacing,
              backgroundColor: '#ffffff',
            }}
          />

          <View style={{ flex: 1, minHeight: 0 }}>
            {isLoading && <Text>Loading members...</Text>}

            {error && <Text>Error loading members</Text>}

            <FlatList
              data={members}
              style={{ flex: 1, minHeight: 0 }}
              keyExtractor={(item) => item.id.toString()}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode={Platform.OS === 'ios' ? 'on-drag' : 'none'}
              contentContainerStyle={{
                paddingBottom: 12,
                flexGrow: members.length === 0 ? 1 : 0,
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
                        {trimmedSearch ? '?' : 'M'}
                      </Text>
                    </View>
                    <Text
                      style={{
                        fontWeight: '700',
                        color: '#0f172a',
                        marginBottom: 4,
                        fontSize: 17,
                        textAlign: 'center',
                      }}
                    >
                      {emptyTitle}
                    </Text>
                    <Text style={{ color: '#64748b', textAlign: 'center', lineHeight: 20 }}>
                      {emptyDescription}
                    </Text>
                  </View>
                ) : null
              }
              renderItem={({ item }) => {
                const isSelected = selectedMember?.id === item.id;
                const existingConversation = findExistingConversationForMember(item);

                return (
                  <Pressable
                    onPress={() => {
                      if (sendMessageMutation.isError) sendMessageMutation.reset();
                      if (replyToThreadMutation.isError) replyToThreadMutation.reset();

                      setSelectedMember(item);
                    }}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      padding: 14,
                      borderWidth: 1,
                      borderColor: isSelected ? '#0284c7' : '#e5e7eb',
                      backgroundColor: isSelected ? '#e0f2fe' : '#ffffff',
                      borderRadius: 16,
                      marginBottom: 12,
                      shadowColor: '#0f172a',
                      shadowOpacity: isSelected ? 0.08 : 0.04,
                      shadowRadius: 8,
                      shadowOffset: { width: 0, height: 3 },
                      elevation: 1,
                    }}
                  >
                    <View
                      style={{
                        width: 46,
                        height: 46,
                        borderRadius: 23,
                        backgroundColor: isSelected ? '#bae6fd' : '#e0f2fe',
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginRight: 12,
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 18,
                          fontWeight: '700',
                          color: '#0369a1',
                        }}
                      >
                        {getInitial(item.name)}
                      </Text>
                    </View>

                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text
                        numberOfLines={1}
                        style={{
                          fontWeight: '700',
                          color: '#0f172a',
                          fontSize: 16,
                          marginBottom: 2,
                        }}
                      >
                        {item.name}
                      </Text>
                      <Text
                        numberOfLines={1}
                        style={{
                          color: '#64748b',
                          fontSize: 13,
                        }}
                      >
                        {isSelected
                          ? existingConversation
                            ? 'Selected existing conversation'
                            : 'Selected recipient'
                          : existingConversation
                            ? 'Existing conversation will be reused'
                            : 'Tap to start a private message'}
                      </Text>
                    </View>
                  </Pressable>
                );
              }}
            />
          </View>

          {selectedMember && (
            <View
              style={{
                marginTop: composerSpacing,
                paddingTop: composerSpacing,
                borderTopWidth: 1,
                borderTopColor: '#e2e8f0',
                flexShrink: 1,
                minHeight: 0,
              }}
            >
              <ScrollView
                style={{ flexShrink: 1, minHeight: 0 }}
                contentContainerStyle={{ paddingBottom: 4 }}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
              >
                <View
                  style={{
                    borderWidth: 1,
                    borderColor: '#bae6fd',
                    backgroundColor: '#f0f9ff',
                    borderRadius: 14,
                    padding: isCompactHeight ? 12 : 14,
                    marginBottom: composerSpacing,
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
                  {!!existingConversationForSelectedMember && (
                    <Text style={{ marginTop: 6, color: '#0369a1', lineHeight: 20 }}>
                      Your message will be added to the existing conversation with this member.
                    </Text>
                  )}
                </View>

                <TextInput
                  ref={composerInputRef}
                  value={message}
                  onChangeText={(value) => {
                    if (sendMessageMutation.isError) sendMessageMutation.reset();
                    if (replyToThreadMutation.isError) replyToThreadMutation.reset();

                    setMessage(value);
                  }}
                  onSelectionChange={(event) => {
                    setSelection(event.nativeEvent.selection);
                  }}
                  onKeyPress={(event) => {
                    if (!shouldSendOnEnterPress(event) || !canSend) return;
                    handleSendMessage();
                  }}
                  placeholder="Type your message..."
                  multiline
                  editable={!isSending}
                  selection={requestedSelection}
                  textAlignVertical="top"
                  style={{
                    borderWidth: 1,
                    borderColor: '#d1d5db',
                    borderRadius: 14,
                    paddingHorizontal: 12,
                    paddingVertical: 12,
                    minHeight: composerMinHeight,
                    maxHeight: composerMaxHeight,
                    backgroundColor: '#ffffff',
                  }}
                />

                <MessageFormattingToolbar
                  disabled={isSending}
                  onActionPress={handleFormatAction}
                />

                <MessageEmojiPicker
                  disabled={isSending}
                  onEmojiPress={handleEmojiPress}
                />

                {(sendMessageMutation.isError || replyToThreadMutation.isError) && (
                  <MessageNotice
                    tone="error"
                    title="Could not send message"
                    description={
                      sendMessageMutation.error?.message ||
                      replyToThreadMutation.error?.message ||
                      'Please try again in a moment.'
                    }
                    onDismiss={() => {
                      sendMessageMutation.reset();
                      replyToThreadMutation.reset();
                    }}
                  />
                )}
              </ScrollView>

              <Pressable
                disabled={!canSend}
                onPress={handleSendMessage}
                style={{
                  backgroundColor: canSend ? '#0077b6' : '#94a3b8',
                  padding: 12,
                  borderRadius: 12,
                  marginTop: composerSpacing,
                  alignItems: 'center',
                }}
              >
                <Text style={{ color: 'white', fontWeight: '700' }}>
                  {isSending
                    ? 'Sending...'
                    : existingConversationForSelectedMember
                      ? 'Send Reply'
                      : 'Send Message'}
                </Text>
              </Pressable>
            </View>
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
