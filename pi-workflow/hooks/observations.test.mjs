import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, test } from 'node:test';

const RUN = new URL('./run.mjs', import.meta.url).pathname;
const home = mkdtempSync(join(tmpdir(), 'pi-workflow-om-'));
after(() => rmSync(home, { recursive: true, force: true }));

// A scratch home whose shadow sessions are fixtures, while pi's runtime and the observational
// memory checkout come from the real installation.
const agent = join(home, '.pi', 'agent');
mkdirSync(join(agent, 'sessions', 'native-claude'), { recursive: true });
for (const name of ['install', 'git', 'npm']) symlinkSync(join(homedir(), '.pi', 'agent', name), join(agent, name));

function hook(input) {
  const { PI_CODING_AGENT: _inPi, ...env } = process.env;
  const run = spawnSync(process.execPath, [RUN, 'claude', 'observations'], { input: JSON.stringify(input), encoding: 'utf8', env: { ...env, HOME: home } });
  assert.equal(run.status, 0, run.stderr);
  assert.equal(run.stderr, '');
  return run.stdout ? JSON.parse(run.stdout) : undefined;
}

test('after compaction the thread gets its observational memory back', () => {
  const observation = { id: 'aaaaaaaaaaaa', content: 'User chose GraphQL over REST.', timestamp: '2026-11-06 12:00', relevance: 'high', sourceEntryIds: ['m1'], tokenCount: 9 };
  const reflection = { id: 'bbbbbbbbbbbb', content: 'The API is moving to GraphQL.', supportingObservationIds: ['aaaaaaaaaaaa'], tokenCount: 8 };
  const entries = [
    { type: 'session', id: 's', version: 3, cwd: '/tmp' },
    { type: 'message', id: 'm1', parentId: null, message: { role: 'user', content: [{ type: 'text', text: 'Use GraphQL.' }], timestamp: 1 } },
    { type: 'custom', id: 'c1', parentId: 'm1', customType: 'om.observations.recorded', data: { observations: [observation], coversUpToId: 'm1' } },
    { type: 'custom', id: 'c2', parentId: 'c1', customType: 'om.reflections.recorded', data: { reflections: [reflection], coversUpToId: 'c1' } },
  ];
  writeFileSync(join(agent, 'sessions', 'native-claude', 'thread-1.jsonl'), `${entries.map((entry) => JSON.stringify(entry)).join('\n')}\n`);

  const context = hook({ source: 'compact', session_id: 'thread-1' }).hookSpecificOutput.additionalContext;
  assert.match(context, /condensed memories/);
  assert.match(context, /\[bbbbbbbbbbbb\] The API is moving to GraphQL\./);
  assert.match(context, /\[aaaaaaaaaaaa\] 2026-11-06 12:00 \[high\] User chose GraphQL over REST\./);
});

test('only compaction adds memory, and only for threads that have a shadow session', () => {
  assert.equal(hook({ source: 'startup', session_id: 'thread-1' }), undefined);
  assert.equal(hook({ source: 'compact', session_id: 'no-such-thread' }), undefined);
});
