---
name: architecture-decision-records
description: Capture consequential architecture decisions as concise ADRs with context, alternatives, rationale, consequences, and status. Use when a decision should outlive the current Pi session.
metadata:
  origin: ECC
  adapted-for: pi-0.80.6
---

# Architecture Decision Records

Do not create an ADR for routine implementation choices. Propose one when a decision is costly to reverse, changes system boundaries, adopts infrastructure, or rejects a plausible alternative future maintainers may revisit.

Ask for confirmation before writing files.

## Workflow

1. Inspect the repository for an existing ADR location, numbering scheme, and index.
2. State the decision in one sentence and confirm it with the user.
3. Record evidence from the actual repository and discussion.
4. Describe realistic alternatives fairly, including keeping the current approach.
5. Explain why the selected option best fits current constraints.
6. Record positive and negative consequences, migration impact, and follow-up work.
7. Update the existing ADR index if one exists.

## Template

```markdown
# ADR-NNN: Decision title

Date: YYYY-MM-DD
Status: Proposed | Accepted | Superseded | Deprecated

## Context
What forces and constraints require a decision?

## Decision
What was chosen?

## Alternatives Considered
What credible options were rejected, and why?

## Consequences
What becomes easier, harder, or constrained?

## Verification
How will we know the decision works as intended?
```

Use the repository's format when it differs. Never invent consensus, benchmarks, or requirements that were not established.
