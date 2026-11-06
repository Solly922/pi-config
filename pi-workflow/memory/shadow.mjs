#!/usr/bin/env node
// Keeps a pi session that mirrors one native Claude Code or Codex thread, so pi's memory extensions,
// Hermes and observational memory, run on it with their own logic and settings.
// Usage: node shadow.mjs <claude|codex> <session id> <transcript path> <cwd>
// hooks/shadow.mjs starts it; it exits after IDLE_MS without new transcript lines.

import { chmodSync, existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';

import { AGENT_DIR, HERMES_SRC, OBSERVATIONAL_MEMORY, importFile, piReleaseModules, shadowPaths } from '../lib/pi.mjs';
import { claimOwnership, releaseOwnership } from './owner.mjs';
import { createReplayer } from './replay.mjs';
import { readTranscript } from './transcript.mjs';

const IDLE_MS = 30 * 60_000;
const POLL_MS = 3_000;

const [harness, sessionId, transcriptPath, cwd] = process.argv.slice(2);
const paths = shadowPaths(harness, sessionId);

// Marks this process as pi, so a Claude Code the extensions launch (through pi's Claude bridge)
// skips the native hooks instead of starting shadows of its own.
process.env.PI_CODING_AGENT = 'true';

// Shadow sessions copy transcripts, which can hold secrets, so only the user may read them.
mkdirSync(paths.dir, { recursive: true, mode: 0o700 });
chmodSync(paths.dir, 0o700);
if (!(await claimOwnership(paths.pid, sessionId))) process.exit(0);

// A signal only ends the loop, so shutdown never runs while a replay is still emitting events.
const stopRequested = new AbortController();
process.on('SIGTERM', () => stopRequested.abort());
process.on('SIGINT', () => stopRequested.abort());

const session = await startShadowSession();
const newReplayer = () => createReplayer({ sessionManager: session.sessionManager, emit: (event) => session.extensionRunner.emit(event) });

let replayer = newReplayer();
let saved = readSavedOffset();
let cursor = saved;
let lastActivity = Date.now();

while (!stopRequested.signal.aborted && Date.now() - lastActivity < IDLE_MS) {
  try {
    if (await replayNewEntries()) lastActivity = Date.now();
  } catch (error) {
    console.error(`shadow ${harness}/${sessionId}: replay failed`, { transcriptPath, cursor, error });

    // Start over from what is on disk: the session's stored ids and the saved offset, which never
    // passes an unstored line.
    replayer = newReplayer();
    cursor = saved;
  }

  await sleep(POLL_MS, undefined, { signal: stopRequested.signal }).catch(() => {});
}

await shutDown();

async function startShadowSession() {
  const sdk = await importFile(join(piReleaseModules(), '@earendil-works', 'pi-coding-agent', 'dist', 'index.js'));
  const settingsManager = sdk.SettingsManager.inMemory({});
  const loader = new sdk.DefaultResourceLoader({
    cwd,
    agentDir: AGENT_DIR,
    settingsManager,
    noExtensions: true,
    additionalExtensionPaths: [join(HERMES_SRC, 'index.ts'), join(OBSERVATIONAL_MEMORY, 'dist', 'index.ts')],
    noSkills: true,
    noPromptTemplates: true,
    noThemes: true,
    noContextFiles: true,
  });
  await loader.reload();

  for (const { path, error } of loader.getExtensions().errors) {
    console.error(`shadow ${harness}/${sessionId}: extension failed to load`, { path, error });
  }

  const isNew = !existsSync(paths.file);
  const sessionManager = sdk.SessionManager.open(paths.file, paths.dir, cwd);
  if (isNew) sessionManager.appendSessionInfo(`${harness === 'claude' ? 'Claude Code' : 'Codex'} thread ${sessionId}`);

  const { session: shadow } = await sdk.createAgentSession({
    cwd, agentDir: AGENT_DIR, resourceLoader: loader, settingsManager, sessionManager, noTools: 'builtin',
  });
  await shadow.bindExtensions({
    mode: 'print',
    onError: (error) => console.error(`shadow ${harness}/${sessionId}: extension error`, error),
  });

  return shadow;
}

// Returns whether new transcript lines arrived. A trailing partial line is not activity: the
// harness may never finish writing it.
async function replayNewEntries() {
  if (!existsSync(transcriptPath) || statSync(transcriptPath).size <= cursor) return false;

  const read = readTranscript(harness, transcriptPath, cursor, replayer.toolNames);
  if (read.offset === cursor) return false;

  for (const entry of read.entries) await replayer.replay(entry);
  cursor = read.offset;

  saveOffset(replayer.pendingOffset() ?? cursor);
  return true;
}

function readSavedOffset() {
  try {
    const { offset } = JSON.parse(readFileSync(paths.state, 'utf8'));
    if (Number.isSafeInteger(offset) && offset >= 0) return offset;
  } catch {
    // No state yet, or unreadable: the replayer skips whatever the session already holds.
  }

  return 0;
}

function saveOffset(offset) {
  if (offset === saved) return;

  saved = offset;
  writeFileSync(paths.state, JSON.stringify({ offset }), { mode: 0o600 });
}

// session_shutdown lets Hermes flush its review and close its database.
async function shutDown() {
  try {
    await replayer.finish();
    saveOffset(cursor);
    await session.extensionRunner.emit({ type: 'session_shutdown', reason: 'quit' });
    session.dispose();
  } catch (error) {
    console.error(`shadow ${harness}/${sessionId}: shutdown failed`, { error });
  } finally {
    releaseOwnership(paths.pid);
    process.exit(0);
  }
}
