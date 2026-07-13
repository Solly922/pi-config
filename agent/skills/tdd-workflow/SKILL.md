---
name: tdd-workflow
description: Use a tests-first workflow for features, bugs, and refactors only when the user or AGENTS.md explicitly requires TDD.
metadata:
  origin: ECC
  adapted-for: pi-0.80.6
---

# TDD Workflow

Use this workflow only when TDD is explicitly required.

## Red

1. Describe the user-visible behavior and edge cases.
2. Add the smallest test that demonstrates the missing or broken behavior.
3. Run it and confirm it fails for the expected reason, not because of setup mistakes.

## Green

1. Implement the smallest production change that satisfies the test.
2. Run the focused test until it passes.
3. Run nearby tests to detect regressions.

## Refactor

Improve naming or structure only when it reduces current complexity. Keep tests green throughout.

## Complete

- Run the repository's normal test and static-analysis commands.
- Verify any coverage target explicitly required by the user or repository.
- Include unit, integration, or E2E coverage only where each level protects meaningful behavior.
- Do not weaken assertions, overmock the behavior under test, or update snapshots without reviewing the change.

Report the failing test observed during Red, the implementation made during Green, and final verification.
