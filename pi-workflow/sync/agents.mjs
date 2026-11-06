// Agent files: each pi agent in ~/.pi/agent/agents as a Claude Code agent and a Codex agent.

import { existsSync, lstatSync, readFileSync, readdirSync } from 'node:fs';
import { basename, join } from 'node:path';

import {
  CLAUDE_HOME, CODEX_HOME, GENERATED, PI_AGENT, pathExists, remove, tomlMultiline, tomlString, warn, writeIfChanged,
} from './context.mjs';

const CLAUDE_AGENTS = join(CLAUDE_HOME, 'agents');
const CODEX_AGENTS = join(CODEX_HOME, 'agents');

const PROVIDERS = { 'claude-bridge': 'claudeAgent', anthropic: 'claudeAgent', 'openai-codex': 'codex', 'openai-codex-fast': 'codex' };
// An agent whose preferred model is on the other provider runs on these when delegate_task is
// unavailable. Both come from the Model Routing table: Sonnet for bounded checks, Astra by default.
const FALLBACK_MODELS = { claudeAgent: 'claude-sonnet-5-5', codex: 'gpt-6-astra' };
const EFFORTS = ['low', 'medium', 'high', 'xhigh', 'max'];
const CLAUDE_TOOLS = { read: 'Read', grep: 'Grep', find: 'Glob', ls: 'Glob', bash: 'Bash', write: 'Write', edit: 'Edit' };

export function syncAgents() {
  const written = new Set();

  for (const file of readdirSync(join(PI_AGENT, 'agents')).filter((name) => name.endsWith('.md'))) {
    const agent = parseAgent(join(PI_AGENT, 'agents', file));
    const preferred = preferredModel(agent);

    written.add(writeManaged(join(CLAUDE_AGENTS, `${agent.name}.md`), claudeAgentFile(agent, preferred)));
    written.add(writeManaged(join(CODEX_AGENTS, `${agent.name}.toml`), codexAgentFile(agent, preferred)));
  }

  // Filtering by extension keeps one pass from deleting the other's files when both folders are the same.
  for (const [dir, extension] of [[CLAUDE_AGENTS, '.md'], [CODEX_AGENTS, '.toml']]) {
    if (!existsSync(dir)) continue;

    for (const name of readdirSync(dir).filter((file) => file.endsWith(extension))) {
      const path = join(dir, name);
      if (!written.has(path) && isManagedFile(path)) remove(path);
    }
  }
}

function parseAgent(file) {
  const match = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/.exec(readFileSync(file, 'utf8'));
  if (!match) throw new Error(`${file} has no frontmatter`);

  const fields = {};

  for (const line of match[1].split('\n')) {
    if (line.trim() === '') continue;

    const field = /^([a-z_]+):\s*(.*)$/.exec(line);
    if (!field) throw new Error(`${file}: unsupported frontmatter line "${line}"`);
    fields[field[1]] = parseYamlValue(field[2]);
  }

  if (typeof fields.description !== 'string') throw new Error(`${file} has no description`);

  return { name: basename(file, '.md'), file, fields, body: match[2].trim() };
}

function parseYamlValue(raw) {
  if (raw.startsWith("'") && raw.endsWith("'")) return raw.slice(1, -1).replaceAll("''", "'");
  if (raw.startsWith('"') && raw.endsWith('"')) return JSON.parse(raw);
  if (raw.startsWith('[') && raw.endsWith(']')) return splitList(raw.slice(1, -1));
  if (raw === 'true' || raw === 'false') return raw === 'true';
  return raw;
}

function splitList(text) {
  return text.split(',').map((item) => item.trim()).filter(Boolean);
}

function preferredModel(agent) {
  const { model, thinking } = agent.fields;
  if (!model) return undefined;

  const [prefix, ...rest] = model.split('/');
  const provider = PROVIDERS[prefix];
  if (!provider) throw new Error(`${agent.file}: no T3 provider for model ${model}`);

  return { provider, model: rest.join('/'), effort: EFFORTS.includes(thinking) ? thinking : undefined };
}

function modelFor(harness, preferred) {
  if (!preferred) return {};

  const model = preferred.provider === harness ? preferred.model : FALLBACK_MODELS[harness];
  // gpt-6-astra accepts only low, medium, or high (Model Routing).
  const effort = model === 'gpt-6-astra' && ['xhigh', 'max'].includes(preferred.effort) ? 'high' : preferred.effort;
  return { model, effort };
}

function describe(agent, preferred) {
  const description = agent.fields.description.trim();
  if (!preferred) return description;

  const effort = preferred.effort ? ` at ${preferred.effort}` : '';
  return `${description} Preferred model: ${preferred.provider} / ${preferred.model}${effort}.`;
}

function preloadedSkills(agent) {
  const { skills } = agent.fields;
  if (Array.isArray(skills)) return skills;
  return typeof skills === 'string' ? splitList(skills) : [];
}

function piTools(agent) {
  return splitList(String(agent.fields.tools ?? '')).filter((tool) => !tool.startsWith('ext:'));
}

function canEdit(agent) {
  const tools = piTools(agent);
  const disallowed = splitList(String(agent.fields.disallowed_tools ?? ''));
  return ['write', 'edit'].some((tool) => tools.includes(tool) && !disallowed.includes(tool));
}

function claudeAgentFile(agent, preferred) {
  const { model, effort } = modelFor('claudeAgent', preferred);
  const skills = preloadedSkills(agent);
  const lines = ['---', `# ${GENERATED} from ~/.pi/agent/agents/${agent.name}.md`, `name: ${agent.name}`];
  lines.push(`description: ${JSON.stringify(describe(agent, preferred))}`);

  // An allowlist would hide MCP servers from agents that pi gives every extension tool.
  if (agent.fields.tools && agent.fields.extensions !== true) lines.push(`tools: ${claudeTools(agent).join(', ')}`);
  if (!canEdit(agent)) lines.push('disallowedTools: Write, Edit, NotebookEdit');
  if (model) lines.push(`model: ${model}`);
  if (effort) lines.push(`effort: ${effort}`);
  if (agent.fields.max_turns) lines.push(`maxTurns: ${agent.fields.max_turns}`);
  if (skills.length > 0) lines.push('skills:', ...skills.map((skill) => `  - ${skill}`));

  const toolNote = 'Tool names here come from pi: read, grep, find, bash, edit, and write mean Read, Grep, Glob, Bash, Edit, and Write.';
  return `${lines.join('\n')}\n---\n\n${toolNote}\n\n${agent.body}\n`;
}

function claudeTools(agent) {
  const tools = piTools(agent).map((tool) => {
    if (!CLAUDE_TOOLS[tool]) throw new Error(`${agent.file}: no Claude Code tool for pi tool "${tool}"`);
    return CLAUDE_TOOLS[tool];
  });

  if (agent.fields.skills === true) tools.push('Skill');
  return [...new Set(tools)];
}

function codexAgentFile(agent, preferred) {
  const { model, effort } = modelFor('codex', preferred);
  const skills = preloadedSkills(agent);

  const preface = ['These instructions were written for pi. Where they say read, grep, find, or ls, use read-only shell commands; where they say edit or write, use apply_patch.'];
  if (!canEdit(agent)) preface.push('You are read-only: do not modify files, and run only commands that leave the system unchanged.');
  if (skills.length > 0) preface.push(`Before starting, load these skills: ${skills.join(', ')}.`);

  const lines = [`# ${GENERATED} from ~/.pi/agent/agents/${agent.name}.md`, `name = ${tomlString(agent.name)}`];
  lines.push(`description = ${tomlString(describe(agent, preferred))}`);
  if (model) lines.push(`model = ${tomlString(model)}`);
  if (effort) lines.push(`model_reasoning_effort = ${tomlString(effort)}`);
  lines.push(`developer_instructions = ${tomlMultiline(`${preface.join('\n')}\n\n${agent.body}`)}`);

  return `${lines.join('\n')}\n`;
}

function writeManaged(path, content) {
  // lstat-based: a symlink here, even a dangling one, belongs to someone else and is never written through.
  if (pathExists(path) && !isManagedFile(path)) {
    warn(`${path} exists and pi-workflow does not manage it; skipped`);
  } else {
    writeIfChanged(path, content);
  }

  return path;
}

// Only the file named after its own source counts, so an edited copy of a generated agent is the user's.
function isManagedFile(path) {
  const source = `${basename(path).replace(/\.(md|toml)$/, '')}.md`;
  return lstatSync(path).isFile() && readFileSync(path, 'utf8').includes(`# ${GENERATED} from ~/.pi/agent/agents/${source}\n`);
}
