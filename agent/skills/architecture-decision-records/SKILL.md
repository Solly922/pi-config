---
name: architecture-decision-records
description: Capture consequential architecture decisions as concise ADRs with context, alternatives, rationale, consequences, and status. Use when a decision should outlive the current Pi session.
metadata:
  origin: ECC
  adapted-for: pi-0.80.6
---

# Architecture Decision Records

Create an ADR only when requested or approved and the decision is costly to reverse, changes system boundaries, adopts infrastructure, or rejects a credible alternative maintainers may revisit.

## Workflow

1. Find the repository's ADR location, format, numbering, and index.
2. Confirm the decision in one sentence unless the user's request already establishes it.
3. Record repository and discussion evidence, realistic alternatives including the status quo, and why the choice fits current constraints.
4. State positive and negative consequences, migration impact, and known follow-up work.
5. Update an existing ADR index.

Use the repository's format when present; otherwise use:

```markdown
# ADR-NNN: Decision title

Date: YYYY-MM-DD
Status: Proposed | Accepted | Superseded | Deprecated

## Context
## Decision
## Alternatives Considered
## Consequences
## Verification
```

Include `Verification` only when the outcome has a meaningful observable check. Never invent consensus, benchmarks, or requirements.
