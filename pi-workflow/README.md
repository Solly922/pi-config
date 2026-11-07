# pi-workflow

Turns the pi config in `~/.pi/agent` into Claude Code and Codex config, so native threads in T3 Code follow the same rules, skills, agents, memory, and routing as pi.

```sh
node ~/.pi/pi-workflow/sync.mjs             # write the config
node ~/.pi/pi-workflow/sync.mjs --dry-run   # list changes only
node ~/.pi/pi-workflow/sync.mjs --root /tmp/preview   # write under another home
cd ~/.pi/pi-workflow && node --test sync.test.mjs hooks/*.test.mjs mcp/*.test.mjs memory/*.test.mjs extensions/*.test.ts
```

Sync reruns by itself: at each Claude or Codex session start, the `sync` hook compares `APPEND_SYSTEM.md`, the agents, `rules/`, the skill source folders, and sync's own code against `~/.cache/pi-workflow-sync.stamp`, and starts a background sync when something is newer (log in `~/.cache/pi-workflow-sync.log`). The session that triggers it keeps what it already loaded, so a change reaches the next session. Run it by hand to apply a change right away. Skill edits need no sync because the skills are symlinked.

| Source | Output |
| --- | --- |
| `agent/APPEND_SYSTEM.md`, with sections replaced by `rules/*.md` | marked block in `~/.claude/CLAUDE.md` and `~/.codex/AGENTS.md` |
| `agent/skills/`, `agent/pi-hermes-memory/skills/`, ponytail's `skills/` | symlinks in `~/.claude/skills/` and `~/.agents/skills/` |
| `agent/agents/*.md` | `~/.claude/agents/*.md` and `~/.codex/agents/*.toml` |
| `MCP_SERVERS` in `sync/mcp.mjs` | Claude user-scope servers via `claude mcp add-json`, and a marked block at the end of `~/.codex/config.toml` |
| `HOOKS` in `sync/hooks.mjs` | hook entries in `~/.claude/settings.json`, and `~/.codex/hooks.json` plus its trust entries in the `config.toml` block |

`sync.mjs` runs the steps in `sync/`, one file per output, sharing the paths and safe-write helpers in `sync/context.mjs`.

Each file in `rules/` starts with the `## ` heading of the `APPEND_SYSTEM.md` section it replaces. Sync fails if that heading no longer exists, so a renamed pi section can't silently leave stale native rules.

An agent whose preferred model is on the other provider gets a fallback model taken from the Model Routing table: `claude-sonnet-5-5` in Claude Code, `gpt-6-astra` in Codex. That copy only runs when `delegate_task` is unavailable, outside T3 Code.

## The pi MCP server

`mcp/pi-server.mjs` runs a headless pi session with two extensions and serves their tools over stdio:

- Hermes (`memory_*`, `session_search`, `skill_manage`), the same extension and store pi uses. Its memory policy and pinned instructions become the server's MCP instructions.
- `extensions/route.ts`, Jev routing that returns a T3 `delegate_task` target instead of launching a pi subagent. It reuses pi-jev-router's `router.ts` and its config in `agent/jev-router/config.json`.
- Observational memory's `recall`, pointed at the shadow session (below) that recorded the requested id.
- `generate_image` from `agent/extensions/codex-images`, which draws through the user's ChatGPT subscription. Codex also has its own image skill; Claude has no other way to make images.

Both harnesses start MCP servers in the thread's working directory, which is how Hermes picks the project. This session and the shadow sessions use the memory extensions' own model (observational memory's `model` in `settings.json`, else Hermes's `llmModelOverride`) as their session model, so a fallback to the session model stays on it rather than on pi's first available model. Codex passes servers only a few environment variables, so its entry forwards `TYPESAFE_API_KEY` through `env_vars`. After `skill_manage` creates or deletes a skill, the server reruns sync so the new skill gets its links.

## Shadow sessions

pi's background memory work, Hermes's review, correction detection and flush, and observational memory's observe, reflect and drop cycle, runs inside pi on its own session. For a native thread, `memory/shadow.mjs` keeps a pi session that mirrors the thread: it tails the Claude Code or Codex transcript, converts each line with `memory/transcript.mjs`, appends the messages, and emits the events pi would (`agent_start`, `message_end`, `turn_end`, `agent_end`, `agent_settled`). Hermes and observational memory react exactly as they do in pi, with the user's own settings.

- One process per thread, started by the `shadow` hook and recorded in a pid file. It exits after 30 minutes without new transcript lines and resumes from its saved offset when the thread is used again.
- Files live in `~/.pi/agent/sessions/native-claude/` and `native-codex/`: the shadow session (`<session id>.jsonl`), its offset, pid, and log. Hermes indexes that folder, so `session_search` finds native threads. pi's all-sessions picker lists them too, named `Claude Code thread <id>` or `Codex thread <id>`.
- After the harness compacts, the `observations` hook adds the shadow session's reflections and newest observations, rendered by observational memory and kept under both harnesses' hook-text limits.
- The harness compacts on its own schedule, so observational memory does not shape the compaction itself as it does in pi. It may also lag up to its `observeAfterTokens` threshold behind the latest turns, which the harness's own summary covers.

## Hooks

Every hook runs `hooks/run.mjs <claude|codex> <handler>`. It exits at once when `PI_CODING_AGENT` is set, because pi's Claude bridge loads Claude's user settings and pi's own extensions already do this work there.

| Event | Handler | What it does |
| --- | --- | --- |
| SessionStart | `sync` | starts a background sync when the pi sources changed since the last one |
| SessionStart (Claude only) | `project-rules` | each `AGENTS.md` in the session folder and the folders above it, as pi reads them, that has no `CLAUDE.md` beside it and belongs to the user, because Claude Code reads only `CLAUDE.md`; a pointer instead when they exceed hook text limits |
| SessionStart | `session-context` | LLM Wiki status line and the Hermes project skills for the repo |
| SessionStart, UserPromptSubmit | `shadow` | starts the thread's shadow session if it is not running |
| SessionStart (after compaction) | `observations` | observational memory for the thread |
| SessionStart, UserPromptSubmit, SubagentStart | `ponytail-*` | ponytail's own hook scripts from its pi checkout |
| UserPromptSubmit | `wiki-recall` | the same per-prompt wiki recall as pi's llm-wiki extension |
| PreToolUse (Bash) | `rtk` | rtk command rewrites; in Codex only when approvals are already off, because Codex applies a rewrite only together with an "allow" decision |
| PreToolUse (Write/Edit, apply_patch) | `wiki-guard` | blocks hand edits to `.llm-wiki/raw` and `.llm-wiki/meta` |

Codex runs a user hook only after its exact definition is trusted. Sync asks `codex app-server` for each hook's key and hash, the way Codex's `/hooks` screen does, and records them in its `config.toml` block. It trusts only the hooks in the `hooks.json` it generated.

## What sync owns

Sync only replaces the agent files it generated, skill links that point into a skill source, the text between the `pi-workflow` markers, Claude MCP servers that carry `PI_WORKFLOW=1` in their environment, Claude hook entries that run `hooks/run.mjs`, and a Codex `hooks.json` it generated. Anything else with the same name is skipped: Claude conflicts print a warning, and a Codex server you defined yourself outside the block wins silently. If Codex rejects the new `config.toml`, sync puts the old file back and fails.

It follows symlinked folders and a symlinked `CLAUDE.md` or `AGENTS.md`, so dotfile setups work, which also means `--root` does not keep writes inside the root when those are links.
