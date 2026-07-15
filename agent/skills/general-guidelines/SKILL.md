---
name: general-guidelines
description: Apply surgical, assumption-aware engineering practices when writing, reviewing, or refactoring code. Use for implementation work where scope control and verifiable success criteria matter.
license: MIT
metadata:
  origin: ECC
  adapted-for: pi-0.80.6
---

# General Guidelines

## Think Before Coding

- Inspect the repository before choosing an implementation.
- State material assumptions. Ask when ambiguity changes behavior, security, or scope.
- Prefer the simplest approach that satisfies the request.
- Define an observable success condition before editing.

## Keep Changes Surgical

- Touch only files and lines required by the task.
- Preserve existing conventions unless the task explicitly changes them.
- Do not introduce abstractions, dependencies, compatibility layers, or configuration for hypothetical future needs.
- Remove only artifacts made obsolete by the current change.
- Never discard unrelated user changes in a dirty worktree.

## Delegate Deliberately

- Default to single-agent execution for small, bounded tasks.
- Delegate only when specialization, an independent perspective, parallel execution, or context isolation provides a concrete benefit greater than the coordination cost.
- Do not use discretionary delegation for work the main agent can complete directly with available context, repeat the same investigation in multiple agents, or parallelize work with sequential dependencies. Required specialists and independent review are exceptions.
- Use an architect only for consequential decisions involving system or module boundaries, data ownership, public contracts, security, scalability, reliability, or deployment. Routine UI and bounded feature planning stay with the main agent.
- Use at most one non-review subagent per task unless multiple tasks are genuinely independent and benefit from concurrent work.
- For required code review, run one full review after implementation and relevant checks. Request a targeted follow-up only when fixes materially change the risk surface or a high-severity finding remains; do not repeat full reviews for mechanical fixes.

## Implement Safely

- Validate input at trust boundaries.
- Preserve required security, accessibility, and data-loss protections.
- Prefer platform features, standard libraries, and installed dependencies over custom machinery.
- Handle expected failures without hiding diagnostics or leaking sensitive data.

## Verify the Outcome

Run the narrowest relevant check first, then the repository's normal quality gates when warranted. Report exactly what ran and distinguish passing checks from checks that were not available.

For non-trivial implementation work, leave one runnable check that would fail if the behavior regressed. Read-only roles should recommend the smallest useful check instead of creating it.
