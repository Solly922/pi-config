---
name: engineering-principles
description: Engineering principles for debugging, testing, verification, and design, each a reference read on demand. Use when debugging a defect or when a second fix fails on the same premise, writing or judging a test, trusting or reporting a measured number, verifying before declaring done, handling retries, crashes, or restarts (idempotency), letting concurrent writers share state, writing stateful logic or branching that repeats a shape, or facing non-trivial or bulk work that a script could do or prove.
license: MIT
metadata:
  origin: cursor/plugins pstack@7698375 (Lauren Tan)
  adapted-for: pi-1.3.0
---

# Engineering principles

Read the matching reference file in full before applying it, and when you report, name the principle and the decision it changed.

## Debugging

- [Fix Root Causes](references/fix-root-causes.md). Apply when debugging. Trace each symptom back to the first place the system went wrong and fix it there.
- [Attack the Premise](references/attack-the-premise.md). Apply when two or more fixes that share one premise have failed the same gate. Test the premise before writing another fix.

## Verification

- [Prove It Works](references/prove-it-works.md). Apply after completing a task, before declaring done. Verify against the real artifact, not a proxy or self-report.
- [Test Behavior, Not Implementation](references/test-behavior-not-implementation.md). Apply when you write, change, or keep a test. Assert what users can observe, so it fails when behavior breaks and survives internal changes.
- [Explain the Number](references/explain-the-number.md). Apply before you trust, report, or act on a measured number. Find what limits it and rule out that it measured something else.

## Design

- [Make Operations Idempotent](references/make-operations-idempotent.md). Apply when designing commands, lifecycle steps, or processing loops that run amid crashes, restarts, and retries. Converge to the same end state regardless of partial prior runs.
- [Separate Before Serializing Shared State](references/separate-before-serializing-shared-state.md). Apply when concurrent actors might write to the same file, branch, key, or state object. Eliminate the sharing first, and serialize structurally only when one shared writer is a real invariant.
- [Model the Domain](references/model-the-domain.md). Apply when writing stateful logic, or when code branches a lot or repeats a shape assumption across files.

## Throughput

- [Build the Lever](references/build-the-lever.md). Apply to any non-trivial work, not just bulk work. Build the script or codemod that does it or proves it, so a reviewer can rerun it.
