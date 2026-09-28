---
name: "sqlite-budgeted-periodic-jobs"
description: "Build restart-safe periodic jobs with durable call reservations and read-only monitoring."
version: 1
created: "2026-09-21"
updated: "2026-09-21"
---
## When to Use
Scheduling periodic paid API decisions that update a local SQLite account or other durable state.

## Procedure
1. Define UTC scheduled slots, a lateness deadline and restart policy explicitly; skip missed slots rather than replaying them.
2. Use a persistent file lock for cooperating account writers; resolve symlinks, never unlink the lock inode, and document local-filesystem limitations.
3. Atomically claim a unique slot and consume a per-day API allowance before invoking a paid API. Never refund unknown outcomes or retry an existing reservation.
4. Keep the account/decision transaction separate and atomic; link known results back to the reservation after commit.
5. Write heartbeat outside long inference transactions. Expose status through a short read-only transaction independently of analytics capacity limits.
6. Log safe exception class names when storage cannot record its own failure. Show stale heartbeat as unknown rather than stopped.
7. Test fixed clocks, duplicate slots, crash before/after account commit, UTC day rollover, slow feed, suspend, missing keys, concurrent locks and graceful termination without real API calls.

## Pitfalls
- A call reservation is not proof of a billed call or a dollar cap.
- Manual calls outside the scheduler are not bounded by its quota.
- Immutable SQLite reports cannot safely overlap active writers; make export share the writer exclusion lock.
- Silently swallowing database exceptions can hide permanent data gaps.

## Verification
1. Offline tests prove at-most-once reservations and no quota refunds after unknown outcomes.
2. Read-only monitoring remains available without starting inference.
3. Graceful shutdown persists stopped status; abrupt crash remains unknown and cannot trigger duplicate API work.