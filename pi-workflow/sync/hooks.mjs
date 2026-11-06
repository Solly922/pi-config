// Native hooks: which hooks/run.mjs handler runs on which Claude Code and Codex event, written to
// Claude's settings.json and to a Codex hooks.json that Codex is then told to trust.

import { spawn } from 'node:child_process';
import { existsSync, readFileSync, realpathSync } from 'node:fs';
import { createInterface } from 'node:readline';
import { join } from 'node:path';

import {
  CLAUDE_HOME, CODEX_ENV, CODEX_HOME, DRY_RUN, GENERATED, WORKFLOW_DIR, readJson, warn, writeIfChanged,
} from './context.mjs';

const HOOK_RUNNER = join(WORKFLOW_DIR, 'hooks', 'run.mjs');
export const CODEX_HOOKS = join(CODEX_HOME, 'hooks.json');
const APP_SERVER_TIMEOUT_MS = 20_000;

const HOOKS = [
  { event: 'SessionStart', handler: 'session-context', timeout: 15 },
  { event: 'SessionStart', handler: 'shadow', timeout: 10 },
  { event: 'SessionStart', handler: 'observations', timeout: 15 },
  { event: 'SessionStart', handler: 'ponytail-activate', timeout: 15 },
  { event: 'UserPromptSubmit', handler: 'wiki-recall', timeout: 10 },
  { event: 'UserPromptSubmit', handler: 'shadow', timeout: 10 },
  { event: 'UserPromptSubmit', handler: 'ponytail-mode', timeout: 10 },
  { event: 'SubagentStart', handler: 'ponytail-subagent', timeout: 10 },
  { event: 'PreToolUse', matcher: { claude: 'Bash', codex: '^Bash$' }, handler: 'rtk', timeout: 10 },
  { event: 'PreToolUse', matcher: { claude: 'Write|Edit|MultiEdit|NotebookEdit', codex: '^apply_patch$' }, handler: 'wiki-guard', timeout: 5 },
];

function hookCommand(harness, handler) {
  return `node ${JSON.stringify(HOOK_RUNNER)} ${harness} ${handler}`;
}

function hookConfig(harness) {
  const config = {};

  for (const { event, matcher, handler, timeout } of HOOKS) {
    const group = { ...(matcher ? { matcher: matcher[harness] } : {}), hooks: [{ type: 'command', command: hookCommand(harness, handler), timeout }] };
    (config[event] ??= []).push(group);
  }

  return config;
}

function isOurHook(hook) {
  return typeof hook?.command === 'string' && hook.command.includes(HOOK_RUNNER);
}

export function syncClaudeHooks() {
  const path = join(CLAUDE_HOME, 'settings.json');

  // A change Claude Code makes to settings.json between this read and the write is lost. Claude Code
  // rarely writes the user file, so the race is accepted.
  writeIfChanged(path, `${JSON.stringify(withOurHooks(readJson(path) ?? {}), null, 2)}\n`);

  // T3 has no Claude statusline, so ponytail's one-time offer to set one up would only be noise.
  const nudged = join(CLAUDE_HOME, '.ponytail-statusline-nudged');
  if (!existsSync(nudged)) writeIfChanged(nudged, '');
}

function withOurHooks(settings) {
  const hooks = {};

  // The user's own hooks stay in place and ours go after them, so reruns write the same file.
  for (const [event, groups] of Object.entries(settings.hooks ?? {})) {
    const kept = groups
      .map((group) => ({ ...group, hooks: (group.hooks ?? []).filter((hook) => !isOurHook(hook)) }))
      .filter((group) => group.hooks.length > 0);
    if (kept.length > 0) hooks[event] = kept;
  }

  for (const [event, groups] of Object.entries(hookConfig('claude'))) hooks[event] = [...(hooks[event] ?? []), ...groups];

  return { ...settings, hooks };
}

// Returns the trust entries for config.toml: [{ key, hash }], or undefined to keep the current ones.
export async function syncCodexHooks() {
  if (existsSync(CODEX_HOOKS) && !readFileSync(CODEX_HOOKS, 'utf8').includes(GENERATED)) {
    warn(`${CODEX_HOOKS} exists and pi-workflow does not manage it; skipped Codex hooks`);
    return [];
  }

  const description = `${GENERATED}. Edit HOOKS in sync/hooks.mjs, then rerun it.`;
  const content = `${JSON.stringify({ description, hooks: hookConfig('codex') }, null, 2)}\n`;
  writeIfChanged(CODEX_HOOKS, content);
  if (DRY_RUN) return undefined;

  // Codex skips a user hook until its exact definition is trusted, as its /hooks screen does.
  // The app server reports each hook's key and hash; config.toml records the trusted hash.
  const listed = await listCodexHooks();
  if (!listed) return undefined;

  // Trust only definitions identical to the ones sync wrote, and only if the file still holds them,
  // so a hooks.json swapped in meanwhile never gets trusted.
  if (readFileSync(CODEX_HOOKS, 'utf8') !== content) {
    warn(`${CODEX_HOOKS} changed while sync was trusting it; its hooks stay untrusted until the next sync`);
    return undefined;
  }

  // Every field Codex hashes must match, so a variant of one of ours, such as an async copy of the
  // wiki guard that could no longer deny an edit, is not trusted either.
  const source = realpathSync(CODEX_HOOKS);
  const expected = HOOKS.map((hook) => ({
    eventName: hook.event[0].toLowerCase() + hook.event.slice(1),
    matcher: hook.matcher?.codex ?? null,
    handlerType: 'command',
    command: hookCommand('codex', hook.handler),
    async: false,
    timeoutSec: hook.timeout,
    statusMessage: null,
    additionalContextLimit: null,
  }));

  // Codex reports the path it found hooks.json at, which may be a symlink to the file sync wrote.
  return listed
    .filter((hook) => hook.source === 'user' && realpath(hook.sourcePath) === source)
    .filter((hook) => expected.some((wanted) => Object.entries(wanted).every(([field, value]) => hook[field] === value)))
    .map((hook) => ({ key: hook.key, hash: hook.currentHash }));
}

function realpath(path) {
  try {
    return realpathSync(path);
  } catch {
    return path;
  }
}

function listCodexHooks() {
  return new Promise((resolve) => {
    const child = spawn('codex', ['app-server'], { env: CODEX_ENV, cwd: '/', stdio: ['pipe', 'pipe', 'pipe'] });
    let stderr = '';

    const finish = (hooks, problem) => {
      clearTimeout(timer);
      child.kill();
      if (problem) warn(`could not read Codex hook trust, so the hooks may stay untrusted: ${problem}${stderr ? `\n${stderr.trim()}` : ''}`);
      resolve(hooks);
    };

    const timer = setTimeout(() => finish(undefined, 'codex app-server did not answer'), APP_SERVER_TIMEOUT_MS);

    child.on('error', (error) => finish(undefined, error.message));
    child.stderr.on('data', (chunk) => {
      stderr += chunk;
    });

    createInterface({ input: child.stdout }).on('line', (line) => {
      let message;
      try {
        message = JSON.parse(line);
      } catch {
        return;
      }

      if (message.id !== 2) return;
      if (message.error) return finish(undefined, message.error.message);

      const hooks = message.result?.data?.flatMap((entry) => entry.hooks ?? []);
      finish(hooks, hooks ? undefined : 'unexpected hooks/list answer');
    });

    // codex app-server quits as soon as its input closes, before answering, so stdin stays open
    // until finish() kills it.
    const send = (message) => child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', ...message })}\n`);
    send({ id: 1, method: 'initialize', params: { clientInfo: { name: 'pi-workflow', version: '1' } } });
    send({ method: 'initialized' });
    send({ id: 2, method: 'hooks/list', params: { cwds: ['/'] } });
  });
}
