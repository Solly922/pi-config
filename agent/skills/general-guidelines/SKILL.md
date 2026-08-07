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

## Write for the Reader

- Optimize for a reader building a mental model in one pass, not for the fewest lines.
- Keep a function at one level of abstraction: a sequence of named steps, or the detail those steps hide — not both.
- Prefer flat call graphs. Understanding a unit should not require following more than about two levels of indirection.
- Extract a block when the extraction earns its name: reused, independently testable, or hiding detail the caller does not need. Do not extract merely to shorten a function.
- Do not create single-use wrappers, pass-through layers, or helpers whose body is shorter than their signature.
- Prefer direct calls over indirection that hides control flow — callbacks, dynamic dispatch, and event hops when a plain call works.
- Use early returns to keep nesting shallow; more than about three levels means the logic wants restructuring, not more indentation.
- Name functions and variables so call sites read as intent; a reader should rarely need to open the callee.
- Comment the why, the tradeoff, and non-obvious behavior — not what the next line already says.

### Size follows cohesion

Both extremes cost the reader: a file too large to hold in their head, and a chain of small files that must all be open to follow one path. Split on cohesion, not line count.

- A file should cover one subject a reader can summarize in a sentence. Split when it starts covering two, not when it crosses a line count.
- Keep a linear flow — a request path, a state transition, a pipeline — in one file even when it runs long. Following one path should not mean opening five files.
- Split when parts have independent readers, independent reasons to change, or independent tests. Those are real seams; line count is not.
- Treat size limits as a smell to investigate, not a rule to satisfy. A long cohesive file is fine; a short file that only forwards calls is not.

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
