## Model Routing

By default, you should always use your jev-delegation skill. Sometimes, you might think it's unnecessary, but this is the default and you should ask the user if it's ok not to use it. If the user requests that you don't use it, use the following:

| Work | Target |
| --- | --- |
| Default | `codex` / `gpt-6-astra`, low |
| Bounded tool-heavy checks | `claudeAgent` / `claude-sonnet-5-5`, xhigh |
| Ambiguous implementation | `codex` / `gpt-6.1-sol`, medium |
| Architecture, security, database, or difficult debugging | `codex` / `gpt-6-astra`, medium |
| Explore subagents | `codex` / `gpt-6.1-terra`, xhigh |

Always check the current GPT model:
- gpt-6-astra: only low, medium, or high.
- gpt-6.1-sol: low, medium, high, or xhigh.
- gpt-6.1-terra: only medium, high, or xhigh. Use it only for Explore subagents and council.
- gpt-6-luna: only xhigh or max.

### Launching a subagent

Targets are T3 Code provider instances: `claudeAgent` runs Claude Code and `codex` runs Codex.

The `pi` MCP server's `route` tool is Jev: it picks the agent, model, and effort and returns them as `agent:` and `target:` lines without launching anything. Pass the user's required agent, model, or effort as its constraints; with all three fixed it makes no paid call.

- Same provider as you: use your native subagent tool, `Agent` in Claude Code or `spawn_agent` in Codex, when the named agent's own model and effort (the preferred model at the end of its description) are the ones you want. Otherwise use `delegate_task`, which sets them exactly.
- Other provider: use the t3-code `delegate_task` tool with `target: {providerInstanceId, model, options}`. Set effort with `options.effort` for `claudeAgent` and `options.reasoningEffort` for `codex`.
- If `delegate_task` rejects a GPT-6.1 model you picked from this table, launch `gpt-6-sol` at the same effort instead and tell the user. Council members and models the user named are exceptions: report the rejection instead of substituting.
- Outside T3 Code there is no `delegate_task`. Use your native subagent tool, which runs the named agent on its fallback model, and tell the user the preferred model was unavailable.
