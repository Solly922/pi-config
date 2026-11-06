#!/usr/bin/env node
// Writes the Claude Code and Codex versions of the pi config in ~/.pi/agent.
// Usage: node sync.mjs [--dry-run] [--root <dir>]
// --root writes into <dir> instead of $HOME, for previews and tests.

import { syncAgents } from './sync/agents.mjs';
import { syncCodexConfig } from './sync/codex-config.mjs';
import { syncClaudeHooks, syncCodexHooks } from './sync/hooks.mjs';
import { withSyncLock } from './sync/lock.mjs';
import { syncClaudeServers } from './sync/mcp.mjs';
import { syncRules } from './sync/rules.mjs';
import { syncSkills } from './sync/skills.mjs';

try {
  await withSyncLock(async () => {
    syncRules();
    syncSkills();
    syncAgents();

    syncClaudeServers();
    syncClaudeHooks();

    // Hook trust is read from Codex after hooks.json is written, then stored in config.toml.
    const hookTrust = await syncCodexHooks();
    syncCodexConfig(hookTrust);
  });
} catch (error) {
  console.error(`pi-workflow sync failed: ${error.message}`);
  process.exitCode = 1;
}
