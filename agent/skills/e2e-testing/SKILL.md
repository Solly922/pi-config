---
name: e2e-testing
description: Design, run, and diagnose Playwright E2E tests for critical user flows, stable selectors, deterministic waits, artifacts, CI, and flaky-test investigation.
metadata:
  origin: ECC
  adapted-for: pi-0.80.6
---

# E2E Testing with Playwright

Use the project's installed Playwright version, package manager, and scripts. Do not let `npx` install or upgrade packages.

Test critical cross-boundary journeys that cheaper tests cannot protect, such as authentication, authorization, destructive actions, payments, core creation flows, and deployment-critical navigation.

## Rules

- Prefer roles, accessible names, labels, and stable test IDs over CSS structure.
- Wait for visible state, navigation, or a specific response; avoid arbitrary sleeps.
- Keep tests independent and create isolated data where practical.
- Assert user-visible or external outcomes, not implementation details.
- Use deterministic clocks and services when the project supports them.
- Preserve failure artifacts according to repository policy.

Run the narrowest relevant test first, then any required browser or project matrix. Re-run suspected flaky tests according to repository policy or a small stated count before calling them flaky.

Do not quarantine, skip, update snapshots, or weaken assertions without approval and a recorded reason.

For failures, report the command, environment, counts, failing test and line, first actionable error, retry outcome, artifact paths, and likely product-versus-test cause. State unavailable checks plainly.
