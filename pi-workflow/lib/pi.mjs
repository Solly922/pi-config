// Locations of the installed pi runtime and of the pi packages the native harnesses reuse.

import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

export const AGENT_DIR = join(homedir(), '.pi', 'agent');
export const PI_NODE_MODULES = join(AGENT_DIR, 'npm', 'node_modules');
export const HERMES_SRC = join(PI_NODE_MODULES, 'pi-hermes-memory', 'src');
export const WIKI_PACKAGE = join(PI_NODE_MODULES, '@zosmaai', 'pi-llm-wiki');
export const PONYTAIL_ROOT = join(AGENT_DIR, 'git', 'github.com', 'DietrichGebert', 'ponytail');
export const OBSERVATIONAL_MEMORY = join(AGENT_DIR, 'git', 'github.com', 'elpapi42', 'pi-observational-memory');
export const CODEX_IMAGES = join(AGENT_DIR, 'extensions', 'codex-images', 'index.ts');

// Shadow sessions live one folder below pi's sessions folder, where Hermes indexes every session
// file, so session_search covers native threads too.
export function shadowDir(harness) {
  if (!['claude', 'codex'].includes(harness)) throw new Error(`unknown harness ${harness}`);
  return join(AGENT_DIR, 'sessions', `native-${harness}`);
}

export function shadowPaths(harness, sessionId) {
  if (!/^[\w-]{1,128}$/.test(sessionId)) throw new Error(`unexpected session id ${JSON.stringify(sessionId)}`);

  const dir = shadowDir(harness);
  const base = join(dir, sessionId);
  return { dir, file: `${base}.jsonl`, state: `${base}.state.json`, pid: `${base}.pid`, log: `${base}.log` };
}

// Makes a headless pi session's model one the memory extensions are set to use, so an extension that
// falls back to the session model stays on it instead of pi's first available model, which here is
// Anthropic through pi's own OAuth login. Returns the model chosen, or undefined when none is usable.
export async function useMemoryModel(session) {
  const available = session.extensionRunner.createContext().modelRegistry.getAvailable();

  for (const candidate of memoryModels()) {
    const model = available.find((entry) => entry.provider === candidate.provider && entry.id === candidate.id);
    if (!model) continue;

    await session.setModel(model);
    if (candidate.thinking) session.setThinkingLevel(candidate.thinking);
    return model;
  }

  return undefined;
}

// Each extension's model, then its fallbacks, in the order the extensions try them.
function memoryModels() {
  const memory = readJson(join(AGENT_DIR, 'settings.json'))?.['observational-memory'] ?? {};
  const hermes = readJson(join(AGENT_DIR, 'hermes-memory-config.json')) ?? {};
  const hermesRefs = [hermes.llmModelOverride, ...(Array.isArray(hermes.llmFallbackModels) ? hermes.llmFallbackModels : [])];

  return [
    memory.model,
    memory.fallbackModel,
    ...hermesRefs.map((ref) => modelReference(ref, hermes.llmThinkingOverride)),
  ].filter((model) => typeof model?.provider === 'string' && typeof model?.id === 'string');
}

function modelReference(ref, thinking) {
  const [provider, ...id] = typeof ref === 'string' ? ref.trim().split('/') : [];
  return provider && id.length > 0 ? { provider, id: id.join('/'), thinking } : undefined;
}

function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return undefined;
  }
}

// pi installs each release under its own folder and records the active one here.
export function piReleaseModules() {
  const version = readFileSync(join(AGENT_DIR, 'install', 'current-version'), 'utf8').trim();
  return join(AGENT_DIR, 'install', 'releases', version, 'node_modules');
}

export function importFile(path) {
  return import(pathToFileURL(path).href);
}

// pi's own TypeScript loader, for pi packages that ship only .ts sources inside node_modules,
// where Node refuses to strip types.
export async function piTypeScriptLoader() {
  const { createJiti } = await importFile(join(piReleaseModules(), 'jiti', 'lib', 'jiti.mjs'));
  return createJiti(import.meta.url);
}
