# pi-workflow

Turns the pi config in `~/.pi/agent` into Claude Code and Codex config, so native threads in T3 Code follow the same rules, skills, and agents as pi.

```sh
node ~/.pi/pi-workflow/sync.mjs             # write the config
node ~/.pi/pi-workflow/sync.mjs --dry-run   # list changes only
node ~/.pi/pi-workflow/sync.mjs --root /tmp/preview   # write under another home
node --test ~/.pi/pi-workflow/sync.test.mjs
```

Rerun sync after editing `APPEND_SYSTEM.md`, adding or removing a skill, or changing an agent. Skill edits need no rerun because the skills are symlinked.

| Source | Output |
| --- | --- |
| `agent/APPEND_SYSTEM.md`, with sections replaced by `rules/*.md` | marked block in `~/.claude/CLAUDE.md` and `~/.codex/AGENTS.md` |
| `agent/skills/`, `agent/pi-hermes-memory/skills/`, ponytail's `skills/` | symlinks in `~/.claude/skills/` and `~/.agents/skills/` |
| `agent/agents/*.md` | `~/.claude/agents/*.md` and `~/.codex/agents/*.toml` |

Each file in `rules/` starts with the `## ` heading of the `APPEND_SYSTEM.md` section it replaces. Sync fails if that heading no longer exists, so a renamed pi section can't silently leave stale native rules.

An agent whose preferred model is on the other provider gets a fallback model taken from the Model Routing table: `claude-sonnet-5-5` in Claude Code, `gpt-6-astra` in Codex. That copy only runs when `delegate_task` is unavailable, outside T3 Code.

Sync only replaces the agent files it generated, skill links that point into a skill source, and the text between the `pi-workflow` markers. Anything else with the same name is skipped with a warning. It follows symlinked folders and a symlinked `CLAUDE.md` or `AGENTS.md`, so dotfile setups work, which also means `--root` does not keep writes inside the root when those are links.
