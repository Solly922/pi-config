// Run with: node --test agent/extensions/auto-session-name/auto-session-name.test.ts
// Node strips the TypeScript types itself; Pi only loads index.ts from this folder.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DEFAULT_CONFIG, parseConfig } from './config.ts';
import { restoreState, STATE_TYPE } from './state.ts';
import { buildExcerpt, countUserPrompts, fallbackTitle, parseTitleReply, requestTitle, unwrapSkill } from './title.ts';

// Minimal session entries; only the fields the extension reads.
const user = (content: unknown) => ({ type: 'message', message: { role: 'user', content } }) as any;
const assistant = (text: string) =>
  ({ type: 'message', message: { role: 'assistant', content: [{ type: 'text', text }, { type: 'toolCall', name: 'bash' }] } }) as any;
const custom = (data: unknown) => ({ type: 'custom', customType: STATE_TYPE, data }) as any;

// What Pi sends for `/skill:grilling <request>`: a long SKILL.md body, then the request.
const skillPrompt = (request: string) =>
  `<skill name="grilling" location="/home/u/.pi/agent/skills/grilling/SKILL.md">\nReferences are relative to /home/u.\n\n${'Ask hard questions. '.repeat(100)}\n</skill>${request ? `\n\n${request}` : ''}`;

// Stand-in model registry: records each request and answers with `result`.
function fakeRegistry(result: () => Promise<unknown>) {
  const calls: any[] = [];
  const registry = {
    find: (provider: string, id: string) => (provider === 'p' && id === 'm' ? { provider, id } : undefined),
    hasConfiguredAuth: () => true,
    streamSimple: (_model: unknown, context: unknown, options: unknown) => {
      calls.push({ context, options });
      return { result };
    },
  };
  return { registry: registry as any, calls };
}
const testConfig = { ...DEFAULT_CONFIG, model: 'p/m' };
const answer = (text: string, stopReason = 'stop', errorMessage?: string) => async () =>
  ({ stopReason, errorMessage, content: [{ type: 'text', text }] });
const noSignal = () => new AbortController().signal;

test('parseTitleReply strips the decoration models add', () => {
  assert.deepEqual(parseTitleReply('"Fix login redirect loop."'), { title: 'Fix login redirect loop' });
  assert.deepEqual(parseTitleReply('Title: **Auto session naming**\nextra line'), { title: 'Auto session naming' });
  assert.deepEqual(parseTitleReply('# Debug crash in Hyprland'), { title: 'Debug crash in Hyprland' });
  assert.deepEqual(parseTitleReply('\n  keep.  '), { keep: true });
  assert.equal(parseTitleReply('  "" '), undefined);
});

test('parseTitleReply clips long titles at a word boundary', () => {
  const reply = parseTitleReply('word '.repeat(30));
  assert.ok(reply && 'title' in reply);
  assert.ok(reply.title.length <= 60);
  assert.ok(!reply.title.endsWith(' '));
});

test('buildExcerpt keeps user/assistant text, drops tool calls, and appends the pending prompt', () => {
  const excerpt = buildExcerpt([user('hello'), assistant('hi there'), { type: 'model_change' } as any], 'next question');
  assert.equal(excerpt, 'User: hello\n\nAssistant: hi there\n\nUser: next question');
});

test('buildExcerpt keeps the newest messages when over budget', () => {
  const entries = Array.from({ length: 20 }, (_, i) => user(`${i} ${'x'.repeat(900)}`));
  const excerpt = buildExcerpt(entries);
  assert.ok(excerpt.length <= 5000);
  assert.ok(excerpt.includes('User: 19 '));
  assert.ok(!excerpt.includes('User: 0 '));
});

test('skill expansions shrink to the skill name plus the user request', () => {
  assert.deepEqual(unwrapSkill(skillPrompt('fix my auth plan')), { skill: 'grilling', request: 'fix my auth plan' });
  assert.deepEqual(unwrapSkill(skillPrompt('')), { skill: 'grilling', request: '' });
  assert.deepEqual(unwrapSkill('plain <skill> talk'), { request: 'plain <skill> talk' });

  // Both stored branch messages and the pending first prompt are unwrapped.
  const excerpt = buildExcerpt([user(skillPrompt('fix my auth plan'))], skillPrompt(''));
  assert.equal(excerpt, 'User: [skill: grilling] fix my auth plan\n\nUser: [skill: grilling]');
  assert.ok(!excerpt.includes('Ask hard questions'));
});

test('fallbackTitle never returns the skill wrapper', () => {
  assert.equal(fallbackTitle(skillPrompt('fix my auth plan\nmore detail')), 'fix my auth plan');
  assert.equal(fallbackTitle(skillPrompt('')), 'grilling skill');
});

test('requestTitle sends the conversation as data and parses the reply', async () => {
  const { registry, calls } = fakeRegistry(answer('"Fix login loop."'));
  const reply = await requestTitle(registry, testConfig, 'User: hi', 'Old title', noSignal());
  assert.deepEqual(reply, { title: 'Fix login loop' });
  assert.match(calls[0].context.systemPrompt, /not instructions to you/);
  assert.match(calls[0].context.messages[0].content[0].text, /^Current title: Old title\n\n<conversation>\nUser: hi\n<\/conversation>$/);
  assert.equal(calls[0].options.reasoning, 'low');
});

test('requestTitle treats KEEP as a title only when there is a title to keep', async () => {
  assert.deepEqual(await requestTitle(fakeRegistry(answer('KEEP')).registry, testConfig, 'x', 'Old', noSignal()), { keep: true });
  assert.equal(await requestTitle(fakeRegistry(answer('KEEP')).registry, testConfig, 'x', undefined, noSignal()), undefined);
});

test('requestTitle reports missing models and provider errors', async () => {
  const { registry } = fakeRegistry(answer('', 'error', 'rate limited'));
  await assert.rejects(requestTitle(registry, testConfig, 'x', undefined, noSignal()), /rate limited/);
  await assert.rejects(requestTitle(registry, { ...testConfig, model: 'p/nope' }, 'x', undefined, noSignal()), /not available/);
});

// The 2s test limit turns a regression (a request that never settles) into a clear failure, not a hang.
test('requestTitle gives up on a provider that never answers', { timeout: 2000 }, async () => {
  // Keeps the event loop alive: Node does not count AbortSignal.timeout timers.
  const keepAlive = setTimeout(() => {}, 5000);
  try {
    const started = Date.now();
    const { registry } = fakeRegistry(() => new Promise(() => {}));
    // 50ms is below parseConfig's 1000ms floor on purpose; it keeps this test fast.
    await assert.rejects(requestTitle(registry, { ...testConfig, timeoutMs: 50 }, 'x', undefined, noSignal()), /timed out after 0.05s/);
    assert.ok(Date.now() - started < 1000);
  } finally {
    clearTimeout(keepAlive);
  }
});

test('requestTitle stops at once when the session cancels it', { timeout: 2000 }, async () => {
  const controller = new AbortController();
  const { registry } = fakeRegistry(() => new Promise(() => {}));
  const pending = requestTitle(registry, testConfig, 'x', undefined, controller.signal);
  controller.abort();
  await assert.rejects(pending, (error: Error) => error.name === 'AbortError');
});

test('requestTitle does not call the provider once the session is gone', async () => {
  const controller = new AbortController();
  controller.abort();
  const { registry, calls } = fakeRegistry(answer('Too late'));
  await assert.rejects(requestTitle(registry, testConfig, 'x', undefined, controller.signal), (error: Error) => error.name === 'AbortError');
  assert.equal(calls.length, 0);
});

test('countUserPrompts counts only user messages', () => {
  assert.equal(countUserPrompts([user('a'), assistant('b'), user([{ type: 'text', text: 'c' }])]), 2);
});

test('fallbackTitle uses the first non-empty line, clipped', () => {
  assert.equal(fallbackTitle('\n\n  fix   the build\nmore'), 'fix the build');
  assert.ok(fallbackTitle('a'.repeat(200)).length <= 50);
});

test('restoreState reads the newest saved entry and tolerates bad data', () => {
  assert.deepEqual(restoreState([]), { checkedAtPrompt: 0, paused: false });
  const entries = [custom({ name: 'Old', checkedAtPrompt: 5, paused: false }), user('x'), custom({ name: 'New', checkedAtPrompt: 10, paused: true })];
  assert.deepEqual(restoreState(entries), { name: 'New', checkedAtPrompt: 10, paused: true });
  assert.deepEqual(restoreState([custom('garbage')]), { name: undefined, checkedAtPrompt: 0, paused: false });
});

test('parseConfig keeps good fields and reports bad ones', () => {
  assert.deepEqual(parseConfig({}), { config: DEFAULT_CONFIG, problems: [] });
  const openrouter = parseConfig({ model: 'openrouter/anthropic/claude-haiku', retitleEvery: 3 });
  assert.equal(openrouter.config.model, 'openrouter/anthropic/claude-haiku');
  assert.equal(openrouter.config.retitleEvery, 3);
  const bad = parseConfig({ model: 'luna', thinking: 'none', retitleEvery: 0, timeoutMs: 2 ** 31 });
  assert.deepEqual(bad.config, DEFAULT_CONFIG);
  assert.equal(bad.problems.length, 4);
  assert.equal(parseConfig({ timeoutMs: 30_000 }).config.timeoutMs, 30_000);
  assert.equal(parseConfig([]).problems.length, 1);
});
