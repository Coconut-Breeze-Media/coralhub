import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
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
  return useQuery<BPConversationsResponse>({
    queryKey: ['messages', 'conversations'],
    queryFn: async () => {
      if (!token) throw new Error('No authentication token');
      return getConversations(token);
    },
    enabled: !!token,
    staleTime: 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}

export function useMessages(threadId: number | null, token: string | null) {
  return useQuery<BPMessageThreadResult>({
    queryKey: ['messages', threadId],
    queryFn: async () => {
      if (!token) throw new Error('No authentication token');
      if (!threadId) throw new Error('No thread ID');

      return getMessages(threadId, token);
    },
    enabled: !!token && !!threadId,
    staleTime: 30 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
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

      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ['messages', 'conversations'],
          exact: true,
          refetchType: 'none',
        }),
        queryClient.invalidateQueries({
          predicate: (query) =>
            query.queryKey[0] === 'messages' &&
            typeof query.queryKey[1] === 'number',
          refetchType: 'none',
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
          refetchType: 'none',
        }),
        queryClient.invalidateQueries({
          queryKey: ['messages', variables.threadId],
          exact: true,
          refetchType: 'none',
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
          refetchType: 'none',
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
        queryClient.invalidateQueries({
          queryKey: ['messages', 'conversations'],
          exact: true,
          refetchType: 'none',
        }),
        queryClient.invalidateQueries({
          queryKey: ['messages', threadId],
          exact: true,
        }),
      ]);
    },
  });
}

export function useDeleteConversation(token: string | null) {
  const queryClient = useQueryClient();

  return useMutation<BPMessageDeleteResponse, Error, number>({
    mutationFn: async (threadId: number) => {
      if (!token) throw new Error('No authentication token');

      const response = await deleteConversation(threadId, token);

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
          refetchType: 'none',
        }),
        queryClient.removeQueries({
          queryKey: ['messages', threadId],
          exact: true,
        }),
      ]);
    },
  });
}
