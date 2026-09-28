---
name: "verify-next-open-backtests"
description: "Verify isolated candle-based historical simulations with crash-safe paid inference."
version: 1
created: "2026-09-22"
updated: "2026-09-22"
---
## When to Use
Historical candle backtests that reuse a live risk engine and optionally pay for model decisions.

## Procedure
1. Keep historical storage separate from live account storage, using a distinct SQLite application ID and an explicit live-writer refusal before schema creation.
2. Archive exactly the evaluation bars plus the fixed warmup window; checksum normalized page evidence and the original file, validate contiguous UTC buckets, and embed canonical history for offline resume.
3. Build decision input solely from completed preceding bars. Test that changing any execution-bar OHLC/volume field cannot change the input. Execute at a distinct next-open synthetic quote and mark at that bar's close.
4. Reserve each paid request and its immutable budget before dispatch. Commit raw response evidence before parsing or committing the simulation step. Resume saved responses for free; stop reserved or failed requests with no confirmed response.
5. Freeze full state/account, question, provider, pinned model, pricing, dependencies and code hashes in the cache/run contract. Refuse resume after contract changes.
6. Run offline tests for boundary counts, pagination overlap, next-open fills, accounting parity, initial-inclusive drawdown, no final liquidation, both-direction database isolation, zero/exhausted budgets, and crashes before and after response persistence.

## Pitfalls
- A byte-based token estimate is not a guaranteed bill cap. Report known usage and unknown attempts separately; never assign unknown failures a zero bill.
- Zero-latency next-open fills and historical model knowledge are optimistic limitations even without explicit future fields.
- A fully invested buy-and-hold benchmark is not directly risk-matched to an exposure-capped strategy.
- Never disguise historical data with a fake live clock or fabricated quote provenance.

## Verification
1. Mock both public data and SDK network entry points in tests; no paid tests.
2. Assert exact 48 warmup plus 2160 evaluation bars for a 90-day hourly window.
3. Crash after reservation and prove resume makes no call; crash after saved response and prove resume does not double-call.
4. Check successful full test suite and build, then run a scripted public-data baseline separately.