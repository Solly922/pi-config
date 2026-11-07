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
