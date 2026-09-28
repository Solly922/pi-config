---
name: "rewrite-git-history-without-touching-worktrees"
description: "Apply an approved path-removal and historical-redaction plan in an isolated Git mirror, then verify before pushing"
version: 2
created: "2026-09-04"
updated: "2026-09-09"
---
## When to Use
After explicit approval of a secret-history cleanup map, when original files/worktrees must stay unchanged and remote pushing requires separate authorization.

## Procedure
1. Create a private persistent run directory. Snapshot original shared refs, HEAD, all worktree statuses, and machine-only content digests for preserved files. Clone the live remote into a separate mirror and save a private pre-rewrite bundle.
2. Compare every fresh remote ref with the approved inventory. Disable the isolated origin push URL until an exact branch push is authorized. Never use a local-ref-contaminated audit mirror as a push source.
3. Inventory historical path/blob associations including merge diffs. Search internally for exact known credential bytes across every version and commit metadata, emitting only counts and paths. Reopen approval if unapproved paths require changes.
4. Use a pinned recent git-filter-repo supporting sensitive-data removal. Apply exact approved path removals. Use a path-scoped file-info callback for historical source redaction and root ignore-rule additions. Keep private literal data out of arguments and output. Use no-fetch only with a fresh complete mirror and verified ref snapshot.
5. Test the callback against synthetic fixtures before filtering: unrelated paths and clean current files unchanged, file modes preserved, ignore additions idempotent, and newline style preserved. Keep commit topology using prune-empty never and prune-degenerate never when simpler review and mapping are preferred.
6. Verify every old/new commit tree through commit-map. Removed paths must be absent; all other path sets, modes, and blob IDs must match except the exact approved transformations. Verify authors, dates, parent mapping, unchanged current helper blobs, and unaffected branches.
7. Scan every stored object including unreachable objects for known values, run provider-specific and focused scans with merge diffs, and run git fsck. Triage remaining findings structurally. Published dependency metadata can be compared byte-for-byte against a checksum-verified official distribution rather than displaying values.
8. Recheck all original worktrees, refs and file digests. Save exact old-to-new branch/ref maps and a private report. Get independent review. Explain lost commit signatures, PR-ref limitations, original-history backups and rotation requirements. Stop before pushing unless separately authorized.

## Pitfalls
- GitHub PR refs may be rewritten in the local mirror but cannot be force-pushed. Do not confuse local preparation with remote cleanup; deleted branch heads can still have retained PR history.
- A mirror contains remote.origin.mirror=true; a blanket push can update unintended refs. An approved push must enumerate only intended branch refs and guard their old values. Disable mirror semantics in the prepared clone as an additional safeguard.
- Sensitive rollback bundles and machine-only literal files must remain private; never serve their directory over HTTP.
- History rewriting strips commit signatures. Report the count before remote approval.
- File-info callbacks receive only non-deletion changes and should return unchanged blob identifiers when content is unchanged.
- Scanner matches in JSX ternaries, input labels, dependency versions and formatting expressions are often false positives. Test fixtures or documentation should not be declared safe solely by filename.
- GitHub can regenerate PR merge refs asynchronously after a base branch advances. Compare the full ref snapshot before rewriting and again before pushing; stop on drift and distinguish regenerated merge refs from changed branch heads before refreshing.
- After users delete branches, rebuild from a fresh remote-only ref inventory rather than pushing the previous mirror, which could recreate deleted branches.
- Different ref inventories can produce different rewritten IDs through commit-message hash substitutions even for an unchanged original branch tip. Use only the latest verified commit/ref map and verify that message changes are limited to expected mapped hash tokens.
## Verification
1. Synthetic callback tests pass.
2. All commit trees, parents, identities and approved transformations are verified against the original snapshot.
3. Known values have zero matches across stored Git objects and fsck passes.
4. All original refs/worktrees/files remain unchanged.
5. The full remote update map is available, and GitHub refs remain unchanged until an authorized push.