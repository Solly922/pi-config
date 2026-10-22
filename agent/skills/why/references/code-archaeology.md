# Code archaeology (git, gh, in-repo)

The most trustworthy source for a why question, because it is tied directly to the code. Everything that went through the repo should be here. Search it before anything else, and expect the rest of the record to be thin.

## What this source contains

- Commit history (messages, dates, authors, diffs)
- PR descriptions, review comments, and discussion threads (via `gh`)
- GitHub issues linked from commits and PR bodies, which serve as the issue tracker
- Inline code comments, TODOs, FIXMEs, deprecation notes
- ADRs (architectural decision records) if the repo keeps them
- Tests, whose names and assertions often encode the edge cases that motivated a change
- Related files modified in the same commits (co-change signal)
- CHANGELOG entries and release notes in the repo

## Git history

Expand the seed commit list from Step 2:

```bash
# History through renames
git log --follow --oneline -- <file>

# Pickaxe: commits that added or removed this exact text
git log -S '<exact_string_from_code>' -- <file>

# Or for patterns:
git log -G '<regex>' -- <file>

# Who wrote each line and when
git blame -L <start>,<end> <file>

# One commit's full diff
git show <hash>

# Commits between two points affecting this file
git log <old>..<new> -p -- <file>

# Commit messages that mention a keyword or issue number
git log --all --oneline --grep='<keyword>'
```

When blame lands on a commit that only moved or reformatted the line, look past it:

- `git blame -w -C -C -C -L <start>,<end> <file>` ignores whitespace and follows lines copied from other files.
- `git blame -L <start>,<end> <commit>^ -- <file>` re-runs blame from the parent of the commit you want to see past.
- `git log -S` finds the commit that introduced the text even when blame points at a later rewrite.

A squash-merge commit carries one message for the whole PR. The individual commit messages live in the PR (`gh pr view <number> --json commits`).

## GitHub: PRs, reviews, issues

```bash
# PR body, discussion, and verdicts
gh pr view <number> --json title,body,author,createdAt,mergedAt,labels,closingIssuesReferences,comments,reviews

# Inline review comments on the diff (the pull-request-comment threads)
gh api repos/{owner}/{repo}/pulls/<number>/comments

# PR for a commit with no (#N) in the subject
gh pr list --state merged --search <sha> --json number,title,url
gh api repos/{owner}/{repo}/commits/<sha>/pulls

# Issues the PR closes, or that a commit message mentions
gh issue view <number> --json title,body,labels,state,closedAt,comments

# Related issues by keyword, open and closed
gh issue list --state all --search '<symbol or feature name>' --json number,title,state,labels
```

Read the whole thread. The reason is often in a review comment, a late issue comment, or a follow-up PR. Try two or three phrasings of the search term (the symbol, the feature name, the user-facing symptom).

## In-repo docs

```bash
# ADRs often live in docs/adr/, docs/decisions/, or similar
rg -l -i 'architecture.decision' --glob '*.md'
rg --files --glob '*.md' | rg -i 'adr|decision|rfc|design'

# CHANGELOG and release notes that name the symbol or the PR
rg -n '<symbol>|#<pr_number>' CHANGELOG* docs/ --glob '*.md'

# TODOs and FIXMEs near the target
rg -n -C2 '(TODO|FIXME|HACK|XXX|NOTE)' <target_file>

# Tests that exercise the symbol
rg -l '<symbol>' --glob '*test*' --glob '*spec*'
```

Read test names and assertions for edge cases the change was meant to cover. A test added in the same commit as a constant or guard is a strong circumstantial signal for what it protects.

## Defensive code: incident and postmortem signals

Run these when the target is a retry, timeout, null guard, rate limit, flag, egress guard, or OOM handler. Defensive code usually answers an incident, and the incident record is where the reason sits.

- Issues labeled `incident`, `sev-*`, `postmortem`, `reliability`, or `regression`: `gh issue list --state all --label incident`, then the same with `--search '<symbol>'`.
- Postmortem or runbook files in the repo: `rg -l -i 'postmortem|post-mortem|incident|runbook' --glob '*.md'`.
- Commits near the date the code was added with messages like "fix for incident", "add defensive check", or "revert" followed by "re-apply with...". Use `git log --grep='incident\|revert\|hotfix' -i -- <file>`. A revert and re-apply pair is a strong signal.
- Past sessions around the same date: `session_search` for the symptom or the incident name.

A merge on the same day as the report, or a change with no linked issue and a terse message, supports "hotfix" as an Inferred reading. It does not prove one.

## What good evidence looks like

- A PR description stating the problem: "fixes the bug where users with >1000 items couldn't paginate"
- A review comment recording a decision: "going with B because A needs a billing-service change"
- A code comment giving a reason: `// clamp to 100 because the upstream API rejects larger values`
- An ADR with context, options, and a decision
- A linked issue with the user-visible symptom

## Pitfalls

- **Mechanical templates.** Some PR templates require a "Why" section and get boilerplate ("improve user experience"). Generic text is probably not a real answer.
- **Stale rationale.** An old issue or comment may describe a plan that changed. Compare its date with the commit date.
- **Closed-as-duplicate chains.** Follow the duplicate relationship back to the canonical issue.
- **Missing context.** Rebased branches, deleted branches, and private or unreachable issues leave holes. Record the hole as a gap, and leave the guess out.
- **Co-change is circumstantial.** Files changed in the same commit suggest a relationship. They do not state one.

## What to record for each item

The location (commit hash, PR number, issue ID, `file:line`), the verbatim quote that bears on the question, the author and date, and one line on how it bears. Record the searches you ran, including the ones that came back empty.
