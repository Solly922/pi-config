---
name: why
description: "Why does X work this way, why was this built, why did this regress, why this threshold or magic number. Answers design rationale, motivation, and tradeoffs from git and gh history (blame, pickaxe, PRs, reviews, linked GitHub issues), in-repo docs (ADRs, CHANGELOG, comments, tests), and past Pi sessions and notes. Returns a cited answer that separates what someone wrote from what is inferred. For what the code does at runtime, read the code or use explore_code instead."
license: MIT
metadata:
  origin: cursor/plugins pstack@7698375 (Lauren Tan)
  adapted-for: pi-1.3.0
---

# Why

Investigate the motivation and intent behind code. Reading the code (or `explore_code`) answers what it does and how it works. `why` answers what forces led to its shape.

You run the whole investigation yourself, one source family at a time. Work as a careful, cautious, precise investigator. Be honest about what you know versus what you infer. Read [references/epistemics.md](references/epistemics.md) before you write anything, and follow it.

## Step 1. Understand the target and the question

The target is usually a chunk of code, a pattern, a feature, or a named design decision. The question is usually a design rationale, a tradeoff, a motivating edge case, an external constraint, dead code, a regression, or a broad history sweep.

If the target is vague ("why do we do it this way?" with no clear referent), make your best guess from conversation context (open files, recent edits, what was just discussed). State your interpretation in a sentence so the user can redirect, then proceed.

Done when you can state the target (file, line range, symbols) and the question in one sentence each.

## Step 2. Establish the code anchor

Build the seed context before searching any source: file paths and line ranges, key symbols, the last few commits touching the target, PR numbers from merge commits (pattern `(#1234)` in the subject line), and any linked issue IDs.

```bash
git blame -L <start>,<end> <file>              # last-touch commit per line
git log --follow -p -- <file>                  # full history with patches, through renames
git log --oneline -20 -- <file>                # recent commits, PR numbers visible
git log -S '<exact string>' -- <file>          # pickaxe: commits that added or removed this text
git log -G '<regex>' -- <file>                 # pickaxe for a pattern
git log -1 --format=%B <commit>                # full message: PR number, Fixes #N
```

Then read the PR for every substantive commit, body, comments, and reviews in full:

```bash
gh pr view <number> --json title,body,author,createdAt,mergedAt,labels,closingIssuesReferences,comments,reviews
```

Blame that lands on a reformat, a rename, or a squash needs more digging. See [references/code-archaeology.md](references/code-archaeology.md).

Done when you hold the file, line, symbol, commit hash, PR number, and issue ID of every substantive change to the target, and you have read each linked PR.

## Step 3. Search every source

Run all three searches, even when the anchor seems to answer the question. A skipped search is a gap you must name. Record the queries you ran.

1. **Source control.** git and `gh`: PRs, review threads, and linked GitHub issues (the issue tracker). Playbook: [references/code-archaeology.md](references/code-archaeology.md).
2. **In-repo docs.** ADRs, CHANGELOG, `docs/`, READMEs, code comments, TODO/FIXME, and tests. Same playbook.
3. **Past sessions and notes.** Run `session_search` for the file path, key symbols, and PR number (try two or three phrasings, with and without the `project` filter), then `memory_search` and `wiki_search` for the same terms. This is secondary evidence. An agent's past claim is not proof, so cite the snippet with its session date and confirm it against git where you can. Tier it by [epistemics](references/epistemics.md#secondary-evidence).

If the target looks defensive (retries, timeouts, null guards, rate limits, feature flags, egress guards, OOM handlers), also run the incident search in [references/code-archaeology.md](references/code-archaeology.md#defensive-code-incident-and-postmortem-signals).

Give each source one status: searched (with what you found), nothing found (with the queries), or unavailable (with the reason, such as `gh` not authenticated, no remote, shallow clone, or the tool missing). Team chat, observability dashboards, and error trackers are not reachable from here. When the answer probably lives there, list them as unavailable and say who to ask.

Done when every source has a status and you have read, in full, each item you plan to cite.

## Step 4. Weigh the evidence

Put every claim in one tier from [references/epistemics.md](references/epistemics.md): Direct, Supported, Inferred, Speculative, or Unknown. Surface contradictions with both citations. Treat a hypothesis embedded in the question ("I assume it's for performance?") as one candidate, and check it against the evidence.

Done when every Direct and Supported claim has a citation you opened, and every other claim is hedged or moved to the gaps.

## Step 5. Present

Write the answer in the structure from [references/output-format.md](references/output-format.md): The Question, The Code in Question, What We Found, What We Can Reasonably Infer, Competing Hypotheses, What We Don't Know, Sources Consulted, Confidence Summary. Keep the confidence separation intact, and keep Sources Consulted to one line per source, including the ones that returned nothing.

If the user is asking before changing this code, add the Preserve / Change / Avoid / Risk constraint set described in the output format reference.

## Common failure modes to avoid

- **Recency bias.** The most recent commit is not automatically authoritative. The current shape is often the accretion of many earlier decisions, so trace back.
- **Uncited claims.** Cite a real `file:line` or commit hash for every claim, and open it first. A PR number or issue ID you did not fetch does not go in the answer.
- **Inventing.** Name only callers, APIs, PRs, and tickets you saw in the repo or in tool output. Never invent one to complete a story.
- **Hiding a null.** A search that finds nothing is still an answer. Report the query and the result under What We Don't Know.
- **Code as its own evidence.** `limit = 100` shows what the code does, not why. Intent needs something an author wrote.
- **Rubber-stamping.** Confirming the user's guess because it sounds right. Check it like any other hypothesis.
- **Trusting a past session.** An earlier agent's explanation is a lead. Verify it in git before it counts as more than Inferred.
- **Tidying history.** A clean rationale retrofitted onto messy history misleads. Leave the mess in.
