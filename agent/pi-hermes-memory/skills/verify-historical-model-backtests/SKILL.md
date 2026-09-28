---
name: "verify-historical-model-backtests"
description: "Verify point-in-time LLM trading simulations, next-bar accounting and paid response replay."
version: 1
created: "2026-09-22"
updated: "2026-09-22"
---
## When to Use
Implementing historical strategy evaluation using model calls with immutable datasets and resume support.

## Procedure
1. Define evaluation [start,end) and fetch warmup separately. Validate continuous hourly OHLCV, complete bars, paginated duplicate consistency and checksums.
2. Build model state strictly from completed prior bars. Build execution quotes separately from the next bar open; never pass its high/low/close/volume to inference.
3. Reuse pure Decimal accounting, not a live processing path with a fake clock. Give simulation databases a distinct identity and reject live mixing in both directions.
4. Pin model version and preserve exact state/account, prompt, endpoint, dependencies, code hashes and pricing assumptions. Commit call/cost reservations before dispatch; save response before committing the deterministic step.
5. Resume confirmed responses without a second charge. Halt unknown/failed calls rather than resending; require renewed paid authorization and unchanged original budget/contract.
6. Compare like-for-like execution costs with explicit exposure differences; include initial equity in drawdown, mark final positions without fictitious liquidation, and separate inference cost from trading balances.
7. Run deterministic baseline first and inspect the whole real dataset before seeking authorization for a paid batch.

## Pitfalls
- Strictly past inputs do not eliminate model knowledge of historical outcomes.
- Next-open zero-latency fills and estimated spreads are assumptions, not executable historical quotes.
- Byte-based token estimates are not provider-enforced billing caps.
- A 90day hourly run exceeds a 2000-row live-report cap and must not be misrepresented as live evidence.

## Verification
1. Tests mutate future execution bars without changing prior model state.
2. Tests prove costs, initial-inclusive drawdown, archive integrity, database isolation and no replay of unknown paid requests.
3. Completed baseline run reports exact decision/window counts; report outputs remain readable under a concurrent writer's transaction.