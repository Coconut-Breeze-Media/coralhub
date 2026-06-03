type MessageRecord = Record<string, unknown>;

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

export function stripMessageHtml(value: string): string {
  return normalizeWhitespace(value.replace(/<[^>]+>/g, ' '));
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
  if (typeof value === 'string') return normalizeWhitespace(stripMessageHtml(value));
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
      .map((item) => normalizeWhitespace(stripMessageHtml(item)))
      .filter(Boolean);
  }

  if (value && typeof value === 'object') {
    return Object.values(value)
      .filter((item): item is string => typeof item === 'string')
      .map((item) => normalizeWhitespace(stripMessageHtml(item)))
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
