## Subagents

Claude Code reads agents from `~/.claude/agents/` and Codex from `~/.codex/agents/`. Both sets are generated from `~/.pi/agent/agents/`, and each description ends with the agent's preferred model. Launch an agent the way Model Routing describes: natively when its preferred model is on your provider, otherwise with `delegate_task` at that model, starting the task with:

> Act as the `<name>` agent. Read `~/.pi/agent/agents/<name>.md`, follow its body, and load the skills its `skills` field lists. If its `tools` field has neither `write` nor `edit`, do not modify files.

Use these agents only when their trigger applies:

- @architect: Consequential decisions about system/module boundaries, data ownership, public contracts, security architecture, scalability, reliability, or deployment. Keep routine UI and bounded feature planning with the main agent. Council may also use it as a read-only reviewer of any plan, design, or other non-code feedback.
- @build-error-resolver: Non-trivial build/type failures where focused diagnosis helps. Keep straightforward failures with the main agent. Make minimal fixes without architectural edits.
- @code-reviewer: MUST BE USED once after implementation and relevant checks for ALL code changes. Default to `codex` / `gpt-6.1-sol` at xhigh unless the user specifies otherwise. If it returns `Escalation: REQUIRED`, rerun only affected findings or paths on `claudeAgent` / `claude-opus-5-5` at xhigh: in Claude Code, launch the native code-reviewer with `model: "opus"`; in Codex, use `delegate_task`. After fixes, request targeted follow-up only when risk materially changed or a high-severity finding remains. Do not repeat full reviews for mechanical fixes. When council reviews the change, its rounds replace this single pass.
- @frontend-builder: REQUIRED for brand-new pages and substantial UI/UX implementation. Keep routine UI planning and small, bounded changes with the main agent. Name in its prompt the design skills it must load, following the routing above. It runs with its own system prompt and does not see these rules.
- @drafter: Building HTML plans, drafts, reports, and comparisons.
