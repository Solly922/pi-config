// LLM Wiki hooks: the per-prompt recall pi's llm-wiki extension adds before each turn, and the
// guard that keeps agents from editing the wiki's generated raw/ and meta/ folders by hand.

import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { WIKI_PACKAGE, importFile } from '../lib/pi.mjs';

const LIB = join(WIKI_PACKAGE, 'dist', 'extensions', 'llm-wiki', 'lib');
// Same scope and threshold as the pi extension's auto-recall: three pages from the resolved vault,
// score 5 or more, so only title, heading, alias, or repeated body matches get through.
const RECALL_LIMIT = 3;
const RECALL_MIN_SCORE = 5;
const GENERATED_PATH = /(^|[/\\])\.llm-wiki[/\\](raw|meta)([/\\]|$)/;

export function handle(name, harness, input) {
  return name === 'wiki-recall' ? recall(input) : guard(harness, input);
}

async function recall(input) {
  const prompt = typeof input.prompt === 'string' ? input.prompt.trim() : '';
  if (!prompt) return undefined;

  const { resolveVaultPaths } = await importFile(join(LIB, 'utils.js'));
  const { searchWikiHybrid, formatRecallContext, shouldUseLinksFirst, vaultPageCount } = await importFile(join(LIB, 'recall.js'));

  const paths = resolveVaultPaths(input.cwd || process.cwd());
  if (!existsSync(join(paths.dotWiki, 'config.json'))) return undefined;

  const results = await searchWikiHybrid(paths, prompt, RECALL_LIMIT, RECALL_MIN_SCORE, false, {});
  if (results.length === 0) return undefined;

  const linksOnly = shouldUseLinksFirst(vaultPageCount(paths, false), undefined);
  const context = formatRecallContext(results, { linksOnly });
  if (!context) return undefined;

  return { hookSpecificOutput: { hookEventName: 'UserPromptSubmit', additionalContext: context } };
}

function guard(harness, input) {
  // Resolving against the session folder normalizes ./ and ../, which would otherwise hide a target.
  const cwd = typeof input.cwd === 'string' && input.cwd ? input.cwd : process.cwd();
  const target = editedPaths(harness, input).map((path) => resolve(cwd, path)).find((path) => GENERATED_PATH.test(path));
  if (!target) return undefined;

  return {
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'deny',
      permissionDecisionReason: `Blocked direct edit of ${target}. It is generated wiki state; use the llm-wiki tools (wiki_ensure_page, wiki_retro, wiki_observe, wiki_log_event, wiki_ingest) so its metadata stays consistent.`,
    },
  };
}

// Claude's Write and Edit name one file; Codex's apply_patch names each file in a patch header.
function editedPaths(harness, input) {
  const toolInput = input.tool_input ?? {};
  if (harness === 'claude') return [toolInput.file_path ?? toolInput.notebook_path].filter(Boolean);

  const patch = typeof toolInput.command === 'string' ? toolInput.command : '';
  return [...patch.matchAll(/^\*\*\* (?:Add|Update|Delete) File: (.+)$|^\*\*\* Move to: (.+)$/gm)].map((match) => (match[1] ?? match[2]).trim());
}
