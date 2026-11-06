import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, test } from 'node:test';

import { tomlMultiline, tomlString } from './sync.mjs';

const SYNC = new URL('./sync.mjs', import.meta.url).pathname;
const roots = [];
after(() => roots.forEach((root) => rmSync(root, { recursive: true, force: true })));

function freshRoot() {
  const root = mkdtempSync(join(tmpdir(), 'pi-workflow-'));
  roots.push(root);
  return root;
}

function sync(root) {
  return spawnSync(process.execPath, [SYNC, '--root', root], { encoding: 'utf8' });
}

test('sync writes native rules, agents, and skills without touching files it does not own', () => {
  const root = freshRoot();
  mkdirSync(join(root, '.codex'), { recursive: true });
  mkdirSync(join(root, '.claude', 'agents'), { recursive: true });
  mkdirSync(join(root, '.claude', 'skills'), { recursive: true });
  writeFileSync(join(root, '.codex', 'AGENTS.md'), '    indented code\n## CodeGraph\nkeep me\n');
  writeFileSync(join(root, '.claude', 'agents', 'architect.md'), 'mine\n');
  symlinkSync(join(root, 'outside.md'), join(root, '.claude', 'agents', 'drafter.md'));
  symlinkSync(join(homedir(), '.pi', 'agent', 'skills', 'removed-skill'), join(root, '.claude', 'skills', 'removed-skill'));

  const first = sync(root);
  assert.equal(first.status, 0, first.stderr);

  const agentsMd = readFileSync(join(root, '.codex', 'AGENTS.md'), 'utf8');
  assert.match(agentsMd, /## Model Routing[\s\S]*delegate_task/);
  assert.match(agentsMd, /## Council\n\nCouncil members, each at xhigh: `claudeAgent`/);
  assert.match(agentsMd, /pi-workflow:end -->\n\n {4}indented code\n## CodeGraph\nkeep me\n$/);
  assert.equal(readFileSync(join(root, '.claude', 'CLAUDE.md'), 'utf8').includes('JevAgent` with `agent`'), false);

  const piAgents = readdirSync(join(homedir(), '.pi', 'agent', 'agents')).filter((name) => name.endsWith('.md'));
  for (const file of piAgents) {
    assert.ok(existsSync(join(root, '.codex', 'agents', file.replace(/\.md$/, '.toml'))), file);
  }

  assert.equal(readFileSync(join(root, '.claude', 'agents', 'architect.md'), 'utf8'), 'mine\n');
  assert.equal(existsSync(join(root, 'outside.md')), false);
  assert.match(first.stderr, /architect\.md exists and pi-workflow does not manage it/);
  assert.equal(readdirSync(join(root, '.claude', 'skills')).includes('removed-skill'), false);
  assert.ok(existsSync(join(root, '.agents', 'skills', 'unslop', 'SKILL.md')));

  const second = sync(root);
  assert.equal(second.stdout, '');
  assert.equal(readFileSync(join(root, '.codex', 'AGENTS.md'), 'utf8'), agentsMd);
});

test('sync keeps copies of generated agents and links the user made into ~/.pi', () => {
  const root = freshRoot();
  assert.equal(sync(root).status, 0);

  const copy = join(root, '.claude', 'agents', 'my-reviewer.md');
  const codexCopy = join(root, '.codex', 'agents', 'my-reviewer.toml');
  writeFileSync(copy, readFileSync(join(root, '.claude', 'agents', 'code-reviewer.md'), 'utf8'));
  writeFileSync(codexCopy, readFileSync(join(root, '.codex', 'agents', 'code-reviewer.toml'), 'utf8'));
  symlinkSync(join(homedir(), '.pi', 'agent'), join(root, '.claude', 'skills', 'my-pi-link'));

  const run = sync(root);
  assert.equal(run.stdout, '');
  assert.ok(existsSync(copy));
  assert.ok(existsSync(codexCopy));
  assert.ok(readdirSync(join(root, '.claude', 'skills')).includes('my-pi-link'));
});

test('sync refuses a rules file with ambiguous markers and leaves it unchanged', () => {
  for (const markers of [
    '<!-- pi-workflow:start -->\na\n<!-- pi-workflow:start -->\nb\n<!-- pi-workflow:end -->\n',
    '<!-- pi-workflow:end -->\nUSER CONTENT\n<!-- pi-workflow:start -->\n',
    '<!-- pi-workflow:start -->\nno end\n',
  ]) {
    const root = freshRoot();
    mkdirSync(join(root, '.claude'), { recursive: true });
    writeFileSync(join(root, '.claude', 'CLAUDE.md'), markers);

    const run = sync(root);
    assert.equal(run.status, 1);
    assert.match(run.stderr, /needs one pi-workflow start marker/);
    assert.equal(readFileSync(join(root, '.claude', 'CLAUDE.md'), 'utf8'), markers);
  }
});

test('TOML strings escape every control character TOML forbids', () => {
  const forbidden = /[\x00-\x08\x0b-\x1f\x7f]/;
  const text = 'a\rb\u0001c\x7fd"""e\\f\tg';

  assert.equal(forbidden.test(tomlMultiline(text)), false);
  assert.equal(forbidden.test(tomlString(text)), false);
  assert.match(tomlMultiline(text), /""\\"e\\\\f\tg/);
});
