import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import {
  route, validateConfig, validateInput, pairs, FAST_CODEX, THINKING,
  type Agent, type Config, type Input, type Thinking,
} from '../../agent/git/github.com/Solly922/pi-jev-router/router.ts';
import { collectUsage, type UsageReport } from '../../agent/git/github.com/Solly922/pi-jev-router/usage.ts';
import { codexUsage } from '../../agent/git/github.com/Solly922/pi-jev-router/usage-codex.ts';
import { claudeUsage } from '../../agent/git/github.com/Solly922/pi-jev-router/usage-claude.ts';

const PROVIDERS = new Map<string, 'codex' | 'claudeAgent'>([
  ['claude-bridge', 'claudeAgent'], ['anthropic', 'claudeAgent'],
  ['openai-codex', 'codex'], ['openai-codex-fast', 'codex'],
]);

type Params = { prompt: string; description: string; agent?: string; model?: string; effort?: Thinking };
type Details = {
  agent: string;
  target: { providerInstanceId: 'codex' | 'claudeAgent'; model: string; options: Record<string, string> };
  source: string;
};
type Dependencies = {
  route: typeof route;
  usage: (config: Config, models: string[], signal?: AbortSignal) => Promise<Record<string, UsageReport>>;
  fetcher: typeof fetch;
  apiKey: string | undefined;
  signal?: AbortSignal;
};

export async function selectRoute(config: Config, params: Params, agents: Agent[], deps: Dependencies): Promise<Details> {
  const nativeConfig = { ...config, models: config.models.filter(m => PROVIDERS.has(m.id.split('/')[0])) };
  if (!nativeConfig.models.length) throw new Error('No configured models have a supported T3 provider prefix.');

  let model: string | undefined;
  if (params.model !== undefined) {
    const matches = params.model.includes('/') ? [] : nativeConfig.models.filter(m => m.id.endsWith(`/${params.model}`));
    if (!matches.length) throw new Error(`Unknown bare T3 model ID: ${params.model}. Check jev-router/config.json.`);
    if (matches.length > 1) throw new Error(`Ambiguous bare T3 model ID: ${params.model}. Multiple configured providers use it.`);
    model = matches[0].id;
  }

  const input: Input = { prompt: params.prompt, description: params.description, agent: params.agent, model, thinking: params.effort };
  validateInput(nativeConfig, input);
  deps.signal?.throwIfAborted();

  const candidates = pairs(nativeConfig, input);
  let usage: Record<string, UsageReport> = {};
  if (candidates.length > 1) {
    try {
      usage = await deps.usage(nativeConfig, [...new Set(candidates.map(c => c.model))], deps.signal);
    } catch {
      usage = {};
    }
  }

  const selection = await deps.route(nativeConfig, input, agents, deps.signal, deps.fetcher, deps.apiKey, usage);
  deps.signal?.throwIfAborted();

  const entry = nativeConfig.models.find(m => m.id === selection.model)!;
  const providerInstanceId = PROVIDERS.get(entry.id.split('/')[0])!;
  const options: Record<string, string> = providerInstanceId === 'codex'
    ? { reasoningEffort: selection.thinking }
    : { effort: selection.thinking };
  // Codex's priority tier is fast mode: a fast entry asks for it, and the fast provider always runs there.
  if (entry.fast === true || entry.id.startsWith(`${FAST_CODEX}/`)) options.serviceTier = 'priority';

  return {
    agent: selection.agent,
    target: { providerInstanceId, model: entry.id.slice(entry.id.indexOf('/') + 1), options },
    source: selection.source,
  };
}

export default async function (pi: ExtensionAPI) {
  // Defer Pi's loader aliases so plain Node can import and test selectRoute without Pi installed locally.
  const { Type } = await import('typebox');
  const { StringEnum } = await import('@earendil-works/pi-ai');
  const { getAgentDir, parseFrontmatter } = await import('@earendil-works/pi-coding-agent');

  pi.registerTool({
    name: 'route',
    label: 'Route native task',
    description: 'Select an existing agent, model and effort for a native subagent without launching it. Omit constraints for Jev selection; explicit values are hard constraints. Sends the task and routing metadata to TypeSafe when selection is needed. Pass the returned target to delegate_task.',
    parameters: Type.Object({
      prompt: Type.String({ minLength: 1, maxLength: 32000 }),
      description: Type.String({ minLength: 1, maxLength: 200 }),
      agent: Type.Optional(Type.String({ description: 'Exact configured agent name, otherwise auto-select.' })),
      model: Type.Optional(Type.String({ description: 'Bare T3 model ID, not provider/model, otherwise auto-select.' })),
      effort: Type.Optional(StringEnum(THINKING)),
    }, { additionalProperties: false }),
    async execute(_id, params, signal, _update, ctx) {
      const configPath = resolve(getAgentDir(), 'jev-router/config.json');
      let configText: string;
      try {
        configText = await readFile(configPath, 'utf8');
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
          throw new Error(`Jev router config missing at ${configPath}. Copy config.example.json there and edit it.`);
        }
        throw error;
      }

      let config: Config;
      try {
        config = validateConfig(JSON.parse(configText));
      } catch (error) {
        throw new Error(`Invalid Jev router config at ${configPath}: ${error instanceof Error ? error.message : String(error)}`);
      }

      const agents = await Promise.all(config.agents.map(async entry => {
        if ('builtin' in entry) return { name: entry.name, description: entry.description };

        const path = resolve(dirname(configPath), entry.definition);
        let text: string;
        try {
          text = await readFile(path, 'utf8');
        } catch (error) {
          throw new Error(`Cannot read Jev agent ${entry.name} at ${path}: ${error instanceof Error ? error.message : String(error)}`);
        }

        const { frontmatter } = parseFrontmatter(text.replace(/^\uFEFF/, ''));
        if (frontmatter.enabled === false || typeof frontmatter.description !== 'string' || !frontmatter.description.trim()) {
          throw new Error(`Agent ${entry.name} is disabled or has no description. Check its configured definition path: ${path}.`);
        }

        return { name: entry.name, description: frontmatter.description };
      }));

      const details = await selectRoute(config, params, agents, {
        route, signal, fetcher: fetch, apiKey: process.env.TYPESAFE_API_KEY,
        usage: (c, models, usageSignal) => collectUsage(c, models, { codex: codexUsage, claude: claudeUsage },
          { available: ctx.modelRegistry.getAvailable(), registry: ctx.modelRegistry }, usageSignal),
      });
      const effort = details.target.options.effort ?? details.target.options.reasoningEffort;

      return {
        content: [{ type: 'text', text: `Selected ${details.agent}: provider ${details.target.providerInstanceId}, model ${details.target.model}, effort ${effort}. Route: ${details.source}. Launch it with delegate_task, passing the target JSON below as its target. A native subagent keeps this choice only if that agent already runs on this model and effort.\nagent: ${details.agent}\ntarget: ${JSON.stringify(details.target)}` }],
        details,
      };
    },
  });
}
