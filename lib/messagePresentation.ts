type MessageRecord = Record<string, unknown>;

const NAMED_HTML_ENTITIES: Record<string, string> = {
  amp: '&',
  apos: "'",
  gt: '>',
  lt: '<',
  nbsp: ' ',
  quot: '"',
};

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function normalizeMessageWhitespace(value: string): string {
  return value
    .replace(/\r\n?/g, '\n')
    .replace(/[^\S\n]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function decodeHtmlEntities(value: string): string {
  return value.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (match, entity) => {
    if (!entity) return match;

    if (entity.startsWith('#')) {
      const isHex = entity[1]?.toLowerCase() === 'x';
      const numericValue = isHex
        ? Number.parseInt(entity.slice(2), 16)
        : Number.parseInt(entity.slice(1), 10);

      if (!Number.isFinite(numericValue) || numericValue <= 0) {
        return match;
      }

      try {
        return String.fromCodePoint(numericValue);
      } catch {
        return match;
      }
    }

    return NAMED_HTML_ENTITIES[entity.toLowerCase()] ?? match;
  });
}

export function stripMessageHtml(value: string): string {
  const withLineBreaks = value
    .replace(/<\s*br\s*\/?>/gi, '\n')
    .replace(/<\s*li[^>]*>/gi, '- ')
    .replace(/<\/\s*(p|div|li|ul|ol|blockquote|h[1-6])\s*>/gi, '\n');

  return normalizeMessageWhitespace(
    decodeHtmlEntities(withLineBreaks.replace(/<[^>]+>/g, ' '))
  );
}

function shouldEncodeMessageCodePoint(codePoint: number): boolean {
  return (
    codePoint > 0xffff ||
    codePoint === 0x200d ||
    codePoint === 0xfe0f ||
    (codePoint >= 0x2600 && codePoint <= 0x27bf)
  );
}

export function encodeMessageForTransport(value: string): string {
  let encoded = '';

  for (const char of value) {
    const codePoint = char.codePointAt(0);

    if (codePoint == null) {
      encoded += char;
      continue;
    }

    encoded += shouldEncodeMessageCodePoint(codePoint)
      ? `&#${codePoint};`
      : char;
  }

  return encoded;
}

export function getMessageTextValue(value: unknown): string {
  if (typeof value === 'string') return stripMessageHtml(value);
  if (!value || typeof value !== 'object') return '';

  const record = value as MessageRecord;

  return (
    getMessageTextValue(record.raw) ||
    getMessageTextValue(record.rendered) ||
    getMessageTextValue(record.message) ||
    getMessageTextValue(record.content) ||
    ''
  );
}

function getNameValue(value: unknown): string {
  if (typeof value === 'string') {
    return normalizeWhitespace(decodeHtmlEntities(value.replace(/<[^>]+>/g, ' ')));
  }

  if (!value || typeof value !== 'object') return '';

  const record = value as MessageRecord;

  return normalizeWhitespace(
    getMessageTextValue(record.name) ||
      getMessageTextValue(record.display_name) ||
      getMessageTextValue(record.sender_name) ||
      getMessageTextValue(record.user_name) ||
      getMessageTextValue(record.username) ||
      getMessageTextValue(record.full_name) ||
      getMessageTextValue(record.label) ||
      ''
  );
}

function getObjectItems(value: unknown): MessageRecord[] {
  if (Array.isArray(value)) {
    return value.filter(
      (item): item is MessageRecord =>
        !!item && typeof item === 'object' && !Array.isArray(item)
    );
  }

  if (value && typeof value === 'object') {
    return Object.values(value).filter(
      (item): item is MessageRecord =>
        !!item && typeof item === 'object' && !Array.isArray(item)
    );
  }

  return [];
}

function getStringItems(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .filter((item): item is string => typeof item === 'string')
      .map((item) => normalizeWhitespace(decodeHtmlEntities(item.replace(/<[^>]+>/g, ' '))))
      .filter(Boolean);
  }

  if (value && typeof value === 'object') {
    return Object.values(value)
      .filter((item): item is string => typeof item === 'string')
      .map((item) => normalizeWhitespace(decodeHtmlEntities(item.replace(/<[^>]+>/g, ' '))))
      .filter(Boolean);
  }

  return [];
}

function getNumericItems(value: unknown): number[] {
  if (Array.isArray(value)) {
    return value
      .map((item) => toNumberOrNull(item))
      .filter((item): item is number => item != null);
  }

  if (value && typeof value === 'object') {
    return Object.values(value)
      .map((item) => toNumberOrNull(item))
      .filter((item): item is number => item != null);
  }

  return [];
}

function uniqueNames(values: string[]): string[] {
  const seen = new Set<string>();
  const unique: string[] = [];

  for (const value of values) {
    const normalized = normalizeWhitespace(value);
    if (!normalized) continue;

    const key = normalized.toLocaleLowerCase();
    if (seen.has(key)) continue;

    seen.add(key);
    unique.push(normalized);
  }

  return unique;
}

function uniqueNumbers(values: number[]): number[] {
  return Array.from(new Set(values));
}

function getExcludedNameSet(excludeNames: Array<string | null | undefined>): Set<string> {
  return new Set(
    excludeNames
      .map((value) => normalizeWhitespace(value ?? ''))
      .filter(Boolean)
      .map((value) => value.toLocaleLowerCase())
  );
}

function getExcludedIdSet(excludeUserIds: Array<number | null | undefined>): Set<number> {
  return new Set(
    excludeUserIds.filter(
      (value): value is number => typeof value === 'number' && Number.isFinite(value)
    )
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

function getConversationRecord(source: unknown): MessageRecord | null {
  if (!source || typeof source !== 'object' || Array.isArray(source)) {
    return null;
  }

  return source as MessageRecord;
}

function getTimestampValue(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    const asDate = new Date(value);
    return Number.isNaN(asDate.getTime()) ? value : asDate.getTime();
  }

  if (typeof value !== 'string' || !value.trim()) return null;

  const numericValue = Number(value);
  if (Number.isFinite(numericValue)) {
    const asDate = new Date(numericValue);
    return Number.isNaN(asDate.getTime()) ? numericValue : asDate.getTime();
  }

  const parsedDate = new Date(value);
  return Number.isNaN(parsedDate.getTime()) ? null : parsedDate.getTime();
}

function getUnreadCountValue(value: unknown): number {
  const parsed = toNumberOrNull(value);
  return parsed != null ? parsed : 0;
}

export function extractConversationParticipantNames(
  source: unknown,
  options: {
    excludeNames?: Array<string | null | undefined>;
    excludeUserIds?: Array<number | null | undefined>;
  } = {}
): string[] {
  if (!source || typeof source !== 'object') return [];

  const record = source as MessageRecord;
  const nestedThread =
    record.thread && typeof record.thread === 'object'
      ? (record.thread as MessageRecord)
      : undefined;
  const candidateCollections = [
    record.participants,
    record.recipients,
    record.users,
    record.members,
    record.participant_names,
    record.recipient_names,
    record.user_names,
    nestedThread?.participants,
    nestedThread?.recipients,
    nestedThread?.users,
    nestedThread?.members,
    nestedThread?.participant_names,
    nestedThread?.recipient_names,
    nestedThread?.user_names,
  ];
  const excludedNames = getExcludedNameSet(options.excludeNames ?? []);
  const excludedIds = getExcludedIdSet(options.excludeUserIds ?? []);
  const names: string[] = [];

  for (const candidate of candidateCollections) {
    for (const item of getObjectItems(candidate)) {
      const userId =
        toNumberOrNull(item.user_id) ??
        toNumberOrNull(item.id) ??
        toNumberOrNull((item.user as MessageRecord | undefined)?.id);
      const name =
        getNameValue(item) ||
        getNameValue(item.sender) ||
        getNameValue(item.user);

      if (!name) continue;
      if (userId != null && excludedIds.has(userId)) continue;
      if (excludedNames.has(name.toLocaleLowerCase())) continue;
      names.push(name);
    }

    for (const item of getStringItems(candidate)) {
      if (excludedNames.has(item.toLocaleLowerCase())) continue;
      names.push(item);
    }
  }

  return uniqueNames(names);
}

export function extractConversationParticipantUserIds(
  source: unknown,
  excludeUserIds: Array<number | null | undefined> = []
): number[] {
  if (!source || typeof source !== 'object') return [];

  const record = source as MessageRecord;
  const nestedThread =
    record.thread && typeof record.thread === 'object'
      ? (record.thread as MessageRecord)
      : undefined;
  const candidateCollections = [
    record.participants,
    record.recipients,
    record.users,
    record.members,
    record.sender_ids,
    nestedThread?.participants,
    nestedThread?.recipients,
    nestedThread?.users,
    nestedThread?.members,
    nestedThread?.sender_ids,
  ];
  const excludedIds = getExcludedIdSet(excludeUserIds);
  const userIds: number[] = [];

  for (const candidate of candidateCollections) {
    for (const item of getObjectItems(candidate)) {
      const userId =
        toNumberOrNull(item.user_id) ??
        toNumberOrNull(item.id) ??
        toNumberOrNull((item.user as MessageRecord | undefined)?.id);

      if (userId != null && !excludedIds.has(userId)) {
        userIds.push(userId);
      }
    }

    for (const userId of getNumericItems(candidate)) {
      if (!excludedIds.has(userId)) {
        userIds.push(userId);
      }
    }
  }

  return uniqueNumbers(userIds);
}

export function getConversationThreadId(source: unknown): number | null {
  const record = getConversationRecord(source);
  if (!record) return null;

  return (
    toNumberOrNull(record.id) ??
    toNumberOrNull(record.thread_id) ??
    toNumberOrNull((record.thread as MessageRecord | undefined)?.id) ??
    toNumberOrNull((record.thread as MessageRecord | undefined)?.thread_id)
  );
}

export function getConversationSortValue(source: unknown): number {
  const record = getConversationRecord(source);
  if (!record) return Number.NEGATIVE_INFINITY;

  const nestedThread =
    record.thread && typeof record.thread === 'object' && !Array.isArray(record.thread)
      ? (record.thread as MessageRecord)
      : undefined;
  const candidates = [
    record.last_message_date,
    record.last_message_date_gmt,
    record.date_sent,
    record.date,
    record.date_gmt,
    record.created_at,
    record.updated_at,
    record.modified,
    record.last_activity,
    nestedThread?.last_message_date,
    nestedThread?.last_message_date_gmt,
    nestedThread?.date_sent,
    nestedThread?.date,
    nestedThread?.date_gmt,
    nestedThread?.created_at,
    nestedThread?.updated_at,
    nestedThread?.modified,
  ];

  for (const candidate of candidates) {
    const timestamp = getTimestampValue(candidate);
    if (timestamp != null) return timestamp;
  }

  return getConversationThreadId(source) ?? Number.NEGATIVE_INFINITY;
}

export function getDirectConversationKey(
  source: unknown,
  options: {
    excludeNames?: Array<string | null | undefined>;
    excludeUserIds?: Array<number | null | undefined>;
  } = {}
): string | null {
  const participantUserIds = extractConversationParticipantUserIds(
    source,
    options.excludeUserIds ?? []
  );
  const participantNames = extractConversationParticipantNames(source, options);

  if (participantUserIds.length > 1 || participantNames.length > 1) {
    return null;
  }

  if (participantUserIds.length === 1) {
    return `user:${participantUserIds[0]}`;
  }

  if (participantNames.length === 1) {
    return `name:${participantNames[0].toLocaleLowerCase()}`;
  }

  return null;
}

export function dedupeConversationSummaries<T extends object>(
  items: T[],
  options: {
    excludeNames?: Array<string | null | undefined>;
    excludeUserIds?: Array<number | null | undefined>;
  } = {}
): T[] {
  const directConversations = new Map<
    string,
    {
      conversation: T;
      unreadCount: number;
      index: number;
    }
  >();
  const passthrough: Array<{ conversation: T; index: number }> = [];

  items.forEach((item, index) => {
    const dedupeKey = getDirectConversationKey(item, options);

    if (!dedupeKey) {
      passthrough.push({ conversation: item, index });
      return;
    }

    const existing = directConversations.get(dedupeKey);
    const itemUnreadCount = getUnreadCountValue(
      getConversationRecord(item)?.unread_count
    );

    if (!existing) {
      directConversations.set(dedupeKey, {
        conversation: item,
        unreadCount: itemUnreadCount,
        index,
      });
      return;
    }

    const keepIncoming =
      getConversationSortValue(item) > getConversationSortValue(existing.conversation);
    const preferredConversation = keepIncoming ? item : existing.conversation;
    const preferredIndex = keepIncoming ? index : existing.index;
    const mergedUnreadCount = existing.unreadCount + itemUnreadCount;
    const preferredConversationRecord = getConversationRecord(preferredConversation);
    const mergedConversation =
      getUnreadCountValue(preferredConversationRecord?.unread_count) ===
      mergedUnreadCount
        ? preferredConversation
        : ({
            ...preferredConversation,
            unread_count: mergedUnreadCount,
          } as T);

    directConversations.set(dedupeKey, {
      conversation: mergedConversation,
      unreadCount: mergedUnreadCount,
      index: preferredIndex,
    });
  });

  return [
    ...passthrough,
    ...Array.from(directConversations.values()).map((entry) => ({
      conversation: entry.conversation,
      index: entry.index,
    })),
  ]
    .sort((left, right) => {
      const sortDelta =
        getConversationSortValue(right.conversation) -
        getConversationSortValue(left.conversation);

      if (sortDelta !== 0) return sortDelta;

      return left.index - right.index;
    })
    .map((entry) => entry.conversation);
}

export function extractParticipantNamesFromMessages(
  items: MessageRecord[],
  options: {
    currentUserId?: number | null;
    currentUserDisplayName?: string | null;
  } = {}
): string[] {
  const excluded = getExcludedNameSet([options.currentUserDisplayName]);
  const names: string[] = [];

  for (const item of items) {
    const senderId =
      toNumberOrNull(item.sender_id) ??
      toNumberOrNull(item.user_id) ??
      toNumberOrNull((item.sender as MessageRecord | undefined)?.id);
    const senderName =
      getNameValue(item.sender_name) ||
      getNameValue(item.display_name) ||
      getNameValue(item.user_name) ||
      getNameValue(item.sender);

    if (!senderName) continue;
    if (options.currentUserId != null && senderId === options.currentUserId) continue;
    if (excluded.has(senderName.toLocaleLowerCase())) continue;

    names.push(senderName);
  }

  return uniqueNames(names);
}

export function formatConversationTitle(
  participantNames: string[],
  fallbackTitle?: unknown,
  defaultTitle = 'Conversation'
): string {
  const safeNames = uniqueNames(participantNames);

  if (safeNames.length === 1) return safeNames[0];
  if (safeNames.length === 2) return `${safeNames[0]} and ${safeNames[1]}`;
  if (safeNames.length > 2) {
    return `${safeNames[0]}, ${safeNames[1]}, +${safeNames.length - 2}`;
  }

  return getMessageTextValue(fallbackTitle) || defaultTitle;
}
