// Rewrites shell commands to their rtk equivalents, as pi-rtk-optimizer does in pi.

import { spawnSync } from 'node:child_process';

export function handle(_name, harness, input) {
  const run = spawnSync('rtk', ['hook', 'claude'], { input: JSON.stringify(input), encoding: 'utf8', timeout: 5_000 });
  if (run.error || run.status !== 0 || !run.stdout.trim()) return undefined;
  if (harness === 'claude') return run.stdout;

  // Codex applies a rewrite only together with permissionDecision "allow", which also skips its
  // approval prompt. So Codex rewrites only where approvals are already off.
  if (input.permission_mode !== 'bypassPermissions') return undefined;

  const output = JSON.parse(run.stdout);
  if (!output.hookSpecificOutput?.updatedInput) return undefined;

  return { hookSpecificOutput: { ...output.hookSpecificOutput, permissionDecision: 'allow' } };
}
