// Runs the real shadow process with pi's SDK, Hermes and observational memory in a scratch home.
// The fixture stays under every review and observation threshold, so no model is called.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { appendFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, symlinkSync, writeFileSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { after, test } from 'node:test';

const SHADOW = new URL('./shadow.mjs', import.meta.url).pathname;
const home = mkdtempSync(join(tmpdir(), 'pi-workflow-shadow-'));
after(() => rmSync(home, { recursive: true, force: true }));

const agent = join(home, '.pi', 'agent');
mkdirSync(agent, { recursive: true });
for (const name of ['install', 'git', 'npm']) symlinkSync(join(homedir(), '.pi', 'agent', name), join(agent, name));

const transcript = join(home, 'transcript.jsonl');
const shadowFile = join(agent, 'sessions', 'native-claude', 'thread-1.jsonl');
const stateFile = join(agent, 'sessions', 'native-claude', 'thread-1.state.json');

const line = (uuid, type, content, message = {}) => `${JSON.stringify({
  uuid, type, timestamp: '2026-11-06T12:00:00.000Z', isSidechain: false, message: { role: type, content, ...message },
})}\n`;

async function runShadowUntilCaughtUp() {
  const { PI_CODING_AGENT: _inPi, ...env } = process.env;
  const child = spawn(process.execPath, [SHADOW, 'claude', 'thread-1', transcript, home], { env: { ...env, HOME: home }, stdio: ['ignore', 'ignore', 'pipe'] });
  let stderr = '';
  child.stderr.on('data', (chunk) => {
    stderr += chunk;
  });

  const size = statSync(transcript).size;
  for (let waited = 0; waited < 60_000; waited += 250) {
    if (existsSync(stateFile) && JSON.parse(readFileSync(stateFile, 'utf8')).offset === size) break;
    await sleep(250);
  }

  child.kill('SIGTERM');
  const code = await new Promise((resolve) => child.on('close', resolve));
  assert.equal(code, 0, stderr);
}

function storedMessages() {
  const entries = readFileSync(shadowFile, 'utf8').split('\n').filter(Boolean).map((text) => JSON.parse(text));
  return {
    roles: entries.filter((entry) => entry.type === 'message').map((entry) => entry.message.role),
    nativeIds: entries.flatMap((entry) => entry.message?.nativeIds ?? []),
    turnEnds: entries.filter((entry) => entry.customType === 'pi-workflow.turn-end').length,
  };
}

test('the shadow session mirrors the transcript and picks up where it left off after a restart', { timeout: 180_000 }, async () => {
  writeFileSync(transcript, [
    line('u1', 'user', 'list the files'),
    line('a1', 'assistant', [{ type: 'tool_use', id: 'call-1', name: 'Bash', input: { command: 'ls' } }], { stop_reason: 'tool_use' }),
    line('r1', 'user', [{ type: 'tool_result', tool_use_id: 'call-1', content: 'a.txt' }]),
    line('a2', 'assistant', [{ type: 'text', text: 'One file: a.txt.' }], { stop_reason: 'end_turn' }),
  ].join(''));

  await runShadowUntilCaughtUp();
  assert.deepEqual(storedMessages().roles, ['user', 'assistant', 'toolResult', 'assistant']);

  appendFileSync(transcript, line('u2', 'user', 'thanks') + line('a3', 'assistant', [{ type: 'text', text: 'Welcome.' }], { stop_reason: 'end_turn' }));
  await runShadowUntilCaughtUp();

  const { roles, nativeIds, turnEnds } = storedMessages();
  assert.deepEqual(roles, ['user', 'assistant', 'toolResult', 'assistant', 'user', 'assistant']);
  assert.equal(new Set(nativeIds).size, nativeIds.length);
  assert.equal(turnEnds, 2);
});
