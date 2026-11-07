#!/usr/bin/env node
// Writes the Claude Code and Codex versions of the pi config in ~/.pi/agent.
// Usage: node sync.mjs [--dry-run] [--root <dir>] [--if-stale]
// --root writes into <dir> instead of $HOME, for previews and tests. --if-stale does nothing when the
// config is already newer than its sources, as the session-start hook asks.

import { syncAgents } from './sync/agents.mjs';
import { syncCodexConfig } from './sync/codex-config.mjs';
import { DRY_RUN, IF_STALE } from './sync/context.mjs';
import { markSynced, needsSync } from './sync/freshness.mjs';
import { syncClaudeHooks, syncCodexHooks } from './sync/hooks.mjs';
import { withSyncLock } from './sync/lock.mjs';
import { syncClaudeServers } from './sync/mcp.mjs';
import { syncRules } from './sync/rules.mjs';
import { syncSkills } from './sync/skills.mjs';

const startedAt = new Date();

try {
  const complete = await withSyncLock(async () => {
    if (IF_STALE && !needsSync()) return false;

    syncRules();
    syncSkills();
    syncAgents();

    const claudeServersSynced = syncClaudeServers();
    syncClaudeHooks();

    // Hook trust is read from Codex after hooks.json is written, then stored in config.toml.
    const trust = await syncCodexHooks();
    syncCodexConfig(trust);

    // A failed Claude CLI call or unread Codex hook trust is retried by the next session start.
    return claudeServersSynced && trust !== undefined;
  });

  if (!DRY_RUN && complete) markSynced(startedAt);
} catch (error) {
  console.error(`pi-workflow sync failed: ${error.message}`);
  process.exitCode = 1;
}
