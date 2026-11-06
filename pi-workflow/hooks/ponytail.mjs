// Runs ponytail's own Claude/Codex hook scripts from the ponytail checkout pi already installed.

import { spawnSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

import { PONYTAIL_ROOT } from '../lib/pi.mjs';

const SCRIPTS = {
  'ponytail-activate': 'ponytail-activate.js',
  'ponytail-mode': 'ponytail-mode-tracker.js',
  'ponytail-subagent': 'ponytail-subagent.js',
};

export function handle(name, harness, input) {
  const env = { ...process.env, CLAUDE_PLUGIN_ROOT: PONYTAIL_ROOT };

  // ponytail recognizes Codex by PLUGIN_DATA, the state folder Codex gives plugin hooks, and keeps
  // its mode there.
  if (harness === 'codex') {
    env.PLUGIN_DATA = join(process.env.CODEX_HOME || join(homedir(), '.codex'), 'ponytail');
    mkdirSync(env.PLUGIN_DATA, { recursive: true });
  }

  const run = spawnSync(process.execPath, [join(PONYTAIL_ROOT, 'hooks', SCRIPTS[name])], {
    input: JSON.stringify(input), encoding: 'utf8', env, timeout: 10_000,
  });

  if (run.status !== 0) throw new Error(`ponytail ${SCRIPTS[name]} exited ${run.status}: ${run.stderr.trim()}`);

  return run.stdout || undefined;
}
