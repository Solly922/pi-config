---
name: "amend-frozen-model-experiments"
description: "Amend a pre-holdout model experiment without losing evidence, replay safety, or shared budget accounting"
version: 1
created: "2026-09-22"
updated: "2026-09-22"
---
## When to Use
A frozen paid-model experiment stops on malformed responses and the user approves an error-handling amendment before final-test selection.

## Procedure
1. Get explicit approval for the policy change; keep strict response validation and convert rejected outputs to audited abstentions rather than weakening validity checks.
2. Preserve the parent database, canonical plan and source archive. Refuse amendments after winner selection or holdout execution; verify unchanged strategy, prompts, model, dependencies, dates and ranking rules.
3. Create an exclusive child artifact with parent byte hashes and amendment metadata. Import every paid reservation and raw response, including an invalid response that has no completed step. Retain its original cost and count against the same total budget.
4. Rekey cached requests only for the approved contract/policy change. Record old-to-new keys, original inputs, statuses and response hashes. Unknown paid outcomes remain non-retryable; do not refund capacity.
5. Replay completed steps and require identical evidence apart from expected key remapping. Block the network and remove credentials so the first cache miss stops before a reservation; verify counts and parent hashes before paid continuation.
6. Report invalid-response abstentions separately from normal abstentions and unresolved requests. State that child cumulative spend includes imported parent spend.

## Pitfalls
- Canonical JSON digest and literal file SHA differ when the file has a newline; identify which hash a contract uses.
- Blocking only the request function may be too late: a reservation can already have been committed. Stop before reserving uncached calls during offline replay.
- Never restart in a fresh empty ledger or add parent and child cumulative spend together.
- Do not use policy amendments to retune strategy thresholds after seeing holdout outcomes.

## Verification
1. Offline tests cover preserved parent bytes, cache reuse without calls, unchanged prior steps, budget carry-forward, forbidden holdout amendments and malformed responses becoming no-trade decisions.
2. Real-parent replay reaches the first uncached request with no new reservation, and source/artifact hashes still validate.
3. Independent review checks the amendment and budget boundary before paid continuation.