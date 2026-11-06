// Starts the shadow pi session for this thread (memory/shadow.mjs) unless one is already running.

import { spawn } from 'node:child_process';
import { chmodSync, closeSync, mkdirSync, openSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { shadowPaths } from '../lib/pi.mjs';
import { isShadowOwner, readOwner } from '../memory/owner.mjs';

const SHADOW = join(dirname(dirname(fileURLToPath(import.meta.url))), 'memory', 'shadow.mjs');

export function handle(_name, harness, input) {
  const { session_id: sessionId, transcript_path: transcriptPath } = input;
  if (typeof sessionId !== 'string' || typeof transcriptPath !== 'string' || !transcriptPath) return undefined;

  const paths = shadowPaths(harness, sessionId);
  if (isShadowOwner(readOwner(paths.pid), sessionId)) return undefined;

  // The log can quote transcript content, so it is as private as the shadow session.
  mkdirSync(paths.dir, { recursive: true, mode: 0o700 });
  chmodSync(paths.dir, 0o700);
  const log = openSync(paths.log, 'a', 0o600);
  const cwd = typeof input.cwd === 'string' && input.cwd ? input.cwd : process.cwd();

  try {
    spawn(process.execPath, [SHADOW, harness, sessionId, transcriptPath, cwd], {
      cwd, detached: true, stdio: ['ignore', log, log],
    }).unref();
  } finally {
    closeSync(log);
  }

  return undefined;
}
