// Claude Code reads CLAUDE.md files but not AGENTS.md. pi reads the AGENTS.md in the session folder
// and each folder above it; this adds the ones that have no CLAUDE.md beside them, so a Claude
// thread gets the same project instructions.

import { existsSync, readFileSync, realpathSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

// Claude moves hook text over 10,000 characters into a file and shows only a preview, so larger
// instructions are pointed to instead.
const INLINE_LIMIT = 9_500;
// In both the inline and the pointer text, so a resumed transcript shows whether it already has them.
const MARKER = 'Claude Code does not load AGENTS.md itself';

export function handle(_name, _harness, input) {
  if (input.source === 'resume' && transcriptHasRules(input.transcript_path)) return undefined;

  const files = agentsFiles(sessionFolder(input));
  if (files.length === 0) return undefined;

  const inline = files.map((path) => `Contents of ${path} (project instructions; ${MARKER}):\n\n${readFileSync(path, 'utf8').trim()}`).join('\n\n');
  const context = inline.length <= INLINE_LIMIT
    ? inline
    : `This repository's project instructions are in ${files.join(' and ')}. ${MARKER}, so read ${files.length === 1 ? 'that file' : 'each file'} in full before starting work here.`;

  return { hookSpecificOutput: { hookEventName: 'SessionStart', additionalContext: context } };
}

// The real path, so a session started through a symlink still finds the folders above its target.
function sessionFolder(input) {
  const cwd = resolve(typeof input.cwd === 'string' && input.cwd ? input.cwd : process.cwd());

  try {
    return realpathSync(cwd);
  } catch {
    return cwd;
  }
}

function agentsFiles(cwd) {
  const dirs = [];
  for (let dir = cwd; ; dir = dirname(dir)) {
    dirs.unshift(dir);
    if (dir === dirname(dir)) break;
  }

  return dirs
    .filter((dir) => isOwnFile(join(dir, 'AGENTS.md')) && !existsSync(join(dir, 'CLAUDE.md')) && !existsSync(join(dir, '.claude', 'CLAUDE.md')))
    .map((dir) => join(dir, 'AGENTS.md'));
}

// Someone else's AGENTS.md in a shared folder such as /tmp must not become instructions.
function isOwnFile(path) {
  const stats = statSync(path, { throwIfNoEntry: false });
  return stats?.isFile() === true && (process.getuid === undefined || stats.uid === process.getuid());
}

function transcriptHasRules(path) {
  try {
    return typeof path === 'string' && readFileSync(path, 'utf8').includes(MARKER);
  } catch {
    return false;
  }
}
