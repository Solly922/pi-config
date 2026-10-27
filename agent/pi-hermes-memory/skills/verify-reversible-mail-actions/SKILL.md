---
name: "verify-reversible-mail-actions"
description: "Fix and verify Gmail cleanup safety races: stale policy during label reads, Keep/Undo overwritten, review protections bypassed, missing Trash audit intents, or mailbox scans per triage chunk."
version: 2
created: "2026-10-14"
updated: "2026-10-15"
---
## When to Use
Use for single-process applications making real reversible mailbox mutations with stored policy decisions and a background worklist. Not a substitute for distributed locking or remote atomic conditional mutation APIs.

## Procedure
1. Map every background decision write, user Keep/Undo action, policy mutation, and remote Trash call before editing; honor file ownership constraints.
2. Serialize cleanup, review and Undo per message. Make background upserts conditional on the existing outcome not being final; give explicit Keep/Undo a separate locked final-write path.
3. Reserve the combined live-read + Trash quota before fetching labels (Gmail minimal GET 20 + Trash 20 units). Forward the job signal to reservation and backoff. Under the lock, use live labels explicitly, reload current settings/contacts/judgments, check pending Keep/final decisions/abort/cap and confirmed bulk kind/minScore, then write intent and dispatch with no individual quota wait or retry.
4. On an explicit quota 403/429 refusal remove the intent, pause the account and restart the whole reservation/read/policy operation. Preserve intents for ambiguous remote outcomes or local persistence errors after success; do not blindly retry ambiguous writes. Document the pre-call-crash conservative overcount window.
5. Persist backlog membership only on insertion by the first import and only for mail dated before account connection. Never infer uncapped membership from internalDate alone; sync/recovery additions stay capped and existing flags never flip.
6. Version rerun job payloads when inputs change and persist a policy generation in cleanup cursors. Restart old-generation cursors instead of resuming behind changed data.
7. Keep worklist rows until processing finishes. Insert-ignore message ids and monotonically advance notification stamps; consume only the observed stamp. Abort during reservation/backoff leaves cursors behind the unprocessed email. Save the prior cursor before failing at an error threshold so Resume retries that email. Use indexed keysets and event-loop yields between CPU-only batches.
8. Test with real small-window QuotaMeter, fake timers and fake Gmail: mutate policy/protection/Keep while quota is saturated, abort reservation and backoff, verify fresh reads on quota retries and no double metering, and cover every lane in shutdown drain. Add an SQLite trigger rejecting local Trash-label persistence to prove accepted intents survive local write failures.
## Pitfalls
- Deleting work before an awaited remote read loses durable notifications on a crash.
- Awaiting only per-message resolved promises yields microtasks, not HTTP/timers; add an explicit event-loop yield between batches.
- An exception in local label persistence is not a failed Gmail call; deleting the intent in a catch that covers both creates an unrecorded successful mutation.
- Gmail label read and Trash are separate operations; changes after the request is sent cannot be cancelled atomically.

## Verification
1. Confirm fake-transport regressions for mid-read policy changes, Keep/Undo finality, stale/missing judgments, live UNREAD changes, intent-before-call and accepted-intent persistence.
2. Confirm only queued ids are considered in incremental cleanup and newer notification stamps survive consumption; confirm HTTP/timers get a turn between batches.
3. Use EXPLAIN QUERY PLAN to verify due-work keysets use the outcome index instead of repeated mailbox scans.
4. Run TypeScript and the repository suite; for Vitest JSON inspect numFailedTestSuites and numFailedTests directly.