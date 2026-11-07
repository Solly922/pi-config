// Whether the native config is older than the pi files it is generated from, so a session start can
// bring it up to date.

import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, statSync, utimesSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

import { CLAUDE_HOME, CODEX_HOME, DEST, PI_AGENT, WORKFLOW_DIR } from './context.mjs';
import { SKILL_SOURCES } from './skills.mjs';

// One stamp per destination pair, so syncing one Claude/Codex profile does not mark another fresh.
const PROFILE = createHash('sha256').update(`${CLAUDE_HOME}\0${CODEX_HOME}`).digest('hex').slice(0, 12);
const STAMP = join(DEST, '.cache', `pi-workflow-sync-${PROFILE}.stamp`);
const ATTEMPT = join(DEST, '.cache', `pi-workflow-sync-${PROFILE}.attempt`);
// A background sync that has not stamped by now failed; the next session start tries again.
const RETRY_AFTER_MS = 10 * 60_000;

export function needsSync() {
  const synced = mtime(STAMP);
  return syncInputs().some((path) => mtime(path) > synced);
}

// Whether a session start should start a background sync. Many sessions can start at once, so only
// the first gets to; one that is still running or just failed is left alone for a while.
export function claimBackgroundSync() {
  if (!needsSync()) return false;

  const attempted = mtime(ATTEMPT);
  if (attempted > mtime(STAMP) && Date.now() - attempted < RETRY_AFTER_MS) return false;

  touch(ATTEMPT, new Date());
  return true;
}

// The stamp takes the time sync started, so an edit made while it ran still counts as newer.
export function markSynced(startedAt) {
  touch(STAMP, startedAt);
}

function touch(path, time) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, '');
  utimesSync(path, time, time);
}

function mtime(path) {
  return statSync(path, { throwIfNoEntry: false })?.mtimeMs ?? 0;
}

// Every file sync reads, and the folders whose entries it links or lists. Skills are linked, so
// editing one needs no sync; only adding or removing a skill folder changes a source folder.
function syncInputs() {
  return [
    join(PI_AGENT, 'APPEND_SYSTEM.md'),
    join(PI_AGENT, 'agents'), ...filesIn(join(PI_AGENT, 'agents'), '.md'),
    join(WORKFLOW_DIR, 'rules'), ...filesIn(join(WORKFLOW_DIR, 'rules'), '.md'),
    join(WORKFLOW_DIR, 'sync.mjs'), ...filesIn(join(WORKFLOW_DIR, 'sync'), '.mjs'),
    ...SKILL_SOURCES,
  ];
}

function filesIn(dir, extension) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter((name) => name.endsWith(extension)).map((name) => join(dir, name));
}
