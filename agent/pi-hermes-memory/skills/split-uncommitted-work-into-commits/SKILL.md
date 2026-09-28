---
name: "split-uncommitted-work-into-commits"
description: "Group a large dirty worktree into reviewable local commits without rewriting history"
version: 1
created: "2026-09-24"
updated: "2026-09-24"
---
## When to Use
When a branch has many uncommitted paths and the user wants several cohesive commits rather than a history rewrite.

## Procedure
1. Inspect `git status --short --branch`, upstream divergence, staged/unstaged/untracked paths, and worktrees before staging. Do not rewrite published commits by default.
2. Map source imports and tests. Group explicit paths in dependency order: independent documentation or fixes, models with focused tests, feature components, route/integration with browser tests, then deployment configuration.
3. When one new coordinator imports every feature component, leave that file whole. Prefer a slightly larger integration commit over inventing intermediate coordinator versions just to create feature-shaped history.
4. Before each commit, use explicit `git add -- <paths>`, inspect `git diff --cached --stat`, and run `git diff --cached --check`. Commit with a specific subject.
5. Run applicable project checks, then confirm `git status` is clean, compare `git diff --name-status @{u}..HEAD` with the original inventory, and check `git diff --check @{u}..HEAD`. Do not push unless asked.

## Pitfalls
- Untracked files do not appear in ordinary `git diff --stat`; enumerate them separately.
- A repo with multiple workspaces may not have a root package.json. Run test and build commands from the affected workspace with documented local environment values.
- Git commits can group dormant components before their route is wired; disclose that limitation rather than fabricating intermediate file content.
- Do not include secrets or generated artifacts while staging broad globs.

## Verification
1. Every original intended path appears exactly once across the commits; no unrelated path is staged.
2. Final working tree is clean, commit order and subjects match the feature groups, and the branch is ahead by the intended count without having pushed.
3. Relevant tests, typecheck, and build pass with safe local configuration.