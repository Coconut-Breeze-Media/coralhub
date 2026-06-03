import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(process.cwd());
const envPath = path.join(repoRoot, '.env');

function loadDotEnv(filePath) {
  if (!existsSync(filePath)) return;

  const raw = readFileSync(filePath, 'utf8');
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const separatorIndex = trimmed.indexOf('=');
    if (separatorIndex === -1) continue;

    const key = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed.slice(separatorIndex + 1).trim();

    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}

function summarizeKeys(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return [];
  return Object.keys(value).sort();
}

function getCollection(value) {
  if (Array.isArray(value)) return value;
  if (value && typeof value === 'object') return Object.values(value);
  return [];
}

function getConversationItems(payload) {
  if (Array.isArray(payload)) return payload;
  if (!payload || typeof payload !== 'object') return [];
  if (Array.isArray(payload.threads)) return payload.threads;
  if (Array.isArray(payload.messages)) return payload.messages;
  if (Array.isArray(payload.items)) return payload.items;
  return [];
}

function getInterestingEntries(record) {
  if (!record || typeof record !== 'object') return {};

  const interestingKeys = [
    'id',
    'thread_id',
    'subject',
    'participants',
    'recipients',
    'users',
    'members',
    'participant_names',
    'recipient_names',
    'user_names',
    'sender',
    'sender_name',
    'display_name',
    'user_name',
    'last_message_content',
  ];

  const output = {};
  for (const key of interestingKeys) {
    if (key in record) {
      output[key] = record[key];
    }
  }

  return output;
}

async function fetchJson(url, token) {
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  const text = await response.text();
  let json = null;

  try {
    json = JSON.parse(text);
  } catch {
    json = null;
  }

  return {
    ok: response.ok,
    status: response.status,
    statusText: response.statusText,
    json,
    text,
  };
}

loadDotEnv(envPath);

const apiBase = process.env.EXPO_PUBLIC_WP_API;
const token = process.env.JWT_TOKEN;

if (!apiBase) {
  console.error('Missing EXPO_PUBLIC_WP_API in .env or environment.');
  process.exit(1);
}

if (!token) {
  console.error('Missing JWT_TOKEN. Example:');
  console.error('  $env:JWT_TOKEN="your_jwt_here"; node scripts/inspect-private-messaging.mjs');
  process.exit(1);
}

const listUrl = `${apiBase}/buddypress/v1/messages`;
const listResponse = await fetchJson(listUrl, token);

console.log('Messages list request');
console.log(JSON.stringify({
  url: listUrl,
  ok: listResponse.ok,
  status: listResponse.status,
  statusText: listResponse.statusText,
  topLevelKeys: summarizeKeys(listResponse.json),
}, null, 2));

if (!listResponse.ok) {
  console.log('Response body');
  console.log(listResponse.json ?? listResponse.text);
  process.exit(1);
}

const conversations = getConversationItems(listResponse.json);
const firstConversation = conversations[0];

console.log('Conversation sample');
console.log(JSON.stringify({
  totalConversations: conversations.length,
  firstConversationKeys: summarizeKeys(firstConversation),
  firstConversationInterestingFields: getInterestingEntries(firstConversation),
}, null, 2));

const threadId = firstConversation?.id ?? firstConversation?.thread_id;

if (!threadId) {
  console.log('No thread id available from the first conversation sample.');
  process.exit(0);
}

const threadUrl = `${apiBase}/buddypress/v1/messages/${threadId}`;
const threadResponse = await fetchJson(threadUrl, token);

console.log('Thread request');
console.log(JSON.stringify({
  url: threadUrl,
  ok: threadResponse.ok,
  status: threadResponse.status,
  statusText: threadResponse.statusText,
  topLevelKeys: summarizeKeys(threadResponse.json),
}, null, 2));

if (!threadResponse.ok) {
  console.log('Response body');
  console.log(threadResponse.json ?? threadResponse.text);
  process.exit(1);
}

const threadMessages = getCollection(
  threadResponse.json?.messages ??
    threadResponse.json?.items ??
    threadResponse.json?.thread?.messages ??
    threadResponse.json?.thread?.items
);

console.log('Thread sample');
console.log(JSON.stringify({
  threadInterestingFields: getInterestingEntries(threadResponse.json),
  nestedThreadInterestingFields: getInterestingEntries(threadResponse.json?.thread),
  messageCount: threadMessages.length,
  firstMessageKeys: summarizeKeys(threadMessages[0]),
  firstMessageInterestingFields: getInterestingEntries(threadMessages[0]),
}, null, 2));
