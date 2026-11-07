// MCP servers for native threads: the pi server plus the servers pi itself connects to.

import { join } from 'node:path';

import {
  CLAUDE_ENV, CLAUDE_JSON, DRY_RUN, PI_AGENT, WORKFLOW_DIR, log, readJson, runCli, sameJson, tomlString, warn,
} from './context.mjs';

// Claude's stdio servers carry this variable so sync can tell its entries from the user's own.
const OWNER_ENV = { PI_WORKFLOW: '1' };

export const MCP_SERVERS = {
  pi: {
    command: 'node',
    args: [join(WORKFLOW_DIR, 'mcp', 'pi-server.mjs')],
    // Codex passes MCP servers only a few variables. route needs TypeSafe's key, Hermes runs `pi`
    // from PATH, and the sync after skill_manage needs the profile folders.
    codex: { env_vars: ['TYPESAFE_API_KEY', 'PATH', 'CODEX_HOME', 'CLAUDE_CONFIG_DIR'], startup_timeout_sec: 30 },
  },
  'llm-wiki': {
    command: 'node',
    args: [join(PI_AGENT, 'npm', 'node_modules', '@zosmaai', 'pi-llm-wiki', 'dist', 'mcp', 'index.js')],
    // From the package's docs/harnesses.md.
    codex: { startup_timeout_sec: 20, tool_timeout_sec: 120 },
  },
  codegraph: { command: 'codegraph', args: ['serve', '--mcp'] },
  context7: { url: 'https://mcp.context7.com/mcp' },
  gh_grep: { url: 'https://mcp.grep.app' },
};

// Returns false when a Claude CLI call failed. A missing Claude CLI is not a failure: there is
// nothing to sync into.
export function syncClaudeServers() {
  const current = readJson(CLAUDE_JSON)?.mcpServers ?? {};
  const changes = [];

  for (const [name, server] of Object.entries(MCP_SERVERS)) {
    const wanted = server.url ? { type: 'http', url: server.url } : { type: 'stdio', command: server.command, args: server.args, env: OWNER_ENV };
    const existing = current[name];
    if (sameJson(existing, wanted)) continue;

    if (existing && !isOwnedClaudeServer(existing)) {
      warn(`Claude MCP server ${name} exists and pi-workflow does not manage it; skipped`);
      continue;
    }

    if (existing) changes.push(['mcp', 'remove', '-s', 'user', name]);
    changes.push(['mcp', 'add-json', '-s', 'user', name, JSON.stringify(wanted)]);
  }

  for (const [name, existing] of Object.entries(current)) {
    if (!MCP_SERVERS[name] && isOwnedClaudeServer(existing)) changes.push(['mcp', 'remove', '-s', 'user', name]);
  }

  for (const args of changes) {
    log(`claude ${args.slice(0, 5).join(' ')}`);
    if (DRY_RUN) continue;

    const outcome = runCli('claude', args, CLAUDE_ENV);
    if (outcome !== 'ok') return outcome === 'missing';
  }

  return true;
}

function isOwnedClaudeServer(server) {
  return server?.env?.PI_WORKFLOW === OWNER_ENV.PI_WORKFLOW;
}

export function codexServerTables(skipNames) {
  return Object.entries(MCP_SERVERS)
    .filter(([name]) => !skipNames.has(name))
    .map(([name, server]) => codexServerTable(name, server));
}

function codexServerTable(name, server) {
  const lines = [`[mcp_servers.${name}]`];

  if (server.url) lines.push(`url = ${tomlString(server.url)}`);
  else lines.push(`command = ${tomlString(server.command)}`, `args = [${server.args.map(tomlString).join(', ')}]`);

  for (const [key, value] of Object.entries(server.codex ?? {})) {
    lines.push(`${key} = ${Array.isArray(value) ? `[${value.map(tomlString).join(', ')}]` : value}`);
  }

  return `${lines.join('\n')}\n`;
}
