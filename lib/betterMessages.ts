import type {
  BPConversationSummary,
  BPMessageItem,
  BPMessageParticipant,
  BPMessageText,
  BPMessageThreadResponse,
} from '../types';

/** Better Messages' own REST API, already installed on the site. */
export const BETTER_MESSAGES_API = '/better-messages/v1';

type BmUser = {
  id?: number | string;
  user_id?: number | string;
  name?: string;
  avatar?: string;
};

type BmMessage = {
  id?: number | string;
  message_id?: number | string;
  thread_id?: number | string;
  sender_id?: number | string;
  message?: string | BPMessageText;
  created_at?: number | string;
  updated_at?: number | string;
  date_sent?: string;
};

type BmThread = {
  thread_id?: number | string;
  id?: number | string;
  type?: string;
  title?: string;
  subject?: string | BPMessageText;
  lastTime?: number | string;
  participants?: Array<number | string | BmUser>;
  unread?: number | string;
  isDeleted?: number | string | boolean;
};

export type BmPayload = {
  threads?: BmThread[] | Record<string, BmThread>;
  thread?: BmThread;
  users?: BmUser[] | Record<string, BmUser>;
  messages?: BmMessage[] | Record<string, BmMessage>;
  update?: BmPayload;
  thread_id?: number | string;
  message_id?: number | string;
  result?: boolean;
  errors?: Record<string, unknown>;
};

function asList<T>(value: T[] | Record<string, T> | undefined | null): T[] {
  if (!value) return [];
  return Array.isArray(value) ? value : Object.values(value);
}

function asNumber(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function textField(value: unknown): BPMessageText {
  if (value && typeof value === 'object' && ('raw' in value || 'rendered' in value)) {
    const record = value as BPMessageText;
    return { raw: record.raw || record.rendered || '', rendered: record.rendered || record.raw || '' };
  }
  const text = typeof value === 'string' ? value : '';
  return { raw: text, rendered: text };
}

/** Better Messages stores times as unix seconds. */
export function betterMessagesTimeToIso(value: unknown): string {
  if (typeof value === 'string' && value.includes('-')) return value;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return '';
  const milliseconds = parsed > 1e12 ? parsed : parsed * 1000;
  return new Date(milliseconds).toISOString();
}

function usersById(users: BmPayload['users']): Map<number, BmUser> {
  const map = new Map<number, BmUser>();
  for (const user of asList(users)) {
    const id = asNumber(user.user_id ?? user.id);
    if (id != null) map.set(id, user);
  }
  return map;
}

function participant(userId: number, users: Map<number, BmUser>): BPMessageParticipant {
  const user = users.get(userId);
  const avatar = user?.avatar || '';
  return {
    id: userId,
    user_id: userId,
    name: user?.name || '',
    ...(avatar ? { user_avatars: { full: avatar, thumb: avatar } } : {}),
  };
}

function participantIds(thread: BmThread): number[] {
  const ids: number[] = [];
  for (const entry of thread.participants || []) {
    const id = typeof entry === 'object'
      ? asNumber(entry.user_id ?? entry.id)
      : asNumber(entry);
    if (id != null && id > 0) ids.push(id);
  }
  return ids;
}

function messageText(message: BmMessage | undefined): string {
  if (!message) return '';
  if (typeof message.message === 'string') return message.message;
  return message.message?.raw || message.message?.rendered || '';
}

export function betterMessagesError(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') return null;
  const record = payload as BmPayload;
  if (record.errors && typeof record.errors === 'object') {
    const messages = Object.values(record.errors).map(String).filter(Boolean);
    if (messages.length > 0) return messages.join(' ');
  }
  if (record.result === false) return 'Your message could not be sent.';
  return null;
}

export function isPrivateBetterMessagesThread(thread: BmThread): boolean {
  if (thread.isDeleted === 1 || thread.isDeleted === '1' || thread.isDeleted === true) return false;
  const type = (thread.type || 'thread').toLowerCase();
  return type !== 'chat-room';
}

function messagesForThread(messages: BmMessage[], threadId: number): BmMessage[] {
  return messages
    .filter((message) => {
      const id = asNumber(message.thread_id);
      // loadMore returns messages without repeating the thread id.
      return id == null || id === threadId;
    })
    .sort((a, b) => (asNumber(a.created_at) || 0) - (asNumber(b.created_at) || 0));
}

function toMessageItem(message: BmMessage): BPMessageItem {
  const id = asNumber(message.message_id ?? message.id) ?? undefined;
  const sent = betterMessagesTimeToIso(message.created_at ?? message.date_sent);
  return {
    id,
    message_id: id,
    sender_id: asNumber(message.sender_id) ?? undefined,
    message: textField(messageText(message)),
    date_sent: sent,
    date: sent,
  };
}

function toSummary(
  thread: BmThread,
  users: Map<number, BmUser>,
  messages: BmMessage[]
): BPConversationSummary | null {
  const threadId = asNumber(thread.thread_id ?? thread.id);
  if (threadId == null || !isPrivateBetterMessagesThread(thread)) return null;
  const threadMessages = messagesForThread(messages, threadId);
  const last = threadMessages[threadMessages.length - 1];
  const preview = messageText(last);
  const date = betterMessagesTimeToIso(thread.lastTime) || betterMessagesTimeToIso(last?.created_at);
  const subject = textField(thread.subject || thread.title || 'Conversation');
  return {
    id: threadId,
    thread_id: threadId,
    subject,
    excerpt: textField(preview),
    message: textField(preview),
    last_message_content: textField(preview),
    date,
    date_gmt: date,
    unread_count: asNumber(thread.unread) ?? 0,
    recipients: participantIds(thread).map((userId) => participant(userId, users)),
  };
}

/** Inbox from GET /better-messages/v1/threads. */
export function mapBetterMessagesInbox(payload: BmPayload): BPConversationSummary[] {
  const body = payload.update || payload;
  const users = usersById(body.users);
  const messages = asList(body.messages);
  return asList(body.threads)
    .map((thread) => toSummary(thread, users, messages))
    .filter((thread): thread is BPConversationSummary => thread != null);
}

/** One conversation from POST /better-messages/v1/thread/{id}. */
export function mapBetterMessagesThread(payload: BmPayload, threadId: number): BPMessageThreadResponse {
  const body = payload.update || payload;
  const users = usersById(body.users);
  const threads = asList(body.threads);
  const thread = threads.find((item) => asNumber(item.thread_id ?? item.id) === threadId) || body.thread || {};
  const messages = messagesForThread(asList(body.messages), threadId).map(toMessageItem);
  const ids = participantIds(thread);
  return {
    id: threadId,
    thread_id: threadId,
    subject: textField(thread.subject || thread.title || 'Conversation'),
    messages,
    recipients: (ids.length > 0 ? ids : [...users.keys()]).map((userId) => participant(userId, users)),
  };
}

/**
 * Send/reply answers are `{ result, message_id, update }` rather than a
 * BuddyPress message. Shape the new message so the open thread can append it.
 */
export function mapBetterMessagesSend(
  payload: BmPayload,
  draft: { threadId?: number; message: string; senderId?: number | null }
): BPMessageThreadResponse {
  const body = payload.update || payload;
  const messages = asList(body.messages);
  const sentId = asNumber(payload.message_id);
  const sent = messages.find((message) => asNumber(message.message_id ?? message.id) === sentId) || messages[messages.length - 1];
  const item = sent
    ? toMessageItem(sent)
    : {
        id: sentId ?? undefined,
        message_id: sentId ?? undefined,
        sender_id: draft.senderId ?? undefined,
        message: textField(draft.message),
        date_sent: new Date().toISOString(),
        date: new Date().toISOString(),
      };
  const threadId = asNumber(sent?.thread_id ?? payload.thread_id) ?? draft.threadId;
  return {
    id: threadId,
    thread_id: threadId,
    messages: item.id != null ? [item] : [],
  };
}
