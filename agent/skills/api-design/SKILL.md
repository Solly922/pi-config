---
name: api-design
description: Design or review production HTTP APIs for resource contracts, methods, responses, pagination, authorization, abuse controls, and compatibility.
metadata:
  origin: ECC
  adapted-for: pi-0.80.6
---

# API Design

Follow the existing contract first. Introduce a convention only when the project has none or the user requests a change.

## Contract

- Use consistently cased resource nouns and HTTP methods with their standard safety and idempotency semantics.
- Prefer resources and clear subresources; use action endpoints only when resource semantics do not fit.
- Use established success codes (`200`, `201` with `Location`, or `204`) and distinguish malformed, unauthenticated, unauthorized, missing, conflicting, invalid, and rate-limited requests when useful.
- Return one stable error shape with a machine code, safe message, and optional field details. Never expose internal diagnostics or secrets.

## Collections

Paginate unbounded lists, validate collection parameters, and cap page size. Prefer cursors for large or changing datasets; use offsets when the dataset and UX justify them.

## Safety and Operations

Authenticate explicitly or document the endpoint as public. Authorize the specific resource and validate external input with the project's established mechanism. Apply rate limits, timeouts, retries, and idempotency controls when the endpoint's cost or side effects require them.

For public contract changes, update documentation and compatibility tests. Review only concerns relevant to the changed surface, including naming, schemas, errors, pagination, authorization, abuse resistance, observability, and backward compatibility.
