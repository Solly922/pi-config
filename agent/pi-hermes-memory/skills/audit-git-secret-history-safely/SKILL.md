---
name: "audit-git-secret-history-safely"
description: "Prepare a redacted Git-history cleanup map without changing worktrees or remote refs"
version: 1
created: "2026-09-04"
updated: "2026-09-04"
---
## When to Use
Before a history rewrite when local files must be preserved and the affected paths need approval.

## Procedure
1. Inventory Git metadata only: tracked status, shallow status, branches, tags, worktrees, stash and checkpoint refs. Avoid displaying remote URLs.
2. Create a private temporary directory and separate bare audit clone with no hardlinks. Fetch live branches, tags and pull-request refs into an audit namespace in that clone only. Capture ref names and OIDs.
3. Run a trusted offline scanner with full redaction. Keep logs private and expose only file paths, line numbers, rule identifiers and commit IDs. Include merge diffs with git log --all --full-history -m; distinguish reachable-commit inventory from scanner patch counts.
4. Supplement provider-specific rules with literal credential checks. Triage false positives structurally without revealing values. Record uncertain matches as unresolved, not safe merely because they occur in tests or dependencies.
5. Map exact paths, aliases, affected refs, current-tip detections and filesystem presence. Check imports before whole-file removal. Keep needed source files and recommend redacting historical literals instead. Include supporting ignore-file edits.
6. Present the private map and stop for approval. An eventual rewrite should use a separate clone; pushing requires separate exact-ref approval and collaborator coordination.

## Pitfalls
- Credential regexes can match string-splitting expressions rather than literal values. Structural parsing helps distinguish them.
- Default patch scans can omit merge-only changes. Scanner exit code one commonly indicates findings, not failure; verify completion and error counts.
- Never mirror-push an audit clone containing stash, checkpoint or audit refs. Pull-request refs are read-only and GitHub Support cleanup is conditional.
- Rewriting does not revoke credentials or remove copies from reflogs, forks, old clones or backups. Preserved audit clones retain sensitive history too.
- Never serve the audit directory over HTTP. For browser verification, isolate only the sanitized HTML artifact in a separate served directory.

## Verification
1. Original worktrees and refs remain unchanged through the audit.
2. The report contains no sensitive values and marks unverified detections and scope limitations.
3. Path counts, ref counts and OIDs match recorded metadata.
4. No rewrite, commit, push, local-ref cleanup or filesystem deletion occurs before the relevant approval.