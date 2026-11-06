// The marked block at the end of ~/.codex/config.toml: pi-workflow's MCP servers and the trust
// entries for its hooks. Codex checks the result, and a file it rejects is put back.

import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';

import {
  CODEX_CONFIG, CODEX_ENV, DRY_RUN, GENERATED, TOML_MARKERS, cliOptions, findBlock, runCli, tomlString, writeIfChanged,
} from './context.mjs';
import { CODEX_HOOKS } from './hooks.mjs';
import { MCP_SERVERS, codexServerTables } from './mcp.mjs';

// A trust table exactly as trustTable writes it.
const TRUST_TABLE = /^\[hooks\.state\.("(?:[^"\\]|\\.)*")\]\ntrusted_hash = ("[^"\n]*")\n/gm;
// A trust table header in either TOML string style, as Codex or the user may write it.
const TRUST_HEADER = /^\s*\[\s*hooks\s*\.\s*state\s*\.\s*(?:"((?:[^"\\]|\\.)*)"|'([^'\n]*)')\s*\]/gm;
const SERVER_HEADER = /^\s*\[\s*mcp_servers\s*\.\s*["']?([\w-]+)["']?\s*[.\]]/;

// hookTrust is [{ key, hash }], or undefined to keep the block's current trust entries.
export function syncCodexConfig(hookTrust) {
  const existing = existsSync(CODEX_CONFIG) ? readFileSync(CODEX_CONFIG, 'utf8') : '';
  const block = findBlock(existing, TOML_MARKERS);
  if (!block) throw new Error(`${CODEX_CONFIG} needs one pi-workflow start marker before one end marker, or neither; fix it by hand`);

  const before = block.found ? existing.slice(0, block.start) : existing;
  const inside = block.found ? existing.slice(block.start, block.end) : '';
  const after = block.found ? existing.slice(block.end).replace(/^\r?\n/, '') : '';

  // Codex appends the tables it writes, such as trust it records or `codex mcp add` servers, at the
  // end of the file, which is inside this block. Sync moves them above it instead of dropping them.
  const { ours, foreign } = splitTables(inside);
  const outside = before + foreign + after;

  // A same-named server or trust entry the user wrote wins: a second table with the same name
  // would make config.toml invalid.
  const servers = codexServerTables(userServers(ours, outside));
  const userTrusted = new Set([...outside.matchAll(TRUST_HEADER)].map((match) => match[2] ?? unquote(match[1])));
  const current = [...ours.matchAll(TRUST_TABLE)].map((match) => ({ key: JSON.parse(match[1]), hash: JSON.parse(match[2]) }));
  const trust = (hookTrust ?? current).filter(({ key }) => !userTrusted.has(key)).map(trustTable);

  const header = `# ${GENERATED}. Edit sync/mcp.mjs or sync/hooks.mjs there, then rerun it.\n\n`;
  const newBlock = `${TOML_MARKERS.start}\n${header}${[...servers, ...trust].join('\n')}${TOML_MARKERS.end}\n`;
  const kept = `${before}${foreign}`;
  writeIfChanged(CODEX_CONFIG, `${kept === '' ? '' : `${kept.replace(/\n*$/, '\n')}\n`}${newBlock}${after}`);
  if (DRY_RUN) return;

  const written = readFileSync(CODEX_CONFIG, 'utf8');
  if (written === existing || runCli('codex', ['mcp', 'list', '--json'], CODEX_ENV) !== 'failed') return;

  // Codex reads this file on every start, so a file it rejects goes back, unless someone changed it since.
  if (readFileSync(CODEX_CONFIG, 'utf8') !== written) {
    throw new Error(`Codex rejected ${CODEX_CONFIG}, and it changed again before sync could restore it; fix it by hand`);
  }

  writeIfChanged(CODEX_CONFIG, existing);
  throw new Error(`${CODEX_CONFIG} was restored because Codex rejected the new pi-workflow block`);
}

// Splits the block's text into the tables sync generates and every other table in it.
function splitTables(inside) {
  const body = inside.replace(new RegExp(`^${TOML_MARKERS.end}\\s*$`, 'm'), '');
  let ours = '';
  let foreign = '';

  for (const table of body.split(/^(?=[ \t]*\[)/m).slice(1)) {
    if (isGeneratedTable(table.split('\n')[0])) ours += table;
    else foreign += table.replace(/\n*$/, '\n\n');
  }

  return { ours, foreign };
}

function isGeneratedTable(header) {
  const server = SERVER_HEADER.exec(header);
  if (server) return Object.hasOwn(MCP_SERVERS, server[1]);

  const trust = new RegExp(TRUST_HEADER.source).exec(header);
  const key = trust && (trust[2] ?? unquote(trust[1]));
  return key !== null && key.startsWith(`${CODEX_HOOKS}:`);
}

// TOML basic strings share JSON's common escapes; a key using TOML-only escapes is left as written.
function unquote(text) {
  try {
    return JSON.parse(`"${text}"`);
  } catch {
    return text;
  }
}

function trustTable({ key, hash }) {
  return `[hooks.state.${tomlString(key)}]\ntrusted_hash = ${tomlString(hash)}\n`;
}

// Codex's own parser sees every TOML form a user might write. Without a parseable config, fall back
// to the table headers outside the block.
function userServers(ours, outside) {
  const run = spawnSync('codex', ['mcp', 'list', '--json'], cliOptions(CODEX_ENV));

  if (run.status === 0) {
    try {
      const generated = tableNames(ours);
      return new Set(JSON.parse(run.stdout).map((server) => server.name).filter((name) => !generated.has(name)));
    } catch {
      // Unexpected output: fall through to the headers.
    }
  }

  return tableNames(outside);
}

function tableNames(toml) {
  return new Set([...toml.matchAll(new RegExp(SERVER_HEADER.source, 'gm'))].map((match) => match[1]));
}
