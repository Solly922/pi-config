import assert from 'node:assert/strict';
import { appendFileSync, mkdtempSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { readTranscript } from './transcript.mjs';

const timestamp = '2026-11-06T12:00:00.000Z';
const epoch = Date.parse(timestamp);

function fixture(t, rows = []) {
  const dir = mkdtempSync(join(tmpdir(), 'pi-transcript-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));

  const path = join(dir, 'session.jsonl');
  writeFileSync(path, rows.map(row => JSON.stringify(row) + '\n').join(''));
  return path;
}

function claude(uuid, type, content, message = {}, fields = {}) {
  return { uuid, type, timestamp, isSidechain: false, message: { role: type, content, ...message }, ...fields };
}

function codex(ordinal, payload, type = 'response_item') {
  return { ordinal, timestamp, type, payload };
}

function checkAssistant(message, provider, model, stopReason) {
  assert.equal(message.role, 'assistant');
  assert.equal(message.api, 'native');
  assert.equal(message.provider, provider);
  assert.equal(message.model, model);
  assert.equal(message.stopReason, stopReason);
  assert.equal(message.timestamp, epoch);
  assert.deepEqual(message.usage, {
    input: 0, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: 0,
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
  });
}

test('Claude conversation preserves pi shapes, tool pairing, split message IDs and turn end', t => {
  const path = fixture(t, [
    claude('u', 'user', 'Find the answer'),
    claude('thinking', 'assistant', [{ type: 'thinking', thinking: 'Look it up' }, { type: 'redacted_thinking', data: 'secret' }], { id: 'same-api-id', model: 'claude-test', stop_reason: 'tool_use' }),
    claude('call', 'assistant', [{ type: 'text', text: '' }, { type: 'tool_use', id: 'c1', name: 'Read', input: { path: '/answer' } }], { id: 'same-api-id', model: 'claude-test', stop_reason: 'tool_use' }),
    claude('result', 'user', [{ type: 'tool_result', tool_use_id: 'c1', content: [{ type: 'text', text: '42' }, { type: 'image', source: { data: 'not text' } }], is_error: false }]),
    claude('answer', 'assistant', [{ type: 'text', text: 'The answer is 42' }], { model: 'claude-test', stop_reason: 'end_turn' }),
  ]);

  const { entries, offset } = readTranscript('claude', path);
  assert.equal(offset, statSync(path).size);
  assert.deepEqual(entries.map(entry => entry.id), ['u', 'thinking', 'call', 'result', 'answer:0', 'answer:1']);
  assert.deepEqual(entries[0].message, { role: 'user', content: [{ type: 'text', text: 'Find the answer' }], timestamp: epoch });
  checkAssistant(entries[1].message, 'claude-code', 'claude-test', 'stop');
  assert.deepEqual(entries[1].message.content, [{ type: 'thinking', thinking: 'Look it up' }]);
  checkAssistant(entries[2].message, 'claude-code', 'claude-test', 'toolUse');
  assert.deepEqual(entries[2].message.content, [{ type: 'toolCall', id: 'c1', name: 'Read', arguments: { path: '/answer' } }]);
  assert.deepEqual(entries[3].message, {
    role: 'toolResult', toolCallId: 'c1', toolName: 'Read', content: [{ type: 'text', text: '42\n[image]' }], isError: false, timestamp: epoch,
  });
  checkAssistant(entries[4].message, 'claude-code', 'claude-test', 'stop');
  assert.deepEqual(entries[5], { id: 'answer:1', offset: entries[4].offset, turnEnd: true });
  assert.deepEqual(readTranscript('claude', path), { entries, offset });
});

test('Claude skips sidechains, meta and non-message types; keeps mixed user blocks and error results', t => {
  const path = fixture(t, [
    claude('side', 'user', 'sidechain', {}, { isSidechain: true }),
    claude('meta', 'user', 'meta', {}, { isMeta: true }),
    claude('absent', 'user', 'no explicit main chain', {}, { isSidechain: undefined }),
    ...['attachment', 'queue-operation', 'mode', 'last-prompt', 'summary', 'system'].map(type => ({ type })),
    claude('empty', 'user', '   '),
    claude('mixed', 'user', [
      { type: 'tool_result', tool_use_id: 'earlier', content: 'failure', is_error: true },
      { type: 'text', text: 'Try again' },
      { type: 'text', text: 'please' },
      { type: 'tool_result', tool_use_id: 'other', content: [{ type: 'text', text: 'other result' }] },
    ]),
    claude('redacted', 'assistant', [{ type: 'redacted_thinking', data: 'hidden' }]),
    claude('stop', 'assistant', [{ type: 'text', text: 'done' }], { stop_reason: 'stop_sequence' }),
    claude('not-end', 'assistant', [{ type: 'tool_use', id: 'new', name: 'Read', input: {} }], { stop_reason: 'end_turn' }),
  ]);

  const { entries } = readTranscript('claude', path);
  assert.deepEqual(entries.map(entry => entry.message?.role ?? 'turnEnd'), ['toolResult', 'user', 'toolResult', 'assistant', 'turnEnd', 'assistant']);
  assert.equal(entries[0].message.toolName, 'unknown');
  assert.equal(entries[0].message.isError, true);
  assert.equal(entries[1].message.content[0].text, 'Try again\nplease');
  assert.equal(new Set(entries.map(entry => entry.id)).size, entries.length);
  checkAssistant(entries[3].message, 'claude-code', 'unknown', 'stop');
});

test('Codex conversation preserves pi shapes, reasoning, model metadata and turn end', t => {
  const path = fixture(t, [
    codex(0, { model: 'gpt-test' }, 'turn_context'),
    codex(1, { type: 'message', role: 'user', content: [{ type: 'input_text', text: 'Find' }, { type: 'input_text', text: 'the answer' }, { type: 'input_image', image_url: 'ignored' }] }),
    codex(2, { type: 'reasoning', summary: [{ type: 'summary_text', text: 'Look it up' }] }),
    codex(3, { type: 'reasoning', summary: [], encrypted_content: 'hidden' }),
    codex(4, { type: 'function_call', call_id: 'c1', name: 'read', arguments: '{"path":"/answer"}' }),
    codex(5, { type: 'function_call_output', call_id: 'c1', output: { output: '42' } }),
    codex(6, { type: 'message', role: 'assistant', content: [{ type: 'output_text', text: 'The answer is 42' }] }),
    codex(7, { type: 'task_complete' }, 'event_msg'),
  ]);

  const { entries, offset } = readTranscript('codex', path);
  assert.equal(offset, statSync(path).size);
  assert.deepEqual(entries.map(entry => entry.id), ['1', '2', '4', '5', '6', '7']);
  assert.deepEqual(entries[0].message, { role: 'user', content: [{ type: 'text', text: 'Find\nthe answer' }], timestamp: epoch });
  checkAssistant(entries[1].message, 'codex', 'gpt-test', 'stop');
  assert.deepEqual(entries[1].message.content, [{ type: 'thinking', thinking: 'Look it up' }]);
  checkAssistant(entries[2].message, 'codex', 'gpt-test', 'toolUse');
  assert.deepEqual(entries[2].message.content, [{ type: 'toolCall', id: 'c1', name: 'read', arguments: { path: '/answer' } }]);
  assert.deepEqual(entries[3].message, {
    role: 'toolResult', toolCallId: 'c1', toolName: 'read', content: [{ type: 'text', text: '42' }], isError: false, timestamp: epoch,
  });
  checkAssistant(entries[4].message, 'codex', 'gpt-test', 'stop');
  assert.deepEqual(entries[5], { id: '7', offset: entries[5].offset, turnEnd: true });
  assert.ok(entries[5].offset > entries[4].offset);
});

test('Codex skips injected context, developer messages, metadata and duplicate event messages', t => {
  const prefixes = [
    '# AGENTS.md instructions for /project', '<environment_context>', '<user_instructions>', '<permissions instructions>',
    '<codex_internal_context source="daemon_recovery">', '<turn_aborted>',
    'The following is the Codex agent history whose request action you are assessing.',
    'The following is the Codex agent history added since your last approval assessment.',
  ];
  const path = fixture(t, [
    ...prefixes.map((text, index) => codex(index, { type: 'message', role: 'user', content: [{ type: 'input_text', text: ` \n${text}\ncontext` }] })),
    codex(10, { type: 'message', role: 'developer', content: [{ type: 'input_text', text: 'developer instructions' }] }),
    ...['session_meta', 'turn_context', 'world_state', 'token_usage_record'].map(type => ({ type, payload: {} })),
    ...['token_count', 'item_completed', 'agent_message', 'task_started'].map(type => codex(11, { type }, 'event_msg')),
    codex(12, { type: 'additional_tools' }),
    codex(13, { type: 'configuration_update' }),
    codex(14, { type: 'agent_message' }),
    codex(15, { type: 'message', role: 'user', content: [{ type: 'input_text', text: '   ' }] }),
    codex(16, { type: 'message', role: 'user', content: [{ type: 'input_text', text: '<user_shell_command>git status</user_shell_command>' }] }),
    codex(17, { type: 'message', role: 'user', content: [{ type: 'input_text', text: 'Explain <environment_context> please' }] }),
  ]);

  const { entries } = readTranscript('codex', path);
  assert.deepEqual(entries.map(entry => entry.id), ['16', '17']);
});

test('Codex custom calls, local shell, argument fallbacks and structured outputs', t => {
  const path = fixture(t, [
    codex(1, { type: 'custom_tool_call', call_id: 'custom', name: 'exec', input: 'text(42)' }),
    codex(2, { type: 'custom_tool_call_output', call_id: 'custom', output: [{ type: 'input_text', text: 'Script completed' }, { type: 'input_text', text: '42' }] }),
    codex(3, { type: 'local_shell_call', id: 'shell', action: { type: 'exec', command: ['pwd'] } }),
    codex(4, { type: 'function_call_output', call_id: 'shell', output: { content: [{ type: 'text', text: '/tmp' }], is_error: true } }),
    ...['not json', 'null', '[]', '42'].map((argumentsText, index) => codex(5 + index, { type: 'function_call', call_id: `raw-${index}`, name: 'raw', arguments: argumentsText })),
    codex(9, { type: 'function_call_output', call_id: 'before-offset', output: { value: 42 } }),
    codex(10, { type: 'message', role: 'assistant', model: 'explicit-model', content: [{ type: 'output_text', text: 'done' }] }),
    codex(11, { type: 'function_call', call_id: 'empty', name: 'raw', arguments: '' }),
  ]);

  const { entries } = readTranscript('codex', path);
  assert.deepEqual(entries[0].message.content[0].arguments, { input: 'text(42)' });
  checkAssistant(entries[0].message, 'codex', 'unknown', 'toolUse');
  assert.equal(entries[1].message.toolName, 'exec');
  assert.equal(entries[1].message.content[0].text, 'Script completed\n42');
  assert.deepEqual(entries[2].message.content[0], { type: 'toolCall', id: 'shell', name: 'local_shell', arguments: { type: 'exec', command: ['pwd'] } });
  assert.equal(entries[3].message.toolName, 'local_shell');
  assert.equal(entries[3].message.isError, true);
  assert.equal(entries[3].message.content[0].text, '/tmp');
  assert.deepEqual(entries.slice(4, 8).map(entry => entry.message.content[0].arguments), ['not json', 'null', '[]', '42'].map(raw => ({ raw })));
  assert.equal(entries[8].message.toolName, 'unknown');
  assert.equal(entries[8].message.content[0].text, '{"value":42}');
  checkAssistant(entries[9].message, 'codex', 'explicit-model', 'stop');
  assert.deepEqual(entries[10].message.content[0].arguments, { raw: '' });
});

test('Codex IDs fall back to payload IDs or type-qualified call IDs without collisions', t => {
  const path = fixture(t, [
    codex(undefined, { type: 'function_call', call_id: 'shared', name: 'read', arguments: '{}' }),
    codex(undefined, { type: 'function_call_output', call_id: 'shared', output: 'ok' }),
    codex(undefined, { type: 'message', id: 'answer', role: 'assistant', content: [{ type: 'output_text', text: 'done' }] }),
    codex(undefined, { type: 'task_complete', turn_id: 'turn' }, 'event_msg'),
  ]);

  const { entries } = readTranscript('codex', path);
  assert.deepEqual(entries.map(entry => entry.id), ['shared:function_call', 'shared:function_call_output', 'answer:message', 'turn:task_complete']);
  assert.deepEqual(readTranscript('codex', path).entries, entries);
});

for (const harness of ['claude', 'codex']) {
  test(`${harness} incremental reads leave partial UTF-8 lines and resolve only calls in the current read`, t => {
    const user = harness === 'claude' ? claude('u', 'user', 'café') : codex(1, { type: 'message', role: 'user', content: [{ type: 'input_text', text: 'café' }] });
    const call = harness === 'claude' ? claude('c', 'assistant', [{ type: 'tool_use', id: 'call', name: 'read', input: {} }])
      : codex(2, { type: 'function_call', call_id: 'call', name: 'read', arguments: '{}' });
    const result = harness === 'claude' ? claude('r', 'user', [{ type: 'tool_result', tool_use_id: 'call', content: '😀 result' }])
      : codex(3, { type: 'function_call_output', call_id: 'call', output: '😀 result' });
    const final = harness === 'claude' ? claude('a', 'assistant', [{ type: 'text', text: 'done' }], { stop_reason: 'end_turn' })
      : codex(4, { type: 'message', role: 'assistant', content: [{ type: 'output_text', text: 'done' }] });
    const path = fixture(t, [user, call]);
    const completeOffset = statSync(path).size;
    const resultLine = Buffer.from(JSON.stringify(result) + '\n');
    const split = resultLine.indexOf(Buffer.from('😀')) + 2;
    appendFileSync(path, resultLine.subarray(0, split));

    const first = readTranscript(harness, path);
    assert.equal(first.offset, completeOffset);
    assert.equal(first.entries.length, 2);
    assert.deepEqual(readTranscript(harness, path, first.offset), { entries: [], offset: first.offset });

    appendFileSync(path, resultLine.subarray(split));
    appendFileSync(path, JSON.stringify(final));
    const second = readTranscript(harness, path, first.offset);
    assert.equal(second.offset, completeOffset + resultLine.length);
    assert.equal(second.entries.length, 1);
    assert.equal(second.entries[0].message.toolName, 'unknown');
    assert.equal(second.entries[0].message.content[0].text, '😀 result');

    appendFileSync(path, '\n');
    if (harness === 'codex') appendFileSync(path, JSON.stringify(codex(5, { type: 'task_complete' }, 'event_msg')) + '\n');
    const third = readTranscript(harness, path, second.offset);
    assert.equal(third.offset, statSync(path).size);
    assert.deepEqual(third.entries.map(entry => entry.message?.role ?? 'turnEnd'), ['assistant', 'turnEnd']);
    assert.deepEqual(readTranscript(harness, path, third.offset), { entries: [], offset: third.offset });

    const full = readTranscript(harness, path);
    assert.equal(full.entries[2].message.toolName, 'read');
    assert.deepEqual([...first.entries, ...second.entries, ...third.entries].map(entry => entry.id), full.entries.map(entry => entry.id));
  });

  test(`${harness} tool results are capped at 20000 characters including an accurate truncation note`, t => {
    const result = text => harness === 'claude' ? claude(`r-${text.length}`, 'user', [{ type: 'tool_result', tool_use_id: 'c', content: text }])
      : codex(text.length, { type: 'function_call_output', call_id: 'c', output: text });
    const path = fixture(t, [result('x'.repeat(20000)), result('x'.repeat(21000))]);
    const { entries } = readTranscript(harness, path);
    assert.equal(entries[0].message.content[0].text, 'x'.repeat(20000));

    const text = entries[1].message.content[0].text;
    assert.equal(text.length, 20000);
    const match = /\n\[truncated (\d+) characters\]$/.exec(text);
    assert.ok(match);
    assert.equal(Number(match[1]), 21000 - match.index);
  });

  test(`${harness} invalid source IDs or timestamps cannot introduce a tool-name mapping`, t => {
    const logs = [];
    t.mock.method(console, 'error', (...args) => logs.push(args.join(' ')));
    const call = harness === 'claude' ? claude(undefined, 'assistant', [{ type: 'tool_use', id: 'call', name: 'invalid', input: {} }])
      : codex(undefined, { type: 'function_call', call_id: 'call', name: 'invalid', arguments: '{}' });
    if (harness === 'codex') call.ordinal = {};

    const result = harness === 'claude' ? claude('result', 'user', [{ type: 'tool_result', tool_use_id: 'call', content: 'ok' }])
      : codex(3, { type: 'function_call_output', call_id: 'call', output: 'ok' });
    const path = fixture(t, [call, { ...call, timestamp: 'not a timestamp' }, result]);
    const { entries } = readTranscript(harness, path);
    assert.equal(logs.length, 2);
    assert.equal(entries.length, 1);
    assert.equal(entries[0].message.toolName, 'unknown');
  });

  test(`${harness} malformed lines log once at their byte offset and do not block later lines`, t => {
    const logs = [];
    t.mock.method(console, 'error', (...args) => logs.push(args.join(' ')));
    const valid = harness === 'claude' ? claude('u', 'user', 'café')
      : codex(1, { type: 'message', role: 'user', content: [{ type: 'input_text', text: 'café' }] });
    const invalid = harness === 'claude' ? claude('bad', 'user', null)
      : codex(2, { type: 'function_call', call_id: 'bad', name: 'bad', arguments: null });
    const path = fixture(t);
    const prefix = JSON.stringify(valid) + '\r\n';
    const broken = '{not json}\n';
    writeFileSync(path, prefix + broken + JSON.stringify(invalid) + '\nnull\n\n' + JSON.stringify({ ...valid, uuid: 'after', ordinal: 3 }) + '\n');

    const { entries, offset } = readTranscript(harness, path);
    assert.equal(entries.length, 2);
    assert.equal(offset, statSync(path).size);
    assert.equal(logs.length, 3);
    assert.ok(logs[0].includes(`${path}:${Buffer.byteLength(prefix)}`));
    assert.ok(logs[1].includes(`${path}:${Buffer.byteLength(prefix + broken)}`));
    assert.deepEqual(readTranscript(harness, path, offset), { entries: [], offset });
    assert.equal(logs.length, 3);
  });
}

test('a Claude answer written as a thinking line and a text line ends its turn once, after the text', t => {
  const path = fixture(t, [
    claude('u1', 'user', 'hi'),
    claude('a1', 'assistant', [{ type: 'thinking', thinking: 'plan' }], { id: 'msg_1', stop_reason: 'end_turn' }),
    claude('a2', 'assistant', [{ type: 'text', text: 'hello' }], { id: 'msg_1', stop_reason: 'end_turn' }),
    claude('c1', 'user', 'summary of earlier work', {}, { isCompactSummary: true }),
  ]);

  const { entries } = readTranscript('claude', path);
  assert.deepEqual(entries.map((entry) => (entry.turnEnd ? 'end' : entry.message.role)), ['user', 'assistant', 'assistant', 'end']);
});

test('a shared tool-name map names results whose calls came in an earlier read', t => {
  const path = fixture(t, [claude('a1', 'assistant', [{ type: 'tool_use', id: 'call-1', name: 'Bash', input: { command: 'ls' } }])]);
  const toolNames = new Map();
  const first = readTranscript('claude', path, 0, toolNames);

  appendFileSync(path, `${JSON.stringify(claude('u1', 'user', [{ type: 'tool_result', tool_use_id: 'call-1', content: 'x' }]))}\n`);
  const second = readTranscript('claude', path, first.offset, toolNames);

  assert.equal(second.entries[0].message.toolName, 'Bash');
});

test('empty files, offsets past EOF, missing files and invalid API inputs', t => {
  const path = fixture(t);
  assert.deepEqual(readTranscript('claude', path), { entries: [], offset: 0 });
  assert.deepEqual(readTranscript('codex', path, 10), { entries: [], offset: 10 });
  assert.throws(() => readTranscript('claude', `${path}.missing`), { code: 'ENOENT' });
  assert.throws(() => readTranscript('other', path), /Unknown harness/);

  for (const offset of [-1, 0.5, NaN, Infinity, '0', Number.MAX_SAFE_INTEGER + 1]) {
    assert.throws(() => readTranscript('claude', path, offset), /Offset/);
  }
});
