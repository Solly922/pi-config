import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';

const RUN = new URL('./run.mjs', import.meta.url).pathname;

// These tests run inside pi, so the variable that silences hooks there is removed for each run.
function hook(harness, handler, input, env = {}) {
  const { PI_CODING_AGENT: _inPi, ...outsidePi } = process.env;
  const run = spawnSync(process.execPath, [RUN, harness, handler], { input: JSON.stringify(input), encoding: 'utf8', env: { ...outsidePi, ...env } });
  assert.equal(run.status, 0, run.stderr);
  return run.stdout ? JSON.parse(run.stdout) : undefined;
}

test('hooks do nothing inside pi', () => {
  const edit = { tool_name: 'Write', tool_input: { file_path: '/x/.llm-wiki/meta/registry.json' } };
  assert.equal(hook('claude', 'wiki-guard', edit, { PI_CODING_AGENT: 'true' }), undefined);
});

test('the wiki guard blocks edits to generated wiki state in both harnesses', () => {
  const claude = hook('claude', 'wiki-guard', { tool_name: 'Write', tool_input: { file_path: '/x/.llm-wiki/meta/registry.json' } });
  assert.equal(claude.hookSpecificOutput.permissionDecision, 'deny');

  const patch = '*** Begin Patch\n*** Add File: notes.md\n+a\n*** Update File: /x/.llm-wiki/raw/page.md\n@@\n-a\n+b\n*** End Patch';
  const codex = hook('codex', 'wiki-guard', { tool_name: 'apply_patch', tool_input: { command: patch } });
  assert.match(codex.hookSpecificOutput.permissionDecisionReason, /\.llm-wiki\/raw\/page\.md/);

  assert.equal(hook('claude', 'wiki-guard', { tool_name: 'Edit', tool_input: { file_path: '/x/.llm-wiki/wiki/page.md' } }), undefined);
});

test('the wiki guard sees through ./, ../, and paths relative to the session folder', () => {
  for (const file_path of ['/x/.llm-wiki/./raw/page.md', '/x/.llm-wiki/wiki/../meta/registry.json']) {
    assert.equal(hook('claude', 'wiki-guard', { tool_name: 'Write', tool_input: { file_path } })?.hookSpecificOutput.permissionDecision, 'deny', file_path);
  }

  const patch = '*** Begin Patch\n*** Update File: raw/page.md\n@@\n-a\n+b\n*** End Patch';
  const codex = hook('codex', 'wiki-guard', { cwd: '/x/.llm-wiki', tool_name: 'apply_patch', tool_input: { command: patch } });
  assert.equal(codex?.hookSpecificOutput.permissionDecision, 'deny');
});

test('Codex gets rtk rewrites only when approvals are already off', () => {
  const bash = { tool_name: 'Bash', tool_input: { command: 'git status' } };

  assert.equal(hook('codex', 'rtk', { ...bash, permission_mode: 'default' }), undefined);

  const bypass = hook('codex', 'rtk', { ...bash, permission_mode: 'bypassPermissions' });
  assert.equal(bypass.hookSpecificOutput.permissionDecision, 'allow');
  assert.equal(bypass.hookSpecificOutput.updatedInput.command, 'rtk git status');

  const claude = hook('claude', 'rtk', bash);
  assert.equal(claude.hookSpecificOutput.permissionDecision, undefined);
  assert.equal(claude.hookSpecificOutput.updatedInput.command, 'rtk git status');
});
