#!/usr/bin/env node
// Entry point for every native Claude Code and Codex hook: node run.mjs <claude|codex> <handler>.
// pi's Claude bridge loads the user's Claude settings, so these hooks also fire inside pi, where
// pi's own extensions already do this work. PI_CODING_AGENT marks those runs.

import { readFileSync } from 'node:fs';

const HANDLERS = {
  'session-context': () => import('./session-context.mjs'),
  shadow: () => import('./shadow.mjs'),
  observations: () => import('./observations.mjs'),
  'wiki-recall': () => import('./wiki.mjs'),
  'wiki-guard': () => import('./wiki.mjs'),
  rtk: () => import('./rtk.mjs'),
  'ponytail-activate': () => import('./ponytail.mjs'),
  'ponytail-mode': () => import('./ponytail.mjs'),
  'ponytail-subagent': () => import('./ponytail.mjs'),
};

const [harness, name] = process.argv.slice(2);

if (!process.env.PI_CODING_AGENT && HANDLERS[name] && (harness === 'claude' || harness === 'codex')) {
  try {
    const input = JSON.parse(readFileSync(0, 'utf8') || '{}');
    const module = await HANDLERS[name]();
    const output = await module.handle(name, harness, input);
    if (output !== undefined) process.stdout.write(typeof output === 'string' ? output : JSON.stringify(output));
  } catch (error) {
    // A hook that fails must not block the session, so this only logs; the harness shows stderr.
    console.error(`pi-workflow hook ${name} failed: ${error instanceof Error ? error.stack : error}`);
  }
}
