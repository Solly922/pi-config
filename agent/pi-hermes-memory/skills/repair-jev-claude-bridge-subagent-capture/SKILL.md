---
name: "repair-jev-claude-bridge-subagent-capture"
description: "Diagnose Jev Claude Bridge prompt-capture failures in Pi subagents"
version: 3
created: "2026-09-23"
updated: "2026-09-28"
---
## When to Use
Use when Jev routes a custom subagent to claude-bridge and it fails before tool use with `prompt-capture: no capture` or a child prompt that diverges from the parent's known capture.

## Procedure
1. Read the failing agent's `~/.pi/agent/agents/<agent>.md` (or project override) frontmatter, especially `extensions:` and `prompt_mode:`; never inspect credentials.
2. If `extensions:` is a narrow allowlist without `pi-claude-bridge`, the child filters out the bridge. With `prompt_mode: replace`, its new system prompt cannot be derived from the parent's capture.
3. With user approval, add `pi-claude-bridge` to the allowlist or omit `extensions:` to inherit all, if that broader loading is acceptable. An explicit non-Claude model through Jev is an alternative when global config should not change.
4. Custom agent files reload on each pi-subagents spawn. Retry Jev only when the user requests it; confirm `get_subagent_result` reports running with at least one tool use rather than trusting the initial Started acknowledgement.

## Pitfalls
- A JevAgent Started message is not proof of a working child; prompt-capture failures can occur immediately with zero tool uses.
- Do not auto-retry or fall back to another model after a failed Jev route without user direction.
- `extensions: false` fails the same way as a narrow allowlist: the bridge extension never loads in the child.
- Omitting `extensions:` loads all extensions AND exposes every extension tool (JevAgent, TaskExecute, mcp, memory, wiki, web). `tools:` only limits built-ins, and `disallowed_tools: write, edit` no longer makes an agent read-only. Only `ext:` selectors in `tools:` narrow extension tools.
- Use `extensions: pi-claude-bridge` (CSV string) for isolated agents. It resolves through the package manifest and adds no tools while AskClaude is disabled in bridge config.
- The error's generic 'extension loaded after claude-bridge' hint may not identify the actual cause when the child bridge is excluded.
- Pi loads pi-claude-bridge from the git-pinned package under ~/.pi/agent/git/github.com/elidickinson/; the npm/node_modules copy is not the active one, so local patches must target the git copy.
## Verification
1. The Jev-launched child remains running past startup and reports at least one tool use.
2. Ask the smoke-test child to list its exact tool names and confirm scope matches the agent's intent (e.g., a read-only reviewer sees only read/grep/find).
3. Review the child result and actual file changes before claiming the delegated task completed.