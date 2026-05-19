import { useQuery, useMutation } from '@tanstack/react-query';

import {
  getConversations,
  getMessages,
  sendMessage,
} from '../lib/api';

export function useConversations(token: string | null) {
  return useQuery({
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
  return useQuery({
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
  return useMutation({
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
  });
}
export function useMarkConversationAsRead(token: string | null) {
  return useMutation({
    mutationFn: async (threadId: number) => {
      if (!token) throw new Error('No authentication token');

      return markConversationAsRead(threadId, token);
    },
  });
}