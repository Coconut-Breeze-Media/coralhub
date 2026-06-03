import type {
  BPConversationSummary,
  BPConversationsResponse,
  BPMessageText,
} from '../types';

export interface UnreadMessageNotification {
  id: string;
  threadId: number;
  senderName: string;
  avatarUrl?: string;
  preview: string;
  createdAt: string;
  unreadCount: number;
}

function stripHtml(value: string) {
  return value.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function getTextValue(value?: string | BPMessageText): string {
  if (typeof value === 'string') return stripHtml(value);
  if (!value) return '';

  return stripHtml(value.rendered ?? value.raw ?? '');
}

function getNumberValue(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function getUnreadCount(value: unknown): number {
  return getNumberValue(value) ?? 0;
}

export function getConversationItems(
  data: BPConversationsResponse | undefined
): BPConversationSummary[] {
  if (Array.isArray(data)) return data;
  if (!data) return [];
  if (Array.isArray(data.threads)) return data.threads;
  if (Array.isArray(data.messages)) return data.messages;
  if (Array.isArray(data.items)) return data.items;
  return [];
}

export function getUnreadMessageNotifications(
  data: BPConversationsResponse | undefined,
  currentUserId: number | string | undefined
): UnreadMessageNotification[] {
  const userId = getNumberValue(currentUserId);
  if (!userId) return [];

  return getConversationItems(data).flatMap((conversation) => {
    const unreadCount = getUnreadCount(conversation.unread_count);
    const senderId = getNumberValue(conversation.last_sender_id);
    const threadId = getNumberValue(conversation.id ?? conversation.thread_id);

    if (!threadId || !senderId || unreadCount <= 0 || senderId === userId) return [];

    const sender = conversation.recipients?.find(
      (recipient) => getNumberValue(recipient.user_id) === senderId
    );

    const senderName = sender?.name?.trim() || 'Someone';
    const avatarUrl = sender?.user_avatars?.thumb || sender?.user_avatars?.full;
    const preview =
      getTextValue(conversation.excerpt) ||
      getTextValue(conversation.message) ||
      getTextValue(conversation.last_message_content) ||
      'Open the thread to read the latest message.';

    return [
      {
        id: `message-${threadId}`,
        threadId,
        senderName,
        avatarUrl,
        preview,
        createdAt:
          String(conversation.date_gmt || conversation.date || new Date().toISOString()),
        unreadCount,
      },
    ];
  });
}
