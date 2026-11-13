import assert from 'node:assert/strict';
import {
  betterMessagesError,
  betterMessagesTimeToIso,
  isPrivateBetterMessagesThread,
  mapBetterMessagesInbox,
  mapBetterMessagesSend,
  mapBetterMessagesThread,
} from '../lib/betterMessages.ts';

assert.equal(betterMessagesTimeToIso(1_700_000_000), '2023-11-14T22:13:20.000Z');
assert.equal(betterMessagesError({ errors: { friends: 'You can only message friends.' } }), 'You can only message friends.');
assert.equal(betterMessagesError({ result: true, thread_id: 4 }), null);
assert.equal(isPrivateBetterMessagesThread({ type: 'chat-room' }), false);
assert.equal(isPrivateBetterMessagesThread({ type: 'thread' }), true);

const inbox = mapBetterMessagesInbox({
  threads: [
    {
      thread_id: 9,
      type: 'thread',
      title: 'Sophie Coxon',
      subject: '',
      lastTime: 1_700_000_000,
      participants: [3, 8],
      unread: 2,
    },
    { thread_id: 10, type: 'chat-room', title: 'Lobby', participants: [3] },
  ],
  users: [
    { user_id: 8, name: 'Sophie Coxon', avatar: 'https://example.com/sophie.jpg' },
    { user_id: 3, name: 'Me', avatar: '' },
  ],
  messages: {
    '41': { message_id: 41, thread_id: 9, sender_id: 8, message: 'Hello from the website', created_at: 1_700_000_000 },
  },
});

assert.equal(inbox.length, 1);
assert.equal(inbox[0].thread_id, 9);
assert.equal(inbox[0].unread_count, 2);
assert.equal(inbox[0].message && typeof inbox[0].message === 'object' ? inbox[0].message.raw : '', 'Hello from the website');
const recipients = Array.isArray(inbox[0].recipients) ? inbox[0].recipients : [];
assert.equal(recipients[1]?.name, 'Sophie Coxon');

const thread = mapBetterMessagesThread({
  messages: [
    { message_id: 2, sender_id: 8, message: 'Second', created_at: 20 },
    { message_id: 1, sender_id: 3, message: 'First', created_at: 10 },
  ],
  users: [{ user_id: 8, name: 'Sophie Coxon', avatar: 'https://example.com/sophie.jpg' }],
}, 9);
const messages = Array.isArray(thread.messages) ? thread.messages : [];
assert.deepEqual(messages.map((item) => item.message_id), [1, 2]);
assert.equal(messages[0].date_sent, betterMessagesTimeToIso(10));

const sent = mapBetterMessagesSend(
  { result: true, message_id: 55, thread_id: 9, update: { messages: [{ message_id: 55, thread_id: 9, sender_id: 3, message: 'Sent', created_at: 30 }] } },
  { threadId: 9, message: 'Sent', senderId: 3 }
);
const sentMessages = Array.isArray(sent.messages) ? sent.messages : [];
assert.equal(sent.thread_id, 9);
assert.equal(sentMessages[0]?.sender_id, 3);
assert.equal(sentMessages[0]?.message && typeof sentMessages[0].message === 'object' ? sentMessages[0].message.raw : '', 'Sent');

console.log('ok - better messages mapping');
