---
name: html-communication
description: When the user asks to communicate through an HTML document, or if they mentino "HTML" with no
additional context. Use self-contained HTML to communicate complex information when visual
structure improves understanding. Use for plans, architecture docs, codebase
maps, comparisons, dashboards, timelines, diagrams, reports, post-mortems,
design explorations, and technical explainers 
---

# HTML Communication

Use HTML for any request to produce a readable HTML artifact for a human - whether it is called
a plan, spec, write-up, findings, summary, report, comparison, or a set of UI mocks.

HTML is better when the user benefits from visual hierarchy, spatial organization, comparison, 
diagrams, navigation, or a document they can explore.

Do not use HTML for short answers, small code snippets, simple debugging, or
tasks where visual structure adds little value.

Use the frontend-builder agent to construct the html only

## Self-contained HTML

Prefer one HTML file containing all required styles and visuals.

Basic structure:

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>...</title>
  <style>
    /* styles */
  </style>
</head>
<body>
  ...
</body>
</html>
```

Prefer:

* inline CSS
* semantic HTML
* system font stacks
* inline SVG
* CSS gradients and patterns
* `<details>` / `<summary>` for expandable detail

Avoid unnecessary external dependencies.

The file should remain useful when opened directly in a browser.

## Visual design

Always use the frontend-design skill
Give the artifact an intentional visual style appropriate to the subject.

Choose:

* background treatment
* typography
* spacing
* accent palette
* card style
* code styling
* diagram treatment

Examples:

* database migration → terminal-inspired
* infrastructure plan → blueprint/technical
* product strategy → editorial
* performance report → dashboard

Do not make every artifact look identical.

## Design quality

Every artifact should have:

* strong hierarchy
* readable typography
* generous spacing
* clear section boundaries
* good contrast
* responsive layouts
* meaningful visual grouping

Keep prose reasonably narrow:

```css
.prose {
  max-width: 70ch;
}
```

Wide diagrams and tables may exceed that width.

Avoid:

* giant text blocks
* tiny fonts
* excessive gradients
* decorative cards with no purpose
* too many colors
* excessive shadows
* visual clutter

Every visual element should communicate information.

## Diagrams

Use diagrams when relationships are easier to understand visually.

Good uses include:

* architecture
* request flow
* data flow
* service dependencies
* state transitions
* migrations
* deployment topology
* database relationships
* execution sequences

Do not diagram information that is clearer as a list.

## Mermaid

If Mermaid is useful, render it to SVG before placing it in the HTML.

Example:

```bash
npx -y -p @mermaid-js/mermaid-cli \
  mmdc \
  -i architecture.mmd \
  -o architecture.svg \
  -b transparent
```

Inline the resulting SVG into the document.

Do not depend on Mermaid JavaScript running in the browser.

When future edits would benefit from preserving the source, include it in a
collapsed section:

```html
<details class="diagram-source">
  <summary>Diagram source</summary>
  <pre><code>
flowchart LR
  Browser --> API
  API --> Database
  </code></pre>
</details>
```

## Architecture diagrams

Show meaningful boundaries and important protocols.

Prefer:

```text
Browser
   │ HTTPS
   ▼
Web App
   │
   ▼
API
   ├── Auth Service
   └── Core Service
          │ SQL
          ▼
       Postgres
```

over:

```text
Frontend → Backend → Database
```

Label things like:

* HTTPS
* gRPC
* WebSocket
* RabbitMQ
* SQL
* OAuth callbacks

when relevant.

## Implementation plans

Plans should answer:

1. What changes?
2. Why?
3. What exists today?
4. What should exist afterward?
5. What components are affected?
6. In what order should work happen?
7. What could go wrong?
8. How is success verified?

Useful sections:

```text
Overview
Current State
Target State
Goals / Non-goals
Architecture
Implementation Phases
Risks
Verification
Open Questions
```

Each phase should be actionable.

Bad:

```text
Phase 2: Update backend
```

Better:

```text
Phase 2 — Introduce session adapter

Files:
- internal/auth/session.go
- internal/http/middleware/auth.go

Changes:
- add SessionProvider interface
- implement new provider
- preserve legacy compatibility

Verification:
- unit tests
- login/logout integration test
```

## Comparisons

When comparing options, make the tradeoffs obvious.

Include when relevant:

* recommendation
* strongest advantage
* strongest drawback
* implementation effort
* complexity
* cost
* migration difficulty
* reversibility

Prefer side-by-side visual comparison over long separate essays.

## PR and code-change artifacts

Emphasize:

* behavior changes
* affected modules
* API changes
* schema changes
* request/data-flow changes
* risks
* test coverage
* unresolved concerns

Do not simply convert a git diff into HTML.

Interpret the change.

Useful layout:

```text
Before → After
Changed files by subsystem
Request/data flow
Risks
Verification
```

## Code snippets

Keep code focused and secondary to the explanation.

Use:

```html
<pre><code>...</code></pre>
```

For longer snippets, use `<details>`.

Label snippets with file paths when known.

## Verification

Before presenting the artifact:

1. Confirm the file exists.
2. Confirm the HTML structure is valid.
3. Remove obvious placeholders.
4. Verify important claims against source material.
5. Check file paths and symbol names.
6. Make sure diagrams match the explanation.
7. Check desktop readability.
8. Check responsive behavior when possible.
9. Ensure no secrets or sensitive data are included.
10. Ensure required resources are self-contained.

If browser tooling is available, visually inspect the page and fix obvious
layout problems before presenting it.

## Security and privacy

Before publishing, check for:

* API keys
* tokens
* passwords
* customer information
* private infrastructure details
* internal URLs
* sensitive source code
* credentials

If the artifact contains sensitive information:

* keep it local
* do not upload it
* give the user the local path instead

## Publish with Postplan

ALWAYS PUBLISH TO POSTPLAN
When the artifact is safe to publish and a shareable URL is useful:

```bash
npx postplan upload <artifact.html>
```

Example:

```bash
npx postplan upload docs/plans/2026-08-07-auth-migration.html
```

Capture the returned URL and give it to the user.

Do not paste the entire HTML source into chat unless explicitly requested.

## Updating an artifact

When revising an existing artifact:

1. Edit the existing HTML file.
2. Preserve useful structure.
3. Update affected diagrams and metrics.
4. Re-run verification.
5. Republish when appropriate.
6. Return the updated URL or path.

Avoid creating duplicate versions unless version separation is intentional.

## Git Tracking

Plans do not always need to be committed.

Inspect the repository first and follow its existing conventions. Track the plan when it has lasting value, such as when:

* the repo already tracks plans, ADRs, RFCs, or design docs
* the work is significant, long-running, or spans multiple contributors/PRs
* future maintainers will benefit from the rationale or implementation sequence

Keep it temporary when:

* the repo does not normally track planning artifacts
* the plan is mainly for the current discussion
* it will become obsolete quickly
* the same information is already tracked elsewhere

Choose the location based on the existing file structure and the plan's expected long-term value.

## Final quality check

Before finishing, ask:

* Can the main point be understood quickly?
* Does each visual element communicate something?
* Are claims grounded in evidence?
* Are tradeoffs obvious?
* Are proposed changes distinct from current behavior?
* Can another engineer act on this?
* Is the artifact self-contained?
* Is it safe to publish?

If not, improve it before presenting it.
