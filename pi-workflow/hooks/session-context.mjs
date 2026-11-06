// SessionStart context that pi gets from its extensions: the LLM Wiki status line and the Hermes
// project skills for this repository.

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';

import { HERMES_SRC, PI_NODE_MODULES, WIKI_PACKAGE, importFile, piTypeScriptLoader } from '../lib/pi.mjs';

const YAML = createRequire(join(PI_NODE_MODULES, 'package.json'))('yaml');

export async function handle(_name, _harness, input) {
  const cwd = typeof input.cwd === 'string' && input.cwd ? input.cwd : process.cwd();
  const parts = [await wikiStatus(cwd), await projectSkills(cwd)].filter(Boolean);
  if (parts.length === 0) return undefined;

  return { hookSpecificOutput: { hookEventName: 'SessionStart', additionalContext: parts.join('\n\n') } };
}

async function wikiStatus(cwd) {
  const { resolveVaultPaths } = await importFile(join(WIKI_PACKAGE, 'dist', 'extensions', 'llm-wiki', 'lib', 'utils.js'));
  const { WIKI_STATUS_BLOCK } = await importFile(join(WIKI_PACKAGE, 'dist', 'extensions', 'llm-wiki', 'lib', 'inject.js'));

  const paths = resolveVaultPaths(cwd);
  if (!existsSync(join(paths.dotWiki, 'config.json'))) return undefined;

  return `${WIKI_STATUS_BLOCK}\nWiki vault: ${paths.root}`;
}

async function projectSkills(cwd) {
  const jiti = await piTypeScriptLoader();
  const { detectProjectSkills } = await jiti.import(join(HERMES_SRC, 'project.ts'));
  const { skillsDir, name } = detectProjectSkills(undefined, cwd);
  if (!skillsDir || !existsSync(skillsDir)) return undefined;

  const skills = readdirSync(skillsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && existsSync(join(skillsDir, entry.name, 'SKILL.md')))
    .map((entry) => describeSkill(join(skillsDir, entry.name, 'SKILL.md'), entry.name));
  if (skills.length === 0) return undefined;

  return [
    `Hermes project skills for ${name}. When a task matches a description, read that SKILL.md and follow it before acting:`,
    ...skills,
  ].join('\n');
}

function describeSkill(path, fallbackName) {
  let fields = {};

  try {
    fields = YAML.parse(/^---\n([\s\S]*?)\n---/.exec(readFileSync(path, 'utf8'))?.[1] ?? '') ?? {};
  } catch (error) {
    console.error(`pi-workflow: unreadable frontmatter in ${path}: ${error.message}`);
  }

  return `- ${fields.name ?? fallbackName}: ${fields.description ?? '(no description)'} (${path})`;
}
