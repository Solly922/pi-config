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

## Implement Safely

- Validate input at trust boundaries.
- Preserve required security, accessibility, and data-loss protections.
- Prefer platform features, standard libraries, and installed dependencies over custom machinery.
- Handle expected failures without hiding diagnostics or leaking sensitive data.

## Verify the Outcome

Run the narrowest relevant check first, then the repository's normal quality gates when warranted. Report exactly what ran and distinguish passing checks from checks that were not available.

For non-trivial implementation work, leave one runnable check that would fail if the behavior regressed. Read-only roles should recommend the smallest useful check instead of creating it.
