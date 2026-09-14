import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type InfiniteData,
} from '@tanstack/react-query';
import type {
  BPConversationsResponse,
  BPConversationSummary,
  BPMessageThreadResult,
  BPMessageMutationResponse,
  BPMessageDeleteResponse,
} from '../types';

import {
  deleteConversation,
  getConversations,
  getMessages,
  markConversationAsRead,
  replyToConversation,
  replyToThread,
  sendMessage,
} from '../lib/api';
import { useAuth } from '../lib/auth';

const MESSAGE_PAGE_SIZE = 20;

function getThreadMessageCount(data: BPMessageThreadResult): number {
  const thread = Array.isArray(data) ? data[0] : data;
  if (!thread || typeof thread !== 'object' || Array.isArray(thread)) return 0;

  const messages = (thread as { messages?: unknown }).messages;
  if (Array.isArray(messages)) return messages.length;
  if (messages && typeof messages === 'object') return Object.keys(messages).length;
  return 0;
}

function toNumberOrNull(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
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

function setConversationItems(
  currentData: BPConversationsResponse | undefined,
  items: BPConversationSummary[]
): BPConversationsResponse {
  if (Array.isArray(currentData) || !currentData) {
    return items;
  }

  if (Array.isArray(currentData.threads)) {
    return {
      ...currentData,
      threads: items,
    };
  }

  if (Array.isArray(currentData.messages)) {
    return {
      ...currentData,
      messages: items,
    };
  }

  if (Array.isArray(currentData.items)) {
    return {
      ...currentData,
      items,
    };
  }

  return items;
}

/**
 * BuddyPress serves thread dates in site-local time without a timezone suffix
 * (e.g. "2026-09-14T10:10:52"), which `new Date()` parses as local time. Match that
 * shape so an optimistically inserted thread sorts against real ones correctly.
 */
function getLocalTimestamp(): string {
  const now = new Date();
  const pad = (value: number) => String(value).padStart(2, '0');

  return (
    `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}` +
    `T${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`
  );
}

function getRecordItems(value: unknown): Record<string, unknown>[] {
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
    return firstItem && typeof firstItem === 'object' && !Array.isArray(firstItem)
      ? (firstItem as Record<string, unknown>)
      : null;
  }

  if (data && typeof data === 'object') {
    return data as Record<string, unknown>;
  }

  return null;
}

function getThreadMessageItems(data: unknown): Record<string, unknown>[] {
  const record = unwrapThreadRecord(data);
  if (!record) return [];

  const nestedThread = record.thread as Record<string, unknown> | undefined;
  const candidates = [
    record.messages,
    nestedThread?.messages,
    record.items,
    nestedThread?.items,
  ];

  for (const candidate of candidates) {
    const items = getRecordItems(candidate);
    if (items.length > 0) return items;
  }

  return [];
}

/**
 * A reply POST returns a message (or a thin thread stub), never a full page-1
 * payload. Pull the new message(s) out so they can be appended to the cached
 * thread instead of replacing it.
 */
function extractMessageItemsFromMutation(
  response: BPMessageMutationResponse
): Record<string, unknown>[] {
  const payload = getMutationPayload(response);
  if (!payload) return [];

  const nestedMessages = getThreadMessageItems(payload);
  if (nestedMessages.length > 0) return nestedMessages;

  // Only treat the payload itself as a message when it actually looks like one.
  // A thread payload also carries a top-level `message` (its last-message excerpt),
  // and inserting it would render the reply as an unattributed incoming bubble
  // keyed by the thread id.
  const looksLikeThread =
    payload.recipients != null || payload.messages != null || payload.participants != null;
  const looksLikeMessage =
    (payload.message != null || payload.content != null) &&
    (payload.sender_id != null || payload.date_sent != null);

  return !looksLikeThread && looksLikeMessage ? [payload] : [];
}

/**
 * Append the sent message to page 1 while preserving that page's thread metadata
 * (subject, recipients, participants). Overwriting page 1 with the mutation stub
 * wipes `recipients`, which locks the composer with "could not resolve recipients".
 */
function appendMessageToThreadCache(
  currentData: InfiniteData<BPMessageThreadResult, number> | undefined,
  response: BPMessageMutationResponse
): InfiniteData<BPMessageThreadResult, number> | undefined {
  if (!currentData || currentData.pages.length === 0) return currentData;

  const newMessages = extractMessageItemsFromMutation(response);
  if (newMessages.length === 0) return currentData;

  const [firstPage, ...restPages] = currentData.pages;
  const firstThread = unwrapThreadRecord(firstPage);
  if (!firstThread) return currentData;

  const messagesById = new Map<string, Record<string, unknown>>();
  for (const item of [...getThreadMessageItems(firstPage), ...newMessages]) {
    const messageId = item.id ?? item.message_id;
    // The thread screen drops id-less messages when it merges pages, so keeping one
    // here would write a message to the cache that never renders. Skip it and let
    // the invalidation refetch below bring in the server copy.
    if (messageId == null) continue;
    messagesById.set(String(messageId), item);
  }

  if (messagesById.size === 0) return currentData;

  const mergedPage = {
    ...firstThread,
    messages: Array.from(messagesById.values()),
  } as BPMessageThreadResult;

  return {
    ...currentData,
    pages: [mergedPage, ...restPages],
  };
}

function getMutationPayload(
  response: BPMessageMutationResponse
): Record<string, unknown> | null {
  if (Array.isArray(response)) {
    const firstItem = response[0];
    return firstItem && typeof firstItem === 'object' && !Array.isArray(firstItem)
      ? (firstItem as Record<string, unknown>)
      : null;
  }

  return response && typeof response === 'object' && !Array.isArray(response)
    ? (response as Record<string, unknown>)
    : null;
}

function buildConversationSummaryFromMutation(
  response: BPMessageMutationResponse,
  fallback: {
    recipients: number[];
    subject?: string;
    message: string;
  }
): BPConversationSummary | null {
  const payload = getMutationPayload(response);
  const nestedThread =
    payload?.thread && typeof payload.thread === 'object' && !Array.isArray(payload.thread)
      ? (payload.thread as Record<string, unknown>)
      : null;

  const threadId =
    toNumberOrNull(payload?.thread_id) ??
    toNumberOrNull(payload?.id) ??
    toNumberOrNull(nestedThread?.thread_id) ??
    toNumberOrNull(nestedThread?.id);

  if (threadId == null) return null;

  return {
    ...(nestedThread as BPConversationSummary | null),
    ...(payload as BPConversationSummary | null),
    id: threadId,
    thread_id: threadId,
    // Without a date this summary has no sort value and drops to the bottom of
    // the conversation list instead of appearing at the top.
    date:
      (payload?.date as string | undefined) ??
      (payload?.date_sent as string | undefined) ??
      (nestedThread?.date as string | undefined) ??
      getLocalTimestamp(),
    subject:
      (payload?.subject as BPConversationSummary['subject']) ??
      (nestedThread?.subject as BPConversationSummary['subject']) ??
      fallback.subject ??
      'Conversation',
    last_message_content:
      (payload?.last_message_content as BPConversationSummary['last_message_content']) ??
      (nestedThread?.last_message_content as BPConversationSummary['last_message_content']) ??
      (payload?.message as BPConversationSummary['last_message_content']) ??
      (nestedThread?.message as BPConversationSummary['last_message_content']) ??
      fallback.message,
    recipients:
      (payload?.recipients as BPConversationSummary['recipients']) ??
      (nestedThread?.recipients as BPConversationSummary['recipients']) ??
      fallback.recipients.map((recipientId) => ({
        user_id: recipientId,
      })),
  };
}

function upsertConversationSummary(
  currentData: BPConversationsResponse | undefined,
  nextConversation: BPConversationSummary
): BPConversationsResponse {
  const nextThreadId = toNumberOrNull(
    nextConversation.id ?? nextConversation.thread_id
  );
  const currentItems = getConversationItems(currentData);
  const existingIndex = currentItems.findIndex((item) => {
    const itemThreadId = toNumberOrNull(item.id ?? item.thread_id);
    return nextThreadId != null && itemThreadId === nextThreadId;
  });

  if (existingIndex === -1) {
    return setConversationItems(currentData, [nextConversation, ...currentItems]);
  }

  const currentConversation = currentItems[existingIndex];
  const mergedConversation: BPConversationSummary = {
    ...currentConversation,
    ...nextConversation,
  };
  const nextItems = [...currentItems];
  nextItems.splice(existingIndex, 1);
  nextItems.unshift(mergedConversation);

  return setConversationItems(currentData, nextItems);
}

function removeConversationSummary(
  currentData: BPConversationsResponse | undefined,
  threadId: number
): BPConversationsResponse {
  const nextItems = getConversationItems(currentData).filter((item) => {
    const itemThreadId = toNumberOrNull(item.id ?? item.thread_id);
    return itemThreadId !== threadId;
  });

  return setConversationItems(currentData, nextItems);
}

export function useConversations(token: string | null) {
  const { userId } = useAuth();

  return useQuery<BPConversationsResponse>({
    queryKey: ['messages', 'conversations'],
    queryFn: async () => {
      if (!token) throw new Error('No authentication token');
      return getConversations(token, userId);
    },
    enabled: !!token,
    staleTime: 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}

export function useMessages(threadId: number | null, token: string | null) {
  const { userId } = useAuth();

  return useInfiniteQuery<BPMessageThreadResult, Error, InfiniteData<BPMessageThreadResult>, readonly unknown[], number>({
    queryKey: ['messages', threadId],
    queryFn: async ({ pageParam }) => {
      if (!token) throw new Error('No authentication token');
      if (!threadId) throw new Error('No thread ID');

      return getMessages(threadId, token, pageParam, MESSAGE_PAGE_SIZE, userId);
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage, allPages) =>
      // `>=`, not `===`: an optimistically appended reply can push page 1 past the
      // page size, which would otherwise disable "load earlier messages".
      getThreadMessageCount(lastPage) >= MESSAGE_PAGE_SIZE
        ? allPages.length + 1
        : undefined,
    enabled: !!token && !!threadId,
    staleTime: 30 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
    // Opening a thread must always pull fresh messages, otherwise replies sent from
    // the website inside the staleTime window never appear.
    refetchOnMount: 'always',
  });
}

export function useSendMessage(token: string | null) {
  const queryClient = useQueryClient();

  return useMutation<
    BPMessageMutationResponse,
    Error,
    {
      recipients: number[];
      subject: string;
      message: string;
    }
  >({
    mutationFn: async ({ recipients, subject, message }) => {
      if (!token) throw new Error('No authentication token');

      return sendMessage(token, recipients, subject, message);
    },
    onSuccess: async (data, variables) => {
      const nextConversation = buildConversationSummaryFromMutation(data, variables);

      if (nextConversation) {
        queryClient.setQueryData<BPConversationsResponse | undefined>(
          ['messages', 'conversations'],
          (currentData) => upsertConversationSummary(currentData, nextConversation)
        );
      }

      // These must actually refetch. The optimistic summary above lives only in
      // memory, so without a real refetch the sent message is never reconciled
      // with the server and disappears on the next cold start.
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ['messages', 'conversations'],
          exact: true,
        }),
        queryClient.invalidateQueries({
          predicate: (query) =>
            query.queryKey[0] === 'messages' &&
            typeof query.queryKey[1] === 'number',
        }),
      ]);
    },
  });
}

export function useReplyToThread(token: string | null) {
  const queryClient = useQueryClient();

  return useMutation<
    BPMessageMutationResponse,
    Error,
    {
      threadId: number;
      message: string;
      recipients: number[];
    }
  >({
    mutationFn: async ({ threadId, message, recipients }) => {
      if (!token) throw new Error('No authentication token');

      return replyToThread(token, threadId, message, recipients);
    },
    onSuccess: async (data, variables) => {
      queryClient.setQueryData<InfiniteData<BPMessageThreadResult, number>>(
        ['messages', variables.threadId],
        (currentData) => appendMessageToThreadCache(currentData, data) ?? currentData
      );

      const nextConversation = buildConversationSummaryFromMutation(data, {
        recipients: variables.recipients,
        message: variables.message,
      });

      if (nextConversation) {
        queryClient.setQueryData<BPConversationsResponse | undefined>(
          ['messages', 'conversations'],
          (currentData) => upsertConversationSummary(currentData, nextConversation)
        );
      }

      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ['messages', 'conversations'],
          exact: true,
        }),
        queryClient.invalidateQueries({
          queryKey: ['messages', variables.threadId],
          exact: true,
        }),
      ]);
    },
  });
}

export function useReplyToConversation(token: string | null) {
  const queryClient = useQueryClient();

  return useMutation<
    BPMessageMutationResponse,
    Error,
    {
      threadId: number;
      message: string;
    }
  >({
    mutationFn: async ({ threadId, message }) => {
      if (!token) throw new Error('No authentication token');

      return replyToConversation(token, threadId, message);
    },
    onSuccess: async (_data, variables) => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ['messages', 'conversations'],
          exact: true,
        }),
        queryClient.invalidateQueries({
          queryKey: ['messages', variables.threadId],
          exact: true,
        }),
      ]);
    },
  });
}

export function useMarkConversationAsRead(token: string | null) {
  const queryClient = useQueryClient();

  return useMutation<BPMessageMutationResponse, Error, number>({
    mutationFn: async (threadId: number) => {
      if (!token) throw new Error('No authentication token');

      return markConversationAsRead(threadId, token);
    },
    onSuccess: async (_data, threadId) => {
      await Promise.all([
        // Must refetch, otherwise the unread badge never clears.
        queryClient.invalidateQueries({
          queryKey: ['messages', 'conversations'],
          exact: true,
        }),
        // The thread itself was just fetched to render this screen; marking it read
        // does not change its messages, so avoid a redundant second round trip.
        queryClient.invalidateQueries({
          queryKey: ['messages', threadId],
          exact: true,
          refetchType: 'none',
        }),
      ]);
    },
  });
}

export function useDeleteConversation(token: string | null) {
  const queryClient = useQueryClient();
  const { userId } = useAuth();

  return useMutation<BPMessageDeleteResponse, Error, number>({
    mutationFn: async (threadId: number) => {
      if (!token) throw new Error('No authentication token');

      const response = await deleteConversation(threadId, token, userId);

      if (response.deleted === false) {
        throw new Error('Could not delete the conversation.');
      }

      return response;
    },
    onSuccess: async (_data, threadId) => {
      queryClient.setQueryData<BPConversationsResponse | undefined>(
        ['messages', 'conversations'],
        (currentData) => removeConversationSummary(currentData, threadId)
      );

      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ['messages', 'conversations'],
          exact: true,
        }),
        queryClient.removeQueries({
          queryKey: ['messages', threadId],
          exact: true,
        }),
      ]);
    },
  });
}
