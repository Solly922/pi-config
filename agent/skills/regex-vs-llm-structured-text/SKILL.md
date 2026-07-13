---
name: regex-vs-llm-structured-text
description: Choose deterministic parsing before LLM extraction for structured text, using an LLM only for ambiguous low-confidence residue.
metadata:
  origin: ECC
  adapted-for: pi-0.80.6
---

# Regex vs LLM for Structured Text

## Decision Rule

Use the first method that reliably expresses the format:

1. Native parser for JSON, YAML, CSV, XML, URLs, dates, or language syntax.
2. Exact string operations for fixed delimiters.
3. A small regular expression for stable local patterns.
4. A deterministic state machine when nesting or escaping exceeds a readable regex.
5. An LLM only for genuinely ambiguous natural-language cases.

Do not use an LLM to parse a format with a dependable parser. Do not force regex onto recursive grammar or context-dependent semantics.

## Hybrid Pattern

1. Parse every confidently structured item deterministically.
2. Validate the parsed result with explicit constraints.
3. Collect only rejected or low-confidence items.
4. Send that small residue to the cheapest configured model that reliably satisfies a strict output schema.
5. Validate the model response before merging it.

## Verification

Keep examples for valid input, missing fields, malformed delimiters, escaping, Unicode, and adversarially long input. Measure fallback rate; a rising rate usually means the deterministic parser or format contract needs revision.
