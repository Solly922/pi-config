---
name: jev-delegation
description: Split a multi-step coding goal into cohesive, independently testable work and delegate suitable slices through JevAgent. Use when subagents could help without multiplying context and integration costs.
---

# Delegate with JevAgent

## Choose the boundary

- Keep trivial edits and tightly coupled work with the main agent. Delegate when a specialist, independent perspective, or a substantial self-contained slice earns a fresh agent.
- Split by behavior, not files. A route, controller, input validation, and focused tests for one endpoint belong to one owner. Do not send each file to a separate agent.
- Establish shared contracts before splitting dependent work. Run dependent slices in order; parallelize only genuinely independent slices with disjoint file ownership. Usually use one non-review implementation agent at a time.

## Launch one slice

- Inspect enough of the repository to state the outcome, relevant paths, constraints, and acceptance checks. Give the child a self-contained prompt, not the whole parent conversation. Tell it to follow repository `AGENTS.md`, load `general-guidelines` for code changes and `frontend-design` for UI design, run focused checks, and avoid unrelated edits.
- Use `JevAgent` when agent, model, or thinking selection is useful. Leave those fields unset for automatic choice. Read current higher-priority instructions and pass user-required or mandatory specialist/model/thinking choices as exact constraints; router eligibility alone does not enforce those policies. Jev's RPC route can override agent frontmatter defaults. If all three are fixed, JevAgent skips paid inference; use ordinary `Agent` only when its frontmatter defaults will not override a required choice.
- Give a short `description` and set `max_turns` when the child needs a firm turn bound. Router `timeoutMs` bounds routing and startup acknowledgement, not the child run. Jev sends the prompt, description, and candidate catalog to TypeSafe; keep secrets and sensitive user data out of them.
- JevAgent launches the selected agent in the background and returns an ID and route source. Wait for the completion notification or use `get_subagent_result` with that ID. Notice `explicit-fallback` if configured; do not launch a duplicate or automatically retry or escalate after failure.

## Integrate and check

- Inspect the actual changes and test output rather than trusting the child's summary. Resolve conflicts and run integration checks. For code changes, use `@code-reviewer` once after implementation and relevant checks, following current model defaults and escalation rules; do not review a half-built diff. Keep the parent responsible for the final outcome.
- Each routing call sends the candidate catalog, and each child must rebuild its own working context. Avoid microtasks, repeated discovery, and nested delegation. Token cost was not measured; do not claim a saving without usage data.

Example slice: "Implement the profile settings endpoint using the existing auth. Own its route, controller, validation, and focused tests. Do not edit the frontend or add dependencies. Run the API tests and report changed paths and results. Stop if the existing API contract conflicts with this request."
