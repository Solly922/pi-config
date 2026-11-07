import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, symlinkSync, utimesSync, writeFileSync,
} from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, test } from 'node:test';

import { tomlMultiline, tomlString } from './sync/context.mjs';

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

test('sync manages only its own MCP servers in Claude and Codex', () => {
  const root = freshRoot();
  mkdirSync(join(root, '.claude'), { recursive: true });
  mkdirSync(join(root, '.codex'), { recursive: true });

  const mine = { type: 'http', url: 'https://example.com/my-context7' };
  const stale = { type: 'stdio', command: 'node', args: ['/old/pi-server.mjs'], env: { PI_WORKFLOW: '1' } };
  const dropped = { type: 'stdio', command: 'node', args: ['/old/dropped.mjs'], env: { PI_WORKFLOW: '1' } };
  writeFileSync(join(root, '.claude', '.claude.json'), JSON.stringify({ mcpServers: { context7: mine, pi: stale, dropped } }));
  writeFileSync(join(root, '.codex', 'config.toml'), 'model = "x"\n\n[mcp_servers."codegraph"]\ncommand = "mine"\n');

  const run = sync(root);
  assert.equal(run.status, 0, run.stderr);
  assert.match(run.stderr, /Claude MCP server context7 exists and pi-workflow does not manage it/);

  const claude = JSON.parse(readFileSync(join(root, '.claude', '.claude.json'), 'utf8')).mcpServers;
  assert.deepEqual(claude.context7, mine);
  assert.match(claude.pi.args[0], /pi-workflow\/mcp\/pi-server\.mjs$/);
  assert.equal(claude.dropped, undefined);

  const toml = readFileSync(join(root, '.codex', 'config.toml'), 'utf8');
  assert.match(toml, /^model = "x"\n\n\[mcp_servers\."codegraph"\]\ncommand = "mine"\n\n# pi-workflow:start/);
  assert.match(toml, /\[mcp_servers\.pi\]\n[\s\S]*env_vars = \["TYPESAFE_API_KEY", "PATH"/);
  assert.equal(toml.match(/codegraph/g).length, 1);

  assert.equal(sync(root).stdout, '');
});

test('sync keeps servers the user declared in any TOML form, and ignores marker text that is not a whole line', () => {
  const root = freshRoot();
  mkdirSync(join(root, '.codex'), { recursive: true });
  const mine = 'note = "see # pi-workflow:start in the docs"\nmcp_servers.pi.command = "mine"\n\n[mcp_servers.\'context7\']\nurl = "https://example.com/mine"\n';
  writeFileSync(join(root, '.codex', 'config.toml'), mine);

  const run = sync(root);
  assert.equal(run.status, 0, run.stderr);

  const toml = readFileSync(join(root, '.codex', 'config.toml'), 'utf8');
  assert.ok(toml.startsWith(mine));
  assert.doesNotMatch(toml, /\[mcp_servers\.(pi|context7)\]/);
  assert.match(toml, /\[mcp_servers\.gh_grep\]/);
});

test('sync writes into CLAUDE_CONFIG_DIR and CODEX_HOME when they are set', () => {
  const home = freshRoot();
  symlinkSync(join(homedir(), '.pi'), join(home, '.pi'));
  const env = { ...process.env, HOME: home, CLAUDE_CONFIG_DIR: join(home, 'claude-profile'), CODEX_HOME: join(home, 'codex-profile') };

  const run = spawnSync(process.execPath, [SYNC], { encoding: 'utf8', env });
  assert.equal(run.status, 0, run.stderr);

  assert.ok(existsSync(join(home, 'claude-profile', 'CLAUDE.md')));
  assert.ok(existsSync(join(home, 'claude-profile', 'agents', 'code-reviewer.md')));
  assert.ok(JSON.parse(readFileSync(join(home, 'claude-profile', '.claude.json'), 'utf8')).mcpServers.pi);
  assert.match(readFileSync(join(home, 'codex-profile', 'config.toml'), 'utf8'), /\[mcp_servers\.pi\]/);
  assert.equal(existsSync(join(home, '.claude')), false);
  assert.equal(existsSync(join(home, '.codex')), false);
});

test('sync clears a lock whose owner is gone', () => {
  const root = freshRoot();
  const lock = join(root, '.cache', 'pi-workflow-sync.lock');

  mkdirSync(lock, { recursive: true });
  utimesSync(lock, new Date(0), new Date(0));
  assert.equal(sync(root).status, 0);
  assert.equal(existsSync(lock), false);

  const exited = spawnSync(process.execPath, ['-e', 'process.stdout.write(String(process.pid))'], { encoding: 'utf8' });
  mkdirSync(lock, { recursive: true });
  writeFileSync(join(lock, 'pid'), exited.stdout);
  assert.equal(sync(root).status, 0);
  assert.equal(existsSync(lock), false);
});

test('sync ignores the Codex config of the project it runs from', () => {
  const root = freshRoot();
  const project = join(root, 'project');
  mkdirSync(join(project, '.codex'), { recursive: true });
  mkdirSync(join(root, '.codex'), { recursive: true });
  writeFileSync(join(project, '.codex', 'config.toml'), '[mcp_servers.context7]\nurl = "https://example.com/project"\n');
  writeFileSync(join(root, '.codex', 'config.toml'), `[projects.${JSON.stringify(project)}]\ntrust_level = "trusted"\n`);

  const run = spawnSync(process.execPath, [SYNC, '--root', root], { cwd: project, encoding: 'utf8' });
  assert.equal(run.status, 0, run.stderr);
  assert.match(readFileSync(join(root, '.codex', 'config.toml'), 'utf8'), /\[mcp_servers\.context7\]/);
});

test('sync adds its hooks next to the user\'s and has Codex trust only its own', () => {
  const root = freshRoot();
  mkdirSync(join(root, '.claude'), { recursive: true });
  const mine = { matcher: 'Bash', hooks: [{ type: 'command', command: 'my-hook' }] };
  writeFileSync(join(root, '.claude', 'settings.json'), JSON.stringify({ theme: 'dark', hooks: { PreToolUse: [mine] } }));

  const run = sync(root);
  assert.equal(run.status, 0, run.stderr);

  const settings = JSON.parse(readFileSync(join(root, '.claude', 'settings.json'), 'utf8'));
  assert.equal(settings.theme, 'dark');
  assert.deepEqual(settings.hooks.PreToolUse[0], mine);
  assert.ok(settings.hooks.SessionStart.some((group) => /hooks\/run\.mjs" claude session-context$/.test(group.hooks[0].command)));

  const toml = readFileSync(join(root, '.codex', 'config.toml'), 'utf8');
  const trusted = [...toml.matchAll(/^\[hooks\.state\."(.+):(\w+):\d+:\d+"\]$/gm)];
  const hooks = JSON.parse(readFileSync(join(root, '.codex', 'hooks.json'), 'utf8')).hooks;
  assert.equal(trusted.length, Object.values(hooks).flat().length);
  assert.ok(trusted.every((match) => match[1] === join(root, '.codex', 'hooks.json')));

  assert.equal(sync(root).stdout, '');
});

test('AGENTS.md is added for Claude only, and the stamp says when sources are newer than the last sync', () => {
  const root = freshRoot();
  assert.equal(sync(root).status, 0);

  const claude = JSON.parse(readFileSync(join(root, '.claude', 'settings.json'), 'utf8')).hooks.SessionStart;
  const codex = JSON.parse(readFileSync(join(root, '.codex', 'hooks.json'), 'utf8')).hooks.SessionStart;
  assert.ok(claude.some((group) => group.hooks[0].command.endsWith('claude project-rules')));
  assert.equal(codex.some((group) => group.hooks[0].command.includes('project-rules')), false);

  const freshness = new URL('./sync/freshness.mjs', import.meta.url).href;
  const ask = (call) => spawnSync(process.execPath, ['--input-type=module', '-e',
    `import { ${call.split('(')[0]} } from ${JSON.stringify(freshness)}; process.stdout.write(String(${call}));`,
    '--', '--root', root], { encoding: 'utf8' }).stdout;
  assert.equal(ask('needsSync()'), 'false');
  assert.equal(ask('claimBackgroundSync()'), 'false');

  const stamp = readdirSync(join(root, '.cache')).find((name) => /^pi-workflow-sync-\w+\.stamp$/.test(name));
  utimesSync(join(root, '.cache', stamp), new Date(0), new Date(0));
  assert.equal(ask('needsSync()'), 'true');

  // Of several session starts at once, only the first starts a sync.
  assert.equal(ask('claimBackgroundSync()'), 'true');
  assert.equal(ask('claimBackgroundSync()'), 'false');
});

test('sync trusts hooks through a symlinked hooks.json and keeps trust the user wrote', () => {
  const root = freshRoot();
  mkdirSync(join(root, '.codex'), { recursive: true });
  mkdirSync(join(root, 'dotfiles'), { recursive: true });
  writeFileSync(join(root, 'dotfiles', 'hooks.json'), '{"description": "generated by ~/.pi/pi-workflow/sync.mjs"}\n');
  symlinkSync(join(root, 'dotfiles', 'hooks.json'), join(root, '.codex', 'hooks.json'));

  const userKey = `${join(root, '.codex', 'hooks.json')}:session_start:0:0`;
  writeFileSync(join(root, '.codex', 'config.toml'), `[hooks.state.'${userKey}']\ntrusted_hash = "sha256:mine"\n`);

  const run = sync(root);
  assert.equal(run.status, 0, run.stderr);

  const toml = readFileSync(join(root, '.codex', 'config.toml'), 'utf8');
  const hooks = JSON.parse(readFileSync(join(root, 'dotfiles', 'hooks.json'), 'utf8')).hooks;
  const ours = [...toml.matchAll(/^\[hooks\.state\."(.+)"\]$/gm)].map((match) => match[1]);
  assert.equal(ours.length, Object.values(hooks).flat().length - 1);
  assert.equal(ours.includes(userKey), false);
  assert.ok(lstatSync(join(root, '.codex', 'hooks.json')).isSymbolicLink());
});

test('sync moves tables Codex appended inside its block above it', () => {
  const root = freshRoot();
  assert.equal(sync(root).status, 0);

  // Codex appends what it writes at the end of the file, which is inside the block.
  const config = join(root, '.codex', 'config.toml');
  const appended = '[projects."/home/x/proj"]\ntrust_level = "trusted"\n\n[mcp_servers.mine]\ncommand = "mine"\n';
  writeFileSync(config, readFileSync(config, 'utf8').replace('# pi-workflow:end', `${appended}# pi-workflow:end`));

  const run = sync(root);
  assert.equal(run.status, 0, run.stderr);

  const toml = readFileSync(config, 'utf8');
  const blockStart = toml.indexOf('# pi-workflow:start');
  assert.ok(toml.indexOf('[projects."/home/x/proj"]') < blockStart);
  assert.ok(toml.indexOf('[mcp_servers.mine]') < blockStart);
  assert.equal(sync(root).stdout, '');
});

test('sync leaves a Codex hooks.json it did not write alone', () => {
  const root = freshRoot();
  mkdirSync(join(root, '.codex'), { recursive: true });
  const mine = '{"hooks":{}}\n';
  writeFileSync(join(root, '.codex', 'hooks.json'), mine);

  const run = sync(root);
  assert.equal(run.status, 0, run.stderr);
  assert.match(run.stderr, /hooks\.json exists and pi-workflow does not manage it/);
  assert.equal(readFileSync(join(root, '.codex', 'hooks.json'), 'utf8'), mine);
  assert.doesNotMatch(readFileSync(join(root, '.codex', 'config.toml'), 'utf8'), /hooks\.state/);
});

test('sync restores config.toml when Codex rejects it', () => {
  const root = freshRoot();
  mkdirSync(join(root, '.codex'), { recursive: true });
  const broken = '[mcp_servers.x]\ncommand = \n';
  writeFileSync(join(root, '.codex', 'config.toml'), broken);

  const run = sync(root);
  assert.equal(run.status, 1);
  assert.match(run.stderr, /was restored because Codex rejected/);
  assert.equal(readFileSync(join(root, '.codex', 'config.toml'), 'utf8'), broken);
});

test('TOML strings escape every control character TOML forbids', () => {
  const forbidden = /[\x00-\x08\x0b-\x1f\x7f]/;
  const text = 'a\rb\u0001c\x7fd"""e\\f\tg';

  assert.equal(forbidden.test(tomlMultiline(text)), false);
  assert.equal(forbidden.test(tomlString(text)), false);
  assert.match(tomlMultiline(text), /""\\"e\\\\f\tg/);
});
