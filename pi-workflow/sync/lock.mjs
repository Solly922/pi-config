// Keeps two syncs from writing the same config at once. pi MCP servers start a sync after
// skill_manage, so several can run together.

import { mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { setTimeout as sleep } from 'node:timers/promises';
import { dirname, join } from 'node:path';

import { DEST, DRY_RUN } from './context.mjs';

const SYNC_LOCK = join(DEST, '.cache', 'pi-workflow-sync.lock');
const SYNC_LOCK_WAIT_MS = 30_000;
// A lock with no owner file yet belongs to a sync that crashed between mkdir and writing it.
const SYNC_LOCK_ORPHAN_MS = 10_000;

export async function withSyncLock(work) {
  if (DRY_RUN) return work();

  mkdirSync(dirname(SYNC_LOCK), { recursive: true });
  const owner = join(SYNC_LOCK, 'pid');
  const deadline = Date.now() + SYNC_LOCK_WAIT_MS;

  // mkdir is atomic, so exactly one process creates the lock directory. A lock is taken over only
  // when its owner is gone; two waiters taking over the same dead lock at once is still possible.
  while (!tryMkdir(SYNC_LOCK)) {
    if (isStaleLock(owner)) {
      rmSync(SYNC_LOCK, { recursive: true, force: true });
    } else if (Date.now() > deadline) {
      throw new Error(`another sync still holds ${SYNC_LOCK}; remove it if no sync is running`);
    } else {
      await sleep(100);
    }
  }

  writeFileSync(owner, String(process.pid));

  try {
    return await work();
  } finally {
    // A sync whose lock was taken over must not delete the new owner's lock.
    if (lockOwner(owner) === process.pid) rmSync(SYNC_LOCK, { recursive: true, force: true });
  }
}

function tryMkdir(path) {
  try {
    mkdirSync(path);
    return true;
  } catch (error) {
    if (error.code === 'EEXIST') return false;
    throw error;
  }
}

function lockOwner(owner) {
  try {
    return Number(readFileSync(owner, 'utf8'));
  } catch {
    return undefined;
  }
}

function isStaleLock(owner) {
  const pid = lockOwner(owner);

  // No owner file: either the lock just appeared or its creator died before writing it.
  if (pid === undefined) {
    const created = statSync(SYNC_LOCK, { throwIfNoEntry: false })?.mtimeMs;
    return created !== undefined && Date.now() - created > SYNC_LOCK_ORPHAN_MS;
  }

  try {
    process.kill(pid, 0);
    return false;
  } catch (error) {
    return error.code === 'ESRCH';
  }
}
