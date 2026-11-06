// After Claude Code or Codex compacts a thread, adds what observational memory recorded for it in
// the shadow session, as pi's own compaction summary would.

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { OBSERVATIONAL_MEMORY, piTypeScriptLoader, shadowPaths } from '../lib/pi.mjs';

const LEDGER = join(OBSERVATIONAL_MEMORY, 'src', 'session-ledger');
// Claude moves hook text over 10,000 characters into a file and Codex spills context over 2,500
// tokens, so the summary stays under both. Observational memory keeps the newest entries.
const SUMMARY_MAX_TOKENS = 2_300;

export async function handle(_name, harness, input) {
  if (input.source !== 'compact' || typeof input.session_id !== 'string') return undefined;

  const { file } = shadowPaths(harness, input.session_id);
  if (!existsSync(file)) return undefined;

  const entries = readFileSync(file, 'utf8').split('\n').flatMap((line) => {
    try {
      return line ? [JSON.parse(line)] : [];
    } catch {
      return [];
    }
  });

  const jiti = await piTypeScriptLoader();
  const { foldLedger } = await jiti.import(join(LEDGER, 'fold.ts'));
  const { renderSummaryWithBudget } = await jiti.import(join(LEDGER, 'render-summary.ts'));

  const ledger = foldLedger(entries);
  const { text } = renderSummaryWithBudget(ledger.reflections, ledger.activeObservations, { maxTokens: SUMMARY_MAX_TOKENS });
  if (!text) return undefined;

  return { hookSpecificOutput: { hookEventName: 'SessionStart', additionalContext: text } };
}
