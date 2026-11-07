import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, test } from 'node:test';

const RUN = new URL('./run.mjs', import.meta.url).pathname;
const repo = mkdtempSync(join(tmpdir(), 'pi-workflow-rules-'));
after(() => rmSync(repo, { recursive: true, force: true }));

function hook(input) {
  const { PI_CODING_AGENT: _inPi, ...env } = process.env;

  const run = spawnSync(process.execPath, [RUN, 'claude', 'project-rules'], { input: JSON.stringify(input), encoding: 'utf8', env });
  assert.equal(run.status, 0, run.stderr);

  return run.stdout ? JSON.parse(run.stdout).hookSpecificOutput.additionalContext : undefined;
}

// repo/            AGENTS.md
//   app/           AGENTS.md
//     web/         AGENTS.md, CLAUDE.md
mkdirSync(join(repo, 'app', 'web'), { recursive: true });
writeFileSync(join(repo, 'AGENTS.md'), 'Root rule.\n');
writeFileSync(join(repo, 'app', 'AGENTS.md'), 'App rule.\n');
writeFileSync(join(repo, 'app', 'web', 'AGENTS.md'), 'Web rule.\n');
writeFileSync(join(repo, 'app', 'web', 'CLAUDE.md'), '@AGENTS.md\n');
symlinkSync(join(repo, 'app', 'web'), join(repo, 'web-link'));

test('Claude gets each AGENTS.md from the session folder up, outermost first, except where a CLAUDE.md loads it', () => {
  const context = hook({ source: 'startup', cwd: join(repo, 'app', 'web') });

  assert.ok(context.indexOf('Root rule.') < context.indexOf('App rule.'));
  assert.equal(context.includes('Web rule.'), false);
  assert.match(context, new RegExp(`Contents of ${join(repo, 'AGENTS.md')}`));
});

test('a session started through a symlink finds the folders above the link target', () => {
  assert.match(hook({ source: 'startup', cwd: join(repo, 'web-link') }), /App rule\./);
});

test('a resumed session gets the instructions only if its transcript does not already have them', () => {
  const transcript = join(repo, 'transcript.jsonl');

  writeFileSync(transcript, '{"type":"user"}\n');
  assert.match(hook({ source: 'resume', cwd: repo, transcript_path: transcript }), /Root rule\./);

  writeFileSync(transcript, `${JSON.stringify({ content: hook({ source: 'startup', cwd: repo }) })}\n`);
  assert.equal(hook({ source: 'resume', cwd: repo, transcript_path: transcript }), undefined);
});

test('instructions too long for hook text get a pointer instead', () => {
  writeFileSync(join(repo, 'AGENTS.md'), 'x'.repeat(12_000));

  const context = hook({ source: 'compact', cwd: repo });
  assert.match(context, /read that file in full before starting work here/);
  assert.equal(context.includes('xxxx'), false);
});
