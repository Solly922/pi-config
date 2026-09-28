import { readFile } from 'node:fs/promises';

const THINKING_LEVELS = ['off', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max'] as const;
export type TitleThinking = (typeof THINKING_LEVELS)[number];

export type AutoNameConfig = {
  /** Title model as `provider/model-id`. The id may itself contain slashes (OpenRouter). */
  model: string;
  /** Reasoning level for the title call. Titles need almost none. */
  thinking: TitleThinking;
  /** Re-check the title after this many user prompts. */
  retitleEvery: number;
  /** Give up on a title request after this many milliseconds. */
  timeoutMs: number;
};

export const DEFAULT_CONFIG: AutoNameConfig = {
  model: 'openai-codex/gpt-6-luna',
  thinking: 'low',
  retitleEvery: 5,
  timeoutMs: 15_000,
};

/**
 * Validate a parsed config.json field by field. A bad field falls back to its
 * default and is reported, so one typo does not disable the whole extension.
 */
export function parseConfig(raw: unknown): { config: AutoNameConfig; problems: string[] } {
  const config = { ...DEFAULT_CONFIG };
  const problems: string[] = [];
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    return { config, problems: ['config must be a JSON object'] };
  }
  const input = raw as Record<string, unknown>;

  if (input.model !== undefined) {
    const valid = typeof input.model === 'string' && /^[^/\s]+\/\S+$/.test(input.model);
    if (valid) config.model = input.model as string;
    else problems.push('model must look like "provider/model-id"');
  }

  if (input.thinking !== undefined) {
    const valid = THINKING_LEVELS.includes(input.thinking as TitleThinking);
    if (valid) config.thinking = input.thinking as TitleThinking;
    else problems.push(`thinking must be one of ${THINKING_LEVELS.join(', ')}`);
  }

  if (input.retitleEvery !== undefined) {
    const valid = Number.isInteger(input.retitleEvery) && (input.retitleEvery as number) >= 1;
    if (valid) config.retitleEvery = input.retitleEvery as number;
    else problems.push('retitleEvery must be a whole number of at least 1');
  }

  if (input.timeoutMs !== undefined) {
    // Node fires timers above ~24.8 days immediately, so cap well below that.
    const valid = Number.isInteger(input.timeoutMs) && (input.timeoutMs as number) >= 1000 && (input.timeoutMs as number) <= 600_000;
    if (valid) config.timeoutMs = input.timeoutMs as number;
    else problems.push('timeoutMs must be a whole number from 1000 to 600000');
  }

  return { config, problems };
}

/** Read the optional config file. A missing file means defaults, not an error. */
export async function loadConfig(path: string): Promise<{ config: AutoNameConfig; problems: string[] }> {
  let text: string;
  try {
    text = await readFile(path, 'utf8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return { config: { ...DEFAULT_CONFIG }, problems: [] };
    return { config: { ...DEFAULT_CONFIG }, problems: [`cannot read ${path}: ${(error as Error).message}`] };
  }
  try {
    return parseConfig(JSON.parse(text));
  } catch (error) {
    return { config: { ...DEFAULT_CONFIG }, problems: [`invalid JSON in ${path}: ${(error as Error).message}`] };
  }
}
