// Run with: node --test agent/extensions/auto-session-name/auto-session-name.test.ts
// Node strips the TypeScript types itself; Pi only loads index.ts from this folder.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DEFAULT_CONFIG, parseConfig } from './config.ts';
import { restoreState, STATE_TYPE } from './state.ts';
import { buildExcerpt, countUserPrompts, fallbackTitle, parseTitleReply } from './title.ts';

// Minimal session entries; only the fields the extension reads.
const user = (content: unknown) => ({ type: 'message', message: { role: 'user', content } }) as any;
const assistant = (text: string) =>
  ({ type: 'message', message: { role: 'assistant', content: [{ type: 'text', text }, { type: 'toolCall', name: 'bash' }] } }) as any;
const custom = (data: unknown) => ({ type: 'custom', customType: STATE_TYPE, data }) as any;

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
  const bad = parseConfig({ model: 'luna', thinking: 'none', retitleEvery: 0 });
  assert.deepEqual(bad.config, DEFAULT_CONFIG);
  assert.equal(bad.problems.length, 3);
  assert.equal(parseConfig([]).problems.length, 1);
});
