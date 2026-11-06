// The rules block for CLAUDE.md and AGENTS.md: APPEND_SYSTEM.md with the sections that rules/
// replaces for native harnesses.

import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import { CLAUDE_HOME, CODEX_HOME, GENERATED, MARKDOWN_MARKERS, PI_AGENT, WORKFLOW_DIR, writeBlock } from './context.mjs';

const RULES_DIR = join(WORKFLOW_DIR, 'rules');
// Codex stops reading AGENTS.md at project_doc_max_bytes, 32 KiB by default.
const CODEX_DOC_LIMIT = 32 * 1024;

export function syncRules() {
  const rules = renderRules();
  writeBlock(join(CLAUDE_HOME, 'CLAUDE.md'), rules, MARKDOWN_MARKERS);
  writeBlock(join(CODEX_HOME, 'AGENTS.md'), rules, MARKDOWN_MARKERS, { byteLimit: CODEX_DOC_LIMIT });
}

function renderRules() {
  const sections = splitSections(readFileSync(join(PI_AGENT, 'APPEND_SYSTEM.md'), 'utf8'));
  const overrides = loadRuleOverrides();

  for (const heading of overrides.keys()) {
    if (!sections.some((section) => section.heading === heading)) {
      throw new Error(`rules/ replaces "## ${heading}", but APPEND_SYSTEM.md has no such section`);
    }
  }

  const body = sections.map((section) => overrides.get(section.heading) ?? section.text).join('\n\n');
  const note = `<!-- ${GENERATED} from ~/.pi/agent/APPEND_SYSTEM.md and ~/.pi/pi-workflow/rules/. Edit those, then rerun it. -->`;
  return `${MARKDOWN_MARKERS.start}\n${note}\n\n${body}\n${MARKDOWN_MARKERS.end}\n`;
}

function splitSections(markdown) {
  const sections = [{ heading: null, lines: [] }];
  let inFence = false;

  for (const line of markdown.split('\n')) {
    if (line.startsWith('```')) inFence = !inFence;
    if (!inFence && line.startsWith('## ')) sections.push({ heading: line.slice(3).trim(), lines: [] });
    sections.at(-1).lines.push(line);
  }

  return sections
    .map(({ heading, lines }) => ({ heading, text: lines.join('\n').trim() }))
    .filter((section) => section.text !== '');
}

function loadRuleOverrides() {
  const overrides = new Map();

  for (const file of readdirSync(RULES_DIR).filter((name) => name.endsWith('.md'))) {
    const text = readFileSync(join(RULES_DIR, file), 'utf8').trim();
    const heading = /^## (.+)/.exec(text)?.[1].trim();
    if (!heading) throw new Error(`rules/${file} must start with a "## " heading`);
    overrides.set(heading, text);
  }

  return overrides;
}
