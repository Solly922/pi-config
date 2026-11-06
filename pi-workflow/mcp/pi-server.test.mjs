// Starts the real server, so Hermes runs its usual startup against ~/.pi/agent, as pi does.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import { test } from 'node:test';

const SERVER = new URL('./pi-server.mjs', import.meta.url).pathname;

test('pi MCP server lists the pi tools, keeps stdout for protocol messages, and exits on stdin close', async () => {
  const child = spawn(process.execPath, [SERVER], { stdio: ['pipe', 'pipe', 'pipe'] });
  const replies = new Map();
  const nonProtocol = [];

  createInterface({ input: child.stdout }).on('line', (line) => {
    let message;
    try {
      message = JSON.parse(line);
    } catch {
      nonProtocol.push(line);
      return;
    }
    replies.get(message.id)?.(message);
  });

  let nextId = 0;
  const request = (method, params) => new Promise((resolve) => {
    const id = ++nextId;
    replies.set(id, resolve);
    child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', id, method, params })}\n`);
  });

  const init = await request('initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'test', version: '0' } });
  assert.equal(init.result.serverInfo.name, 'pi');
  child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' })}\n`);

  const list = await request('tools/list', {});
  assert.deepEqual(list.result.tools.map((tool) => tool.name).sort(), [
    'memory_add', 'memory_remove', 'memory_replace', 'memory_search', 'route', 'session_search', 'skill_manage',
  ]);
  for (const tool of list.result.tools) assert.equal(tool.inputSchema.type, 'object', tool.name);

  const unknown = await request('tools/call', { name: 'bash', arguments: { command: 'true' } });
  assert.equal(unknown.result.isError, true);

  child.stdin.end();
  const code = await new Promise((resolve) => child.on('close', resolve));
  assert.equal(code, 0);
  assert.deepEqual(nonProtocol, []);
});
