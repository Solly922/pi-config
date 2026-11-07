// Skill links: every pi, Hermes, and ponytail skill folder, linked into the Claude and Codex
// skill folders.

import { existsSync, lstatSync, mkdirSync, readdirSync, readlinkSync, realpathSync, symlinkSync } from 'node:fs';
import { dirname, join } from 'node:path';

import { CLAUDE_HOME, DEST, DRY_RUN, PI_AGENT, log, pathExists, remove, warn } from './context.mjs';

export const SKILL_SOURCES = [
  join(PI_AGENT, 'skills'),
  join(PI_AGENT, 'pi-hermes-memory', 'skills'),
  join(PI_AGENT, 'git', 'github.com', 'DietrichGebert', 'ponytail', 'skills'),
];
const SKILL_TARGETS = [join(CLAUDE_HOME, 'skills'), join(DEST, '.agents', 'skills')];

export function syncSkills() {
  const wanted = new Map();

  for (const root of SKILL_SOURCES) {
    if (!existsSync(root)) {
      warn(`skill source ${root} is missing`);
      continue;
    }

    for (const name of readdirSync(root)) {
      const dir = join(root, name);
      if (!existsSync(join(dir, 'SKILL.md'))) continue;
      if (wanted.has(name)) warn(`skill ${name} is in two sources; keeping ${wanted.get(name)}`);
      else wanted.set(name, dir);
    }
  }

  for (const target of SKILL_TARGETS) linkSkills(target, wanted);
}

function linkSkills(targetRoot, wanted) {
  if (!DRY_RUN) mkdirSync(targetRoot, { recursive: true });
  const present = existsSync(targetRoot) ? readdirSync(targetRoot) : [];
  const stale = new Set();

  for (const name of present) {
    const path = join(targetRoot, name);
    if (!isManagedLink(path) || readlinkSync(path) === wanted.get(name)) continue;

    remove(path);
    stale.add(name);
  }

  for (const [name, source] of wanted) {
    const path = join(targetRoot, name);

    // A dry run leaves stale links in place, so they still count as missing here.
    if (!pathExists(path) || stale.has(name)) {
      log(`link ${path} -> ${source}`);
      if (!DRY_RUN) symlinkSync(source, path);
    } else if (!isManagedLink(path) && !sameTarget(path, source)) {
      warn(`${path} exists and pi-workflow does not manage it; skipped skill ${name}`);
    }
  }
}

function isManagedLink(path) {
  return pathExists(path) && lstatSync(path).isSymbolicLink() && SKILL_SOURCES.includes(dirname(readlinkSync(path)));
}

function sameTarget(path, source) {
  try {
    return realpathSync(path) === realpathSync(source);
  } catch {
    return false;
  }
}
