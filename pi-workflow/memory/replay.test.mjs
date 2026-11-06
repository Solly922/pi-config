import assert from 'node:assert/strict';
import { test } from 'node:test';

import { createReplayer } from './replay.mjs';

function fakeSession(initial = []) {
  const entries = [...initial];
  let next = entries.length;

  return {
    entries,
    getBranch: () => entries,
    appendMessage(message) {
      const id = `e${++next}`;
      entries.push({ type: 'message', id, message });
      return id;
    },
    appendCustomEntry(customType, data) {
      entries.push({ type: 'custom', id: `e${++next}`, customType, data });
    },
  };
}

function recorder() {
  const events = [];
  return { events, emit: async (event) => events.push(event) };
}

const user = (id, text, offset = 0) => ({ id, offset, message: { role: 'user', content: [{ type: 'text', text }] } });
const assistant = (id, block, offset = 0) => ({ id, offset, message: { role: 'assistant', content: [block], stopReason: 'stop' } });
const call = (callId) => ({ type: 'toolCall', id: callId, name: 'Bash', arguments: {} });
const result = (id, callId, offset = 0) => ({ id, offset, message: { role: 'toolResult', toolCallId: callId, toolName: 'Bash', content: [{ type: 'text', text: 'ok' }] } });

const conversation = [
  user('u1', 'list files'),
  assistant('a1', { type: 'thinking', thinking: 'two calls' }),
  assistant('a2', call('A')),
  assistant('a3', call('B')),
  result('r1', 'A'),
  result('r2', 'B'),
  assistant('a4', { type: 'text', text: 'done' }),
  { id: 't1', offset: 0, turnEnd: true },
];

test('one response written as several lines becomes one assistant message whose turn has all its results', async () => {
  const session = fakeSession();
  const { events, emit } = recorder();
  const replayer = createReplayer({ sessionManager: session, emit });

  for (const entry of conversation) await replayer.replay(entry);

  const messages = session.entries.filter((entry) => entry.type === 'message').map((entry) => entry.message);
  assert.deepEqual(messages.map((message) => message.role), ['user', 'assistant', 'toolResult', 'toolResult', 'assistant']);
  assert.deepEqual(messages[1].content.map((block) => block.type), ['thinking', 'toolCall', 'toolCall']);
  assert.equal(messages[1].stopReason, 'toolUse');
  assert.deepEqual(messages[1].nativeIds, ['a1', 'a2', 'a3']);

  const turns = events.filter((event) => event.type === 'turn_end');
  assert.equal(turns.length, 2);
  assert.deepEqual(turns[0].toolResults.map((message) => message.toolCallId), ['A', 'B']);
  assert.deepEqual(turns[1].toolResults, []);
  assert.deepEqual(events.map((event) => event.type).slice(-3), ['turn_end', 'agent_end', 'agent_settled']);
  assert.equal(events[0].type, 'agent_start');
});

test('replaying lines the session already holds changes nothing, even from a new replayer', async () => {
  const session = fakeSession();
  const first = createReplayer({ sessionManager: session, emit: async () => {} });
  for (const entry of conversation) await first.replay(entry);
  const stored = session.entries.length;

  const { events, emit } = recorder();
  const restarted = createReplayer({ sessionManager: session, emit });
  for (const entry of conversation) await restarted.replay(entry);

  assert.equal(session.entries.length, stored);
  assert.deepEqual(events, []);
});

test('a restart mid-turn picks the open turn back up and closes it with every result', async () => {
  const session = fakeSession();
  const before = createReplayer({ sessionManager: session, emit: async () => {} });
  for (const entry of conversation.slice(0, 5)) await before.replay(entry);

  const { events, emit } = recorder();
  const after = createReplayer({ sessionManager: session, emit });
  assert.equal(after.toolNames.get('B'), 'Bash');
  for (const entry of conversation.slice(5)) await after.replay(entry);

  const turn = events.find((event) => event.type === 'turn_end');
  assert.deepEqual(turn.toolResults.map((message) => message.toolCallId), ['A', 'B']);
});

test('the read position stays at an assistant response until it is stored', async () => {
  const replayer = createReplayer({ sessionManager: fakeSession(), emit: async () => {} });

  await replayer.replay(user('u1', 'hi', 0));
  await replayer.replay(assistant('a1', call('A'), 120));
  await replayer.replay(assistant('a2', call('B'), 260));
  assert.equal(replayer.pendingOffset(), 120);

  await replayer.replay(result('r1', 'A', 400));
  assert.equal(replayer.pendingOffset(), undefined);
});
