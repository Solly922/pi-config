---
name: council
description: Get review or feedback from the council members named in APPEND_SYSTEM.md and loop until they agree. Use for /skill:council.
disable-model-invocation: true
license: MIT
metadata:
  origin: t3dotgg/tstack@1085050 (Theo Browne)
  adapted-for: pi-1.4.0
---

# Council

Before an audit, address outstanding PR comments, fix known issues, and run
relevant checks. Give council the updated implementation; do not defer known
fixes until reviews return. If the user wants to discard the implementation
and explore new ideas, skip fixes to code being replaced.

Bring in one delegate per council member listed in APPEND_SYSTEM.md, at the
thinking level listed there, usually for review or feedback. If the user's
instructions name other members, use those. If a member is unavailable,
report it instead of substituting.

Launch the delegates in parallel with `JevAgent`, setting `agent`, `model`,
and `thinking` so Jev skips its paid routing. Use the `code-reviewer` agent
for code review and the `architect` agent for plans, designs, and other
non-code feedback. Both are read-only. Give each delegate the request and relevant
context, wait for every result with `get_subagent_result`, then summarize the
useful findings, disagreements, and recommended next steps.

For a code review, ask each delegate for a grade from 0 to 100.
code-reviewer already ends its report with one.
Count each full review pass as one round.
A fresh review after fixes starts a new round.

If the work ends in a pull request, put the results in the PR description.
Put this section before the model and harness line at the end:

```markdown
## Council review

Rounds: 2

| Delegate | Round 1 | Round 2 |
| --- | --- | --- |
| Claude Opus 5.5 | 72/100 | 90/100 |
| GPT-6.1 Sol | 80/100 | 95/100 |
| GPT-6.1 Terra | 70/100 | 88/100 |
```

If a delegate gives no score, write `no score`. Do not invent one.
If the PR is open, edit the description. Do not post a comment for this.
If there is no PR, put the same results in the final reply only.

If you agree with their recommendations, make the changes and request a fresh
review after. Each round is a new launch, so its brief carries the earlier
findings, your responses, and what changed since the last round. Continue
until every delegate is satisfied, for at most 3 rounds. Stop early when a
round raises only minor findings. If delegates still disagree after round 3,
stop and give the user both sides of each open item in two or three lines,
with your recommendation.

Do not let repeated reviews result in scope creep. It is your job to fight to
keep scope limited.
