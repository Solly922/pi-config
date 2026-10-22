# Output format

The answer to a why question. Write for the user, in exactly this structure, after you have applied [epistemics.md](epistemics.md). A reader who takes the answer to the original author or the team lead should know what is documented, what is inferred, and what is missing, so they can ask the right follow-up.

The rules that shape every section:

1. Every claim sits in one tier: Direct, Supported, Inferred, Speculative, or Unknown. The tier sets its section and its phrasing.
2. Every Direct and Supported claim carries a citation: commit hash, PR number, issue ID, doc path, session date, or `file:line`.
3. Inferred and Speculative claims use hedged language ("appears to", "likely", "suggests", "one possibility is").
4. Code is mechanics, not motivation. Cite it for what the target does, never for why.
5. A gap stays a gap. Leave an open question open instead of filling it with a plausible guess.

---

## The Question

Restate the user's question in one or two sentences.

## The Code in Question

File paths, line ranges, key symbols. Two or three lines to orient a cold reader.

## What We Found

Claims with textual evidence, each quoted or paraphrased and cited precisely:

- **[Direct]** {Claim}. Source: PR #123 / issue #45 / commit abc1234 / `file:line`. {Brief quote or paraphrase.}
- **[Supported]** {Claim}. Evidence: {list of items and what each contributes.}

`[Direct]` is single-source, explicit evidence, something an author wrote. `[Supported]` is several indirect items converging on one conclusion. A past-session snippet appears here only when git confirms it, and the citation is the git evidence.

## What We Can Reasonably Infer

Claims stated nowhere but well supported by indirect evidence. Each bullet shows the inference chain ("Given A and B, it is likely that C") in hedged language:

- **[Inferred]** {Hedged claim}. Reasoning: {the specific evidence and the inference step.}

Skip this section if there is nothing to infer.

## Competing Hypotheses

When the evidence fits more than one story, present each, and do not force a winner the record does not support. For each:

- **Hypothesis:** {one-sentence statement}
- **Evidence for:** {specific items}
- **Evidence against or missing:** {what would need to be true but is not, or what counter-signals exist}

Skip this section if there is a single clear answer.

## What We Don't Know

Specific gaps. "Searched issues for 'rate limit' and 'throttle' (open and closed) and found nothing about the 100-request threshold" beats "we don't know why." Include:

- Questions that went unanswered
- Searches that returned nothing, with the queries
- Sources that were unavailable, and why
- People who would likely know, such as the commit author or the PR reviewer, and what to ask them

## Sources Consulted

One line per source, so the user can judge coverage and redirect. Each line says searched, nothing found, or unavailable:

- **Source control (git, `gh`):** {files, number of commits reviewed, PRs and issues read, queries.} Or "unavailable: {reason}".
- **In-repo docs:** {ADRs, CHANGELOG, docs, comments, TODOs, tests checked, and the queries.} Or "nothing found: {queries}".
- **Past sessions and notes:** {`session_search`, `memory_search`, `wiki_search` queries and what came back.} Or "unavailable: {reason}".
- **Incident search** (defensive targets only): {labels, files, and commits checked.}
- **Not reachable from here:** team chat, observability dashboards, error trackers. Name any the answer likely depends on.

## Confidence Summary

One or two sentences on overall confidence, for example:

> The core rationale (A) is directly supported by the PR description and review thread. The specific threshold (100) is inferred from surrounding context and documented nowhere. Whether a customer request drove this could not be answered, because no linked issue exists and team chat is not searchable from here.

## Preserve / Change / Avoid / Risk

Add this section when the user asks why before changing the code. Convert the lineage findings into constraints for planning the change, each tagged with its tier and citation:

- **Preserve.** Behavior and guarantees the history shows were deliberate: an edge case a test pins, a limit a review thread defended.
- **Change.** What the history shows is stale or accidental: a workaround for a bug fixed upstream, a TODO that names its own removal.
- **Avoid.** Approaches the record shows were tried and reverted, or rejected in review.
- **Risk.** What could break if the change ignores the history, plus the unknowns carried over from What We Don't Know.

---

## Check before returning

Revise if any item fails:

1. Does every claim in What We Found have a citation you opened? If not, add one or move it to Inferred or Competing Hypotheses.
2. Does the phrasing match the tier? Direct claims can use "because". Inferred claims cannot.
3. Did you surface every contradiction you noticed, or quietly pick one?
4. Does What We Don't Know name specific gaps? An empty section is suspicious, since historical investigations almost always have them.
5. Did you check the hypothesis embedded in the question against the evidence?
6. Did you cite code as evidence for its own intent? Remove it.
7. Is the tone calibrated? A confident answer on weak evidence is the failure this skill exists to prevent.

The value of the answer is its honesty. Optimize for being useful, not for looking decisive.
