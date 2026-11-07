// Starts sync in the background when the native config is older than its pi sources. The session
// that triggers it keeps what it already loaded; the next one gets the new config.

import { spawn } from 'node:child_process';
import { closeSync, mkdirSync, openSync } from 'node:fs';
import { join } from 'node:path';

import { DEST, WORKFLOW_DIR } from '../sync/context.mjs';
import { claimBackgroundSync } from '../sync/freshness.mjs';

export function handle() {
  if (!claimBackgroundSync()) return undefined;

  mkdirSync(join(DEST, '.cache'), { recursive: true });
  const log = openSync(join(DEST, '.cache', 'pi-workflow-sync.log'), 'a', 0o600);

  // --if-stale makes a sync that waited on the lock behind another one skip work that one did.
  try {
    spawn(process.execPath, [join(WORKFLOW_DIR, 'sync.mjs'), '--if-stale'], { cwd: '/', detached: true, stdio: ['ignore', log, log] }).unref();
  } finally {
    closeSync(log);
  }

  return undefined;
}
