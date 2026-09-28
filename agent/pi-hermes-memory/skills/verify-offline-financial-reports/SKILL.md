---
name: "verify-offline-financial-reports"
description: "Verify local HTML financial reports for accounting, source limitations, privacy, and browser usability."
version: 1
created: "2026-09-21"
updated: "2026-09-21"
---
## When to Use
Building a static HTML report from a local trading or financial ledger with simulated returns or benchmarks.

## Procedure
1. Compute valuations with Decimal, using explicit before-first-observation wealth and documented mark prices. Keep display rounding separate.
2. Hand-check a buy/sell fixture with spread, slippage, fees, residual cash and quantity precision. Charge benchmark entry costs consistently; label missing liquidation costs.
3. Exclude stale or future market records from valuations while retaining their audit log. Withhold mixed-source comparisons and percentages with zero denominators.
4. Read the ledger without mutation; protect source database and sidecars from output collisions. Create private output exclusively and escape all embedded text.
5. Render synthetic nonprivate fixtures in a browser at desktop and mobile sizes. Check charts, empty state, keyboard details, document overflow, and absence of external resource requests.

## Pitfalls
- Observed drawdown is not continuous drawdown; gaps in records are not flat performance.
- Immutable SQLite reads require stopped writers; pending WAL or journals must not silently be ignored.
- Do not publish generated reports containing account information or model responses.
- Provider confidence is not probability of investment profit.

## Verification
1. Unit tests prove accounting examples, zero/one record behavior, excluded records and HTML injection safety.
2. Source database bytes are unchanged and existing files/symlinks/hardlinks cannot be overwritten.
3. Browser confirms responsive layout, keyboard operation and no external resource requests.