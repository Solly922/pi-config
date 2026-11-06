// Which process owns a thread's shadow session: one live memory/shadow.mjs per thread, named in a
// pid file.

import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { setTimeout as sleep } from 'node:timers/promises';

// Two starters can both take over the same stale pid file, and the later write wins. Each one
// checks again after this pause and steps back if it lost.
const TAKEOVER_SETTLE_MS = 200;

export function readOwner(pidFile) {
  try {
    return Number(readFileSync(pidFile, 'utf8'));
  } catch {
    return undefined;
  }
}

// A pid alone can be reused by an unrelated process, so on Linux the command line must name this
// thread's shadow process.
export function isShadowOwner(pid, sessionId) {
  if (!Number.isSafeInteger(pid) || pid <= 0) return false;

  if (existsSync('/proc/self/cmdline')) {
    try {
      const command = readFileSync(`/proc/${pid}/cmdline`, 'utf8');
      return command.includes('shadow.mjs') && command.includes(sessionId);
    } catch {
      return false;
    }
  }

  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error.code !== 'ESRCH';
  }
}

export async function claimOwnership(pidFile, sessionId) {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      writeFileSync(pidFile, String(process.pid), { flag: 'wx', mode: 0o600 });
      break;
    } catch (error) {
      if (error.code !== 'EEXIST') throw error;

      // A stale file can name this very process if its pid was reused for it.
      const owner = readOwner(pidFile);
      if (owner !== process.pid && isShadowOwner(owner, sessionId)) return false;
      if (readOwner(pidFile) === owner) rmSync(pidFile, { force: true });
    }
  }

  await sleep(TAKEOVER_SETTLE_MS);
  return readOwner(pidFile) === process.pid;
}

export function releaseOwnership(pidFile) {
  if (readOwner(pidFile) === process.pid) rmSync(pidFile, { force: true });
}
