import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type {
  BPConversationsResponse,
  BPMessageThreadResult,
  BPMessageMutationResponse,
} from '../types';

import {
  getConversations,
  getMessages,
  sendMessage,
  replyToThread,
  markConversationAsRead,
} from '../lib/api';

export function useConversations(token: string | null) {
  return useQuery<BPConversationsResponse>({
    queryKey: ['messages', 'conversations'],
    queryFn: async () => {
      if (!token) throw new Error('No authentication token');
      return getConversations(token);
    },
    enabled: !!token,
  });
}

export function useMessages(
  threadId: number | null,
  token: string | null
) {
  return useQuery<BPMessageThreadResult>({
    queryKey: ['messages', threadId],
    queryFn: async () => {
      if (!token) throw new Error('No authentication token');
      if (!threadId) throw new Error('No thread ID');

      return getMessages(threadId, token);
    },
    enabled: !!token && !!threadId,
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
    mutationFn: async ({
      recipients,
      subject,
      message,
    }: {
      recipients: number[];
      subject: string;
      message: string;
    }) => {
      if (!token) throw new Error('No authentication token');

      return sendMessage(
        token,
        recipients,
        subject,
        message
      );
    },
    onSuccess: async () => {
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
    }
  >({
    mutationFn: async ({
      threadId,
      message,
    }: {
      threadId: number;
      message: string;
    }) => {
      if (!token) throw new Error('No authentication token');

      return replyToThread(token, threadId, message);
    },
    onSuccess: async (_data, variables) => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ['messages', variables.threadId],
          exact: true,
        }),
        queryClient.invalidateQueries({
          queryKey: ['messages', 'conversations'],
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
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ['messages', 'conversations'],
        exact: true,
      });
    },
  });
}
