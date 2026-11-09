import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, test } from 'node:test';

const LIB = new URL('./pi.mjs', import.meta.url).href;
const home = mkdtempSync(join(tmpdir(), 'pi-workflow-lib-'));
after(() => rmSync(home, { recursive: true, force: true }));

const agent = join(home, '.pi', 'agent');
mkdirSync(agent, { recursive: true });

// Runs useMemoryModel against a fake session whose available models are `available`, in a home
// whose memory settings are the fixtures, and prints the model it chose.
function chosen(available) {
  const script = `
    import { useMemoryModel } from ${JSON.stringify(LIB)};
    const picks = [];
    const session = {
      extensionRunner: { createContext: () => ({ modelRegistry: { getAvailable: () => ${JSON.stringify(available)} } }) },
      setModel: async (model) => picks.push(model.provider + '/' + model.id),
      setThinkingLevel: (level) => picks.push(level),
    };
    const model = await useMemoryModel(session);
    process.stdout.write(JSON.stringify({ model: model ? model.provider + '/' + model.id : null, picks }));`;

  const run = spawnSync(process.execPath, ['--input-type=module', '-e', script], { encoding: 'utf8', env: { ...process.env, HOME: home } });
  assert.equal(run.status, 0, run.stderr);

  return JSON.parse(run.stdout);
}

test('the session model is the first memory model that is available, never an unrelated one', () => {
  writeFileSync(join(agent, 'settings.json'), JSON.stringify({ 'observational-memory': { model: { provider: 'gone', id: 'model-x' } } }));
  writeFileSync(join(agent, 'hermes-memory-config.json'), JSON.stringify({ llmModelOverride: 'openai-codex/gpt-test', llmThinkingOverride: 'high' }));

  const anthropic = { provider: 'anthropic', id: 'claude-x' };
  const codex = { provider: 'openai-codex', id: 'gpt-test' };

  assert.deepEqual(chosen([anthropic, codex]), { model: 'openai-codex/gpt-test', picks: ['openai-codex/gpt-test', 'high'] });
  assert.deepEqual(chosen([anthropic]), { model: null, picks: [] });
});

// Prints where piPackage finds each of `names` for a user whose home is `homeDir`, or the error it throws.
function located(homeDir, names) {
  const script = `
    import { piPackage } from ${JSON.stringify(LIB)};
    try {
      process.stdout.write(JSON.stringify(${JSON.stringify(names)}.map((name) => piPackage(name))));
    } catch (error) {
      process.stdout.write(JSON.stringify(error.message));
    }`;
  const run = spawnSync(process.execPath, ['--input-type=module', '-e', script], { encoding: 'utf8', env: { ...process.env, HOME: homeDir } });
  assert.equal(run.status, 0, run.stderr);

  return JSON.parse(run.stdout);
}

// The npm layout's own path, beside the running node, is what pi-server.test.mjs loads on a machine
// where pi came from `npm install -g`.
test("pi packages come from the installer's current release, and a dependency nested under pi wins", () => {
  const release = join(agent, 'install', 'releases', '9.9.9', 'node_modules');
  const pi = join(release, '@earendil-works', 'pi-coding-agent');
  mkdirSync(join(pi, 'node_modules', 'jiti'), { recursive: true });
  writeFileSync(join(agent, 'install', 'current-version'), '9.9.9\n');

  assert.deepEqual(located(home, ['@earendil-works/pi-coding-agent', '@earendil-works/pi-ai', 'jiti']), [
    pi,
    join(release, '@earendil-works', 'pi-ai'),
    join(pi, 'node_modules', 'jiti'),
  ]);
});

test('a current-version naming a release that is gone is skipped', (t) => {
  const staleHome = mkdtempSync(join(tmpdir(), 'pi-workflow-stale-'));
  t.after(() => rmSync(staleHome, { recursive: true, force: true }));

  const install = join(staleHome, '.pi', 'agent', 'install');
  mkdirSync(install, { recursive: true });
  writeFileSync(join(install, 'current-version'), '8.8.8\n');

  // The answer is the npm install, or the not-installed error on a machine without one.
  assert.doesNotMatch(JSON.stringify(located(staleHome, ['@earendil-works/pi-coding-agent'])), /8\.8\.8/);
});
