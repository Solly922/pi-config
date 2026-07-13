---
name: codebase-onboarding
description: Analyze an unfamiliar repository and produce an architecture map, entry points, conventions, workflows, and concise Pi guidance. Use when joining a project or creating AGENTS.md.
metadata:
  origin: ECC
  adapted-for: pi-0.80.6
---

# Codebase Onboarding

Default to read-only analysis. Create or update `AGENTS.md` only when explicitly requested.

## Reconnaissance

1. Read root instructions, documentation, manifests, lockfiles, and contributor guidance.
2. Map the top-level structure without traversing generated dependencies.
3. Locate entry points, tests, configuration, and major domain concepts.
4. Inspect recent history and worktree state without modifying either.
5. Read representative files rather than exhaustively loading the repository.

## Report

Include what the request needs from:

- Purpose and user-facing behavior.
- Runtime, frameworks, package manager, and major dependencies.
- Architecture, data flow, and key entry points with paths.
- Repository-confirmed build, test, lint, and development commands.
- Naming, formatting, testing, and error-handling conventions.
- External services and environment variable names without secret values.
- Risks and unresolved questions.

When writing `AGENTS.md`, include only repository-specific guidance an agent cannot infer cheaply. Do not duplicate generic language or package documentation. Reload Pi before validating changed Pi instructions.
