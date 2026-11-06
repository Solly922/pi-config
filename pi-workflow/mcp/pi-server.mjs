#!/usr/bin/env node
// MCP server for native Claude Code and Codex threads. It runs pi extensions (Hermes memory and Jev
// routing) inside a headless pi session and exposes their tools, so both harnesses share pi's memory.

import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { readFile, readdir, stat } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { Writable } from 'node:stream';
import { fileURLToPath } from 'node:url';

import {
  AGENT_DIR, CODEX_IMAGES, HERMES_SRC, OBSERVATIONAL_MEMORY, PI_NODE_MODULES, importFile, piReleaseModules, shadowDir, shadowPaths,
} from '../lib/pi.mjs';

// MCP owns stdout, and Hermes and pi log progress with console.info. Everything except protocol
// messages goes to stderr, which both harnesses keep as the server's log.
const writeProtocol = process.stdout.write.bind(process.stdout);
process.stdout.write = process.stderr.write.bind(process.stderr);

// Marks this process as pi, so a Claude Code the extensions launch (through pi's Claude bridge)
// skips the native hooks.
process.env.PI_CODING_AGENT = 'true';

const HERE = dirname(fileURLToPath(import.meta.url));
const PI_MODULES = join(piReleaseModules(), '@earendil-works');
const MCP_SDK = join(PI_NODE_MODULES, '@modelcontextprotocol', 'sdk', 'dist', 'esm');

const EXTENSIONS = [
  {
    path: join(HERMES_SRC, 'index.ts'),
    tools: ['memory_add', 'memory_replace', 'memory_remove', 'memory_search', 'session_search', 'skill_manage'],
  },
  { path: join(HERE, '..', 'extensions', 'route.ts'), tools: ['route'] },
  { path: join(OBSERVATIONAL_MEMORY, 'dist', 'index.ts'), tools: ['recall'] },
  { path: CODEX_IMAGES, tools: ['generate_image'] },
];
const EXPOSED = EXTENSIONS.flatMap((extension) => extension.tools);
// These change which skill folders exist, so the native skill links need a sync afterwards.
const SKILL_SET_ACTIONS = new Set(['create', 'delete']);
const SHUTDOWN_WAIT_MS = 5_000;

const { Server } = await importFile(join(MCP_SDK, 'server', 'index.js'));
const { StdioServerTransport } = await importFile(join(MCP_SDK, 'server', 'stdio.js'));
const { CallToolRequestSchema, ListToolsRequestSchema } = await importFile(join(MCP_SDK, 'types.js'));

const ready = startPiSession(process.cwd()).catch((error) => {
  console.error('pi MCP server: could not start the pi session', { cwd: process.cwd(), error });
  throw error;
});

// Registered before startup finishes, so a client that gives up during startup still gets a clean shutdown.
process.stdin.on('end', shutDown);
process.on('SIGTERM', shutDown);
process.on('SIGINT', shutDown);

// The instructions come from the pi session, so initialize waits for it. Clients wait for
// tools/list anyway, which needs the session too. A failed start still serves, with tool errors.
const instructions = await ready.then((state) => state.instructions, () => undefined);

const server = new Server({ name: 'pi', version: '1.0.0' }, { capabilities: { tools: {} }, instructions });
server.setRequestHandler(ListToolsRequestSchema, listTools);
server.setRequestHandler(CallToolRequestSchema, callTool);

const protocolOut = new Writable({
  write(chunk, encoding, callback) {
    writeProtocol(chunk, encoding, callback);
  },
});
await server.connect(new StdioServerTransport(process.stdin, protocolOut));

async function startPiSession(cwd) {
  const sdk = await importFile(join(PI_MODULES, 'pi-coding-agent', 'dist', 'index.js'));
  const { validateToolArguments } = await importFile(join(PI_MODULES, 'pi-ai', 'dist', 'index.js'));

  const settingsManager = sdk.SettingsManager.inMemory({});
  const loader = new sdk.DefaultResourceLoader({
    cwd,
    agentDir: AGENT_DIR,
    settingsManager,
    noExtensions: true,
    additionalExtensionPaths: EXTENSIONS.map((extension) => extension.path).filter((path) => existsSync(path)),
    noSkills: true,
    noPromptTemplates: true,
    noThemes: true,
    noContextFiles: true,
  });
  await loader.reload();

  for (const { path, error } of loader.getExtensions().errors) {
    console.error('pi MCP server: extension failed to load', { path, error });
  }

  const { session } = await sdk.createAgentSession({
    cwd,
    agentDir: AGENT_DIR,
    resourceLoader: loader,
    settingsManager,
    sessionManager: sdk.SessionManager.inMemory(cwd),
    noTools: 'builtin',
  });
  await session.bindExtensions({ mode: 'print' });

  const missing = EXPOSED.filter((name) => !session.getToolDefinition(name));
  if (missing.length > 0) console.error('pi MCP server: tools not registered', { missing });

  // Hermes adds its memory policy and pinned instructions to pi's prompt in this event.
  const { systemPromptOptions } = await session.extensionRunner.emitBeforeAgentStart({ prompt: '', images: [] }, {});

  return { sdk, session, validateToolArguments, instructions: systemPromptOptions.appendSystemPrompt.trim() || undefined };
}

async function listTools() {
  const { session } = await ready;

  const tools = EXPOSED.flatMap((name) => {
    const definition = session.getToolDefinition(name);
    if (!definition) return [];

    return [{ name, description: describe(definition), inputSchema: JSON.parse(JSON.stringify(definition.parameters)) }];
  });

  return { tools };
}

// pi shows a tool's guidelines in the system prompt; MCP has only the description to carry them.
function describe(definition) {
  const guidelines = definition.promptGuidelines ?? [];
  if (guidelines.length === 0) return definition.description;

  return `${definition.description}\n\nGuidelines:\n${guidelines.map((line) => `- ${line}`).join('\n')}`;
}

async function callTool(request, extra) {
  const { name, arguments: rawArguments = {} } = request.params;
  const { sdk, session, validateToolArguments } = await ready;
  const definition = EXPOSED.includes(name) ? session.getToolDefinition(name) : undefined;
  if (!definition) return errorResult(`Unknown tool: ${name}`);

  try {
    const prepared = definition.prepareArguments ? definition.prepareArguments(rawArguments) : rawArguments;
    const args = validateToolArguments(
      { name, description: definition.description, parameters: definition.parameters },
      { type: 'toolCall', id: String(extra.requestId), name, arguments: prepared },
    );

    const ctx = name === 'recall' ? await recallContext(sdk, session, args.id, extra.signal) : session.extensionRunner.createContext();
    const result = await definition.execute(String(extra.requestId), args, extra.signal, () => {}, ctx);
    if (name === 'skill_manage' && SKILL_SET_ACTIONS.has(args.action)) resyncNativeConfig();

    return { content: result.content.map(toMcpContent) };
  } catch (error) {
    console.error('pi MCP server: tool call failed', { tool: name, cwd: session.cwd, error });
    return errorResult(error instanceof Error ? error.message : String(error));
  }
}

// Observational memory's recall reads the current session's ledger. Here the memory lives in the
// shadow session of whichever native thread recorded the id.
async function recallContext(sdk, session, id, signal) {
  const ctx = Object.defineProperties({}, Object.getOwnPropertyDescriptors(session.extensionRunner.createContext()));
  const file = await shadowSessionWith(id, signal);
  if (file) Object.defineProperty(ctx, 'sessionManager', { value: sdk.SessionManager.open(file) });

  return ctx;
}

// Claude names its thread to MCP servers, so that thread's shadow session is tried first. The
// others are read newest first, without blocking the server's other tool calls.
async function shadowSessionWith(id, signal) {
  const needle = `"id":"${id}"`;
  const current = currentClaudeShadow();
  if (current && (await contains(current, needle))) return current;

  const files = [];
  for (const harness of ['claude', 'codex']) {
    const dir = shadowDir(harness);
    if (!existsSync(dir)) continue;

    for (const name of await readdir(dir)) {
      if (name.endsWith('.jsonl')) files.push({ path: join(dir, name), modified: (await stat(join(dir, name))).mtimeMs });
    }
  }
  files.sort((a, b) => b.modified - a.modified);

  for (const { path } of files) {
    signal?.throwIfAborted();
    if (path !== current && (await contains(path, needle))) return path;
  }

  return undefined;
}

function currentClaudeShadow() {
  try {
    return process.env.CLAUDE_CODE_SESSION_ID ? shadowPaths('claude', process.env.CLAUDE_CODE_SESSION_ID).file : undefined;
  } catch {
    return undefined;
  }
}

async function contains(path, needle) {
  try {
    return (await readFile(path, 'utf8')).includes(needle);
  } catch {
    return false;
  }
}

function toMcpContent(part) {
  if (part.type === 'image') return { type: 'image', data: part.data, mimeType: part.mimeType };
  return { type: 'text', text: part.text ?? '' };
}

function errorResult(message) {
  return { isError: true, content: [{ type: 'text', text: message }] };
}

function resyncNativeConfig() {
  const sync = spawn(process.execPath, [join(HERE, '..', 'sync.mjs')], { stdio: ['ignore', 'ignore', 'pipe'] });

  let stderr = '';
  sync.stderr.on('data', (chunk) => {
    stderr += chunk;
  });
  sync.on('close', (code) => {
    if (code !== 0) console.error('pi MCP server: sync after skill_manage failed', { code, stderr });
  });
}

let shuttingDown;

// session_shutdown lets Hermes checkpoint and close its SQLite database. A session that never
// finishes starting has nothing to close, so the wait is bounded.
function shutDown() {
  shuttingDown ??= (async () => {
    try {
      const state = await Promise.race([ready, new Promise((resolve) => setTimeout(resolve, SHUTDOWN_WAIT_MS))]);
      if (!state) return;

      await state.session.extensionRunner.emit({ type: 'session_shutdown', reason: 'quit' });
      state.session.dispose();
    } catch (error) {
      console.error('pi MCP server: shutdown failed', { error });
    } finally {
      process.exit(0);
    }
  })();
}
