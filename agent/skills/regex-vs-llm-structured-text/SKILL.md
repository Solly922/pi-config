---
name: regex-vs-llm-structured-text
description: Choose deterministic parsing before LLM extraction for structured text, using an LLM only for ambiguous low-confidence residue.
metadata:
  origin: ECC
  adapted-for: pi-0.80.6
---

# Regex vs LLM for Structured Text

Use the first method that reliably expresses the format:

1. A native parser for JSON, YAML, CSV, XML, URLs, dates, or language syntax.
2. Exact string operations for fixed delimiters.
3. A small regex for stable local patterns.
4. A deterministic state machine when nesting or escaping exceeds a readable regex.
5. An LLM only for ambiguous natural language.

Do not use an LLM where a dependable parser exists or force regex onto recursive or context-dependent grammar.

## Hybrid Pattern

Parse and validate confident structure deterministically. Send only rejected or low-confidence residue to the smallest available model that satisfies quality, privacy, and schema requirements. Validate its output before merging it.

Keep representative valid, missing, malformed, escaped, and Unicode examples. For production or adversarial parsers, also test input-size limits and monitor fallback rate; a rising rate indicates parser or contract drift.
