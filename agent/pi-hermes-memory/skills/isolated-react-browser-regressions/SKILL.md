---
name: "isolated-react-browser-regressions"
description: "Test real React components and responsive CSS without live backend credentials"
version: 3
created: "2026-09-10"
updated: "2026-09-24"
---
## When to Use
A React UI needs browser regression coverage but live auth/backend fixtures are unavailable, and Playwright plus esbuild are already installed.

## Procedure
1. Bundle a small fixture importing the real components with esbuild. Mock only server actions, query/transport boundaries, and router navigation.
2. Render query snapshots through the same React root so updates test state preservation rather than remounts.
3. Compile the application's actual CSS with its installed processor. Serve local assets through a constrained Playwright route; use explicit local font fallbacks if framework fonts are unavailable.
4. Assert roles, ordering, reactive updates, scroll containment, and mobile/desktop access. Use fixed install/pause timestamps for Playwright clocks to avoid wall-clock races.
5. For DOM-to-PNG exports, test the actual exporter in Chromium with a full-sized data set and decode its Blob to check width and height. Pair this with an SSR row-count assertion; dimensions alone cannot prove that the last item was rendered.
## Pitfalls
- These checks do not prove real authentication, backend transactions, or production font fidelity.
- Avoid permanent git-HEAD baseline loaders; use temporary baseline substitution only when reproducing a regression.
- A fixed-height fixture can conceal layout bugs if the real parent only has min-height.
- For shared-screen cards, render the real host and lobby shells at 1280×720, including headers and phase strips. Check the last row and footer bounding boxes, not just card height. Load available app fonts because wrapping changes fit.
## Verification
1. Regression fails against pre-fix components and passes against changed components.
2. Existing unit/type/lint/build checks still pass.