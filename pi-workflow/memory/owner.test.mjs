import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, test } from 'node:test';

import { claimOwnership, isShadowOwner } from './owner.mjs';

const dir = mkdtempSync(join(tmpdir(), 'pi-workflow-owner-'));
after(() => rmSync(dir, { recursive: true, force: true }));

test('a pid file whose process is gone, or is some other program, is taken over', async () => {
  const pidFile = join(dir, 'gone.pid');
  const exited = spawnSync(process.execPath, ['-e', 'process.stdout.write(String(process.pid))'], { encoding: 'utf8' });
  writeFileSync(pidFile, exited.stdout);
  assert.equal(await claimOwnership(pidFile, 'thread-1'), true);
  assert.equal(readFileSync(pidFile, 'utf8'), String(process.pid));

  // This test process is alive but is not a shadow process for the thread.
  const reused = join(dir, 'reused.pid');
  writeFileSync(reused, String(process.ppid));
  assert.equal(isShadowOwner(process.ppid, 'thread-1'), false);
  assert.equal(await claimOwnership(reused, 'thread-1'), true);
});

test('a live shadow process for the thread keeps its ownership', async (t) => {
  const pidFile = join(dir, 'live.pid');
  const shadow = spawn(process.execPath, ['-e', 'setTimeout(() => {}, 10_000)', 'shadow.mjs', 'claude', 'thread-2']);
  t.after(() => shadow.kill());

  writeFileSync(pidFile, String(shadow.pid));
  assert.equal(await claimOwnership(pidFile, 'thread-2'), false);
  assert.equal(readFileSync(pidFile, 'utf8'), String(shadow.pid));
});
