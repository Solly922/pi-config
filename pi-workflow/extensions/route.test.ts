import assert from 'node:assert/strict';
import test from 'node:test';
import { selectRoute } from './route.ts';
import {
  route, validateConfig, type Config, type ModelConfig,
} from '../../agent/git/github.com/Solly922/pi-jev-router/router.ts';

const params = { prompt: 'Find the sync code', description: 'find code', agent: 'Explore', effort: 'high' as const };
const agents = [{ name: 'Explore', description: 'Read-only code search' }];

function model(id: string, extra: Partial<ModelConfig> = {}): ModelConfig {
  return {
    id, tier: 'test', strengths: [], weaknesses: [],
    thinking: { supported: ['high'], default: 'high' },
    routing: { preferWhen: [], avoidWhen: [] },
    benchmarks: { artificialAnalysis: { intelligenceIndex: null, costPerTask: null } },
    ...extra,
  };
}

function config(models: ModelConfig[], extra: Partial<Config> = {}): Config {
  return validateConfig({ timeoutMs: 1000, models, agents: [{ name: 'Explore', builtin: true, description: 'Read-only code search' }], ...extra });
}

function deps(overrides: Partial<Parameters<typeof selectRoute>[3]> = {}): Parameters<typeof selectRoute>[3] {
  return {
    route, apiKey: '',
    fetcher: async () => { throw new Error('Unexpected network call'); },
    usage: async () => { throw new Error('Unexpected usage call'); },
    ...overrides,
  };
}

test('maps all native providers, effort and fast priority without inference or usage', async () => {
  for (const [prefix, providerInstanceId, fast, priority] of [
    ['claude-bridge', 'claudeAgent', false, false],
    ['anthropic', 'claudeAgent', false, false],
    ['openai-codex', 'codex', false, false],
    ['openai-codex', 'codex', true, true],
    ['openai-codex-fast', 'codex', false, true],
  ] as const) {
    let usageCalls = 0;
    const result = await selectRoute(config([model(`${prefix}/test-model`, { fast })]),
      { ...params, model: 'test-model' }, agents, deps({ usage: async () => { usageCalls++; return {}; } }));
    assert.equal(usageCalls, 0);

    const options: Record<string, string> = providerInstanceId === 'codex' ? { reasoningEffort: 'high' } : { effort: 'high' };
    if (priority) options.serviceTier = 'priority';

    assert.deepEqual(result, {
      agent: 'Explore', target: { providerInstanceId, model: 'test-model', options }, source: 'constraints',
    });
  }
});

test('maps a bare model and effort before validation and routing', async () => {
  const c = config([model('openai-codex/gpt-test', { thinking: { supported: ['low', 'high'], default: 'low' } })]);
  const result = await selectRoute(c, { ...params, model: 'gpt-test' }, agents, deps({
    route: async (received, input, definitions, signal, fetcher, apiKey, usage) => {
      assert.equal(input.model, 'openai-codex/gpt-test');
      assert.equal(input.thinking, 'high');
      assert.equal('effort' in input, false);
      assert.deepEqual(usage, {});
      assert.deepEqual(definitions, agents);

      return route(received, input, definitions, signal, fetcher, apiKey, usage);
    },
  }));

  assert.equal(result.target.model, 'gpt-test');
  assert.equal(result.source, 'constraints');
});

test('rejects unknown, qualified and ambiguous model IDs before routing', async () => {
  const c = config([model('openai-codex/shared'), model('anthropic/shared')]);
  for (const name of ['missing', 'openai-codex/shared']) {
    await assert.rejects(selectRoute(c, { ...params, model: name }, agents, deps()), /Unknown bare T3 model ID/);
  }

  await assert.rejects(selectRoute(c, { ...params, model: 'shared' }, agents, deps()), /Ambiguous bare T3 model ID: shared/);
});

test('skips unknown provider prefixes without mutating config', async () => {
  const c = config([model('other/unsupported'), model('openai-codex/supported')]);
  const original = structuredClone(c);
  const result = await selectRoute(c, params, agents, deps({
    route: async (received, ...args) => {
      assert.deepEqual(received.models.map(m => m.id), ['openai-codex/supported']);

      return route(received, ...args);
    },
  }));

  assert.equal(result.target.model, 'supported');
  assert.deepEqual(c, original);
  await assert.rejects(selectRoute(c, { ...params, model: 'unsupported' }, agents, deps()), /Unknown bare T3 model ID/);
  await assert.rejects(selectRoute(config([model('other/unsupported')]), params, agents, deps()), /No configured models have a supported T3 provider prefix/);
});

test('uses a stubbed Jev fetch answer and collects usage only for native candidates', async () => {
  const c = config([
    model('other/unsupported'), model('openai-codex/first'), model('claude-bridge/second'),
  ]);
  let usageCalls = 0;
  let fetchCalls = 0;
  const result = await selectRoute(c, params, agents, deps({
    apiKey: 'test-key',
    usage: async (received, models) => {
      usageCalls++;
      assert.deepEqual(received.models.map(m => m.id), models);
      assert.deepEqual(models, ['openai-codex/first', 'claude-bridge/second']);

      return { 'claude-bridge/second': { status: 'unknown' } };
    },
    fetcher: async (url, init) => {
      fetchCalls++;
      assert.equal(url, 'https://api.typesafe.ai/v1/systemone');

      const body = JSON.parse(init!.body as string);
      assert.equal(body.state.task, params.prompt);
      assert.equal(body.questions.agent, undefined);
      assert.deepEqual(Object.keys(body.questions.execution.criteria), ['option_0', 'option_1', 'none']);
      assert.equal(body.questions.execution.criteria.option_1.id, 'claude-bridge/second');
      assert.deepEqual(body.questions.execution.criteria.option_1.usage, { status: 'unknown' });

      return Response.json({ answers: { execution: { type: 'choice', choice: 'option_1' } } });
    },
  }));

  assert.equal(usageCalls, 1);
  assert.equal(fetchCalls, 1);
  assert.deepEqual(result, {
    agent: 'Explore', target: { providerInstanceId: 'claudeAgent', model: 'second', options: { effort: 'high' } }, source: 'jev',
  });
});

test('usage failures become empty usage and multiple effort pairs still collect once', async () => {
  const c = config([model('openai-codex/test', { thinking: { supported: ['low', 'high'], default: 'high' } })]);
  let usageCalls = 0;
  const result = await selectRoute(c, { ...params, effort: undefined }, agents, deps({
    usage: async (_received, models) => {
      usageCalls++;
      assert.deepEqual(models, ['openai-codex/test']);
      throw new Error('Quota unavailable');
    },
    route: async (_received, input, _agents, _signal, _fetcher, _key, usage) => {
      assert.equal(input.thinking, undefined);
      assert.deepEqual(usage, {});

      return { agent: 'Explore', model: 'openai-codex/test', thinking: 'low', source: 'jev' };
    },
  }));

  assert.equal(usageCalls, 1);
  assert.deepEqual(result.target.options, { reasoningEffort: 'low' });
});

test('preserves router validation, cancellation and explicit fallback source', async () => {
  const c = config([model('openai-codex/test')]);
  await assert.rejects(selectRoute(c, { ...params, prompt: ' ' }, agents, deps()), /Provide a nonempty prompt/);
  await assert.rejects(selectRoute(c, { ...params, agent: 'missing' }, agents, deps()), /Agent override/);
  await assert.rejects(selectRoute(c, { ...params, effort: 'low' }, agents, deps()), /No configured model supports/);
  await assert.rejects(selectRoute(c, params, agents, deps({ signal: AbortSignal.abort() })), { name: 'AbortError' });

  const fallback = { agent: 'Explore', model: 'openai-codex/test', thinking: 'high' as const };
  const result = await selectRoute(config([model('openai-codex/test'), model('anthropic/second')], { fallback }),
    params, agents, deps());

  assert.equal(result.source, 'explicit-fallback');
  assert.equal(result.target.model, 'test');
});
