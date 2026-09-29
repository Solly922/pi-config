---
name: "compare-explore-agent-configurations"
description: "Benchmark Explore model/reasoning configurations with identical tasks and auditable timing and usage"
version: 1
created: "2026-09-04"
updated: "2026-09-04"
---
## When to Use
When the user explicitly asks to compare model or reasoning configurations on repository exploration.

## Procedure
1. Choose one bounded read-only task, give every configuration an identical prompt, and explicitly set the model and thinking level. State whether runs are concurrent and record the working-tree baseline.
2. Preserve each agent's full answer and raw JSONL output outside application source. Get elapsed time from initial task timestamp to final answer timestamp, including retries.
3. Sum assistant-message usage.input, usage.output, usage.cacheRead and usage.cacheWrite separately. Compare their sum to usage.totalTokens. Do not add reasoning again when already included in output.
4. Check for provider errors and match toolResult.toolCallId against recorded toolCall IDs. If calls are missing, treat raw token sums as incomplete rather than exact. Retain discrepancies with the agent-status summary.
5. Verify the same central claims and selected citations for every answer against source, then report timing, usage, factual errors and omissions. Keep single-run recommendations qualified.

## Pitfalls
- A retrying run can preserve tool results while omitting corresponding assistant records from the output transcript. Its usage sum can undercount relative to agent status.
- Cached tokens count repeated context, not unique text. Provider tokenizers and billing differ.
- Agent-status token summaries may exclude cache reads and are rounded; do not label them total processed tokens.
- Do not rerun or expand the benchmark without user authorization merely to obtain a cleaner result.

## Verification
1. Every requested model/reasoning setting has a completed result or explicit failure.
2. Durations agree with agent-status timings within rounding.
3. Accounting limitations and retries are visible in the report.
4. Recommendations distinguish speed, completeness and citation accuracy, and are scoped to the tested task.