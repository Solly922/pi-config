---
name: verification-loop
description: Run project-appropriate build, type, lint, test, security, and diff checks after significant changes or before review.
metadata:
  origin: ECC
  adapted-for: pi-0.80.6
---

# Verification Loop

Use repository configuration and documented scripts as the source of truth. Do not assume a language, package manager, framework, or coverage target.

## 1. Establish Scope

Inspect:

```bash
git status --short
git diff --name-only
git diff --cached --name-only
```

Do not modify, stage, or revert unrelated changes.

## 2. Discover Commands

Read the relevant manifest, CI configuration, contributor guide, and `AGENTS.md`. Prefer existing scripts over improvised commands.

## 3. Run Checks

In this order when applicable:

1. The narrow test or reproducer for the changed behavior.
2. Formatter check; apply formatting only when the active role permits edits.
3. Static analysis and type checking.
4. Relevant unit and integration tests.
5. Build.
6. E2E tests for affected critical flows.
7. Coverage only when the repository or user requires a target.
8. Security checks for changed trust boundaries, dependencies, or secrets.

Stop and diagnose a failing build or required test. Do not hide failures by truncating command output, disabling checks, or changing tests merely to make them pass.

## 4. Review the Diff

Check for unintended files, debug logging, hardcoded secrets, missing validation, stale comments, and generated artifacts that should not be committed.

## Report

```text
Build:     PASS / FAIL / N/A
Types:     PASS / FAIL / N/A
Lint:      PASS / FAIL / N/A
Tests:     PASS / FAIL / N/A
Security:  PASS / FAIL / N/A
Diff:      REVIEWED / NEEDS REVIEW
Overall:   READY / NOT READY
```

List failed or unavailable checks with the exact command and reason.
