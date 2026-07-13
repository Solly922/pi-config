---
name: security-review
description: Review authentication, authorization, user input, APIs, secrets, dependencies, payments, file handling, and sensitive data for exploitable security issues.
metadata:
  origin: ECC
  adapted-for: pi-0.80.6
---

# Security Review

Treat repository evidence as authoritative. Review first. Apply fixes only when the active role permits editing and the user requests them; specialist-agent restrictions always take precedence over this skill.

## Review Order

1. Identify trust boundaries, assets, actors, and externally controlled input.
2. Trace authentication and authorization for each sensitive operation.
3. Validate input before queries, process execution, file access, rendering, or deserialization.
4. Check secret storage, logs, errors, and generated artifacts for exposure.
5. Review data integrity, concurrency, replay, and transaction behavior for financial or destructive operations.
6. Inspect dependency and deployment risk using tools already installed by the project.

## Required Checks

- No hardcoded credentials, tokens, private keys, or sensitive test fixtures.
- Parameterized database queries and safe ORM usage.
- Server-side authorization independent of client controls.
- Output encoding or sanitization appropriate to the rendering context.
- CSRF protection for cookie-authenticated state changes.
- Safe session and cookie settings.
- File upload limits, content validation, storage isolation, and non-executable handling.
- Path traversal and command injection prevention.
- Generic client errors with detailed diagnostics confined to trusted logs.
- Rate limits and abuse controls on costly or sensitive endpoints.
- Least-privilege service, database, and cloud access.
- Dependency findings assessed for actual reachability and impact.

For infrastructure, IAM, CI/CD, or cloud deployments, also verify workload identity, private service exposure, encryption, backup restoration, workflow token permissions, pinned third-party actions, non-root containers, runtime resource limits, audit logs, and secret exclusion from build output and artifacts.

Do not mark an item safe without evidence. Report unverified controls as unverified.

## Findings Format

Order findings by severity. Each finding must include:

- Severity and vulnerability category.
- Exact file and line.
- Evidence and exploitation preconditions.
- Impact.
- Smallest safe remediation.

If no findings are identified, say so and list residual risks or testing gaps.
