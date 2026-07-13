---
name: api-design
description: Design or review production HTTP APIs for resource naming, methods, status codes, validation, pagination, errors, authorization, rate limits, and compatibility.
metadata:
  origin: ECC
  adapted-for: pi-0.80.6
---

# API Design

Follow the existing API contract first. Introduce a new convention only when the project has none or the user requests a change.

## Resource Contract

- Use nouns for resources and consistent casing.
- Match HTTP methods to semantics: `GET`, `POST`, `PUT`, `PATCH`, and `DELETE`.
- Preserve safe and idempotent behavior where the method promises it.
- Use subresources for clear ownership; use action endpoints sparingly.

## Responses

- `200` for successful reads and updates with bodies.
- `201` plus `Location` for created resources.
- `204` for successful operations without a body.
- `400` for malformed requests, `401` for missing/invalid authentication, `403` for denied authorization, `404` for absent resources, `409` for state conflicts, `422` for semantically invalid input when that distinction is established, and `429` for rate limits.
- Never return internal errors, stack traces, SQL details, or secrets to clients.

Use one stable error shape with a machine-readable code, safe message, and field details when useful.

## Collections

- Paginate unbounded lists.
- Prefer cursor pagination for large or frequently changing datasets; offset pagination is appropriate for small datasets and page-number UX.
- Validate filter, sort, field, cursor, and limit parameters.
- Set a bounded maximum page size.

## Security and Operations

- Authenticate explicitly or document the endpoint as public.
- Authorize access to the specific resource, not merely the route.
- Validate all external input using the project's established validation mechanism.
- Rate-limit sensitive or expensive operations.
- Define timeouts, idempotency, and retry behavior for writes and external calls.
- Update API documentation and compatibility tests when changing a public contract.

## Review Checklist

Confirm naming, method, status code, request schema, response schema, error shape, pagination, authentication, authorization, abuse controls, observability, and backwards compatibility.
