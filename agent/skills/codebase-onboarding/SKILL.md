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

1. Read the repository root, `README`, contributor docs, manifests, lockfiles, and existing agent instructions.
2. Use `find` when available, or `rg --files`, to map the top-level structure without traversing generated dependencies.
3. Use `grep` when available, or `rg`, to locate entry points, routes, tests, configuration, and major domain concepts.
4. Inspect recent history and the current worktree without changing either.
5. Read representative files rather than exhaustively loading the repository.

## Produce

- Purpose and primary user-facing behavior.
- Runtime, frameworks, package manager, and major dependencies.
- Architecture and data-flow summary.
- Key entry points with paths.
- Build, test, lint, and development commands confirmed from repository files.
- Naming, formatting, testing, and error-handling conventions.
- External services and required environment variable names without secret values.
- Risk areas, unknowns, and suggested first task.

## AGENTS.md Guidance

When requested, write only repository-specific instructions that a coding agent cannot infer cheaply. Avoid duplicating generic language guidance or package documentation. After changing Pi configuration or instructions, use `/reload` before validating behavior.
