---
name: e2e-testing
description: Design, run, and diagnose Playwright E2E tests for critical user flows, stable selectors, deterministic waits, artifacts, CI, and flaky-test investigation.
metadata:
  origin: ECC
  adapted-for: pi-0.80.6
---

# E2E Testing with Playwright

Use the target project's installed Playwright version and scripts. Do not let `npx` silently install or upgrade packages.

## Choose Tests Deliberately

Cover critical cross-boundary journeys that unit or integration tests cannot protect: authentication, authorization, destructive actions, payments, core creation flows, and deployment-critical navigation.

Avoid duplicating low-level logic already covered cheaply elsewhere.

## Stable Test Rules

- Prefer roles, accessible names, labels, and stable test IDs over CSS structure.
- Wait for a user-visible condition, navigation, or specific network response; avoid arbitrary sleeps.
- Keep tests independent and create their own data.
- Use deterministic clocks, services, and fixtures when the project supports them.
- Assert outcomes visible to users or external systems, not implementation details.
- Capture screenshots, video, and traces on failure according to repository policy.

## Diagnosis

For failures, report the test file and line, first actionable error, artifact paths, environment, retry outcome, and likely production-versus-test cause. Re-run a suspected flaky test repeatedly before labeling it flaky.

Do not quarantine, skip, update snapshots, or weaken assertions without explicit approval and a tracked reason.

## Verification

1. Confirm Playwright is declared in the project.
2. Use the repository's package manager and scripts.
3. List or run the narrow affected tests first.
4. Run the relevant browser/project matrix when required.
5. Report passed, failed, skipped, retried, and flaky counts separately.
