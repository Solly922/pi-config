import { closeSync, fstatSync, openSync, readSync } from 'node:fs';

const INJECTED_PREFIXES = [
  '# AGENTS.md instructions',
  '<environment_context>',
  '<user_instructions>',
  '<permissions instructions>',
  '<codex_internal_context',
  '<turn_aborted>',
  'The following is the Codex agent history whose request action you are assessing.',
  'The following is the Codex agent history added since your last approval assessment.',
];

function requireString(value, field) {
  if (typeof value !== 'string' || !value) throw new TypeError(`Invalid ${field}`);
  return value;
}

function requireObject(value, field) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError(`Invalid ${field}`);
  return value;
}

function textParts(content, type) {
  if (!Array.isArray(content)) throw new TypeError('Invalid content blocks');

  return content.filter(block => block?.type === type && typeof block.text === 'string')
    .map(block => block.text).join('\n');
}

function toolText(value) {
  if (typeof value === 'string') return value;
  if (value == null) return '';
  if (Array.isArray(value)) return value.map(toolText).join('\n');
  if (['image', 'input_image', 'output_image'].includes(value.type)) return '[image]';
  if (typeof value.text === 'string') return value.text;
  if (value.output !== undefined) return toolText(value.output);
  if (value.content !== undefined) return toolText(value.content);
  return JSON.stringify(value);
}

function toolResult(toolCallId, toolNames, value, isError, timestamp) {
  let text = toolText(value);
  if (text.length > 20000) {
    let kept = 20000;
    let note;
    do {
      note = `\n[truncated ${text.length - kept} characters]`;
      kept = 20000 - note.length;
    } while (`\n[truncated ${text.length - kept} characters]` !== note);

    text = text.slice(0, kept) + note;
  }

  return {
    role: 'toolResult', toolCallId, toolName: toolNames.get(toolCallId) ?? 'unknown',
    content: [{ type: 'text', text }], isError, timestamp,
  };
}

function assistant(content, harness, model, timestamp) {
  return {
    role: 'assistant', content, api: 'native', provider: harness === 'claude' ? 'claude-code' : 'codex',
    model: typeof model === 'string' && model ? model : 'unknown',
    usage: {
      input: 0, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: 0,
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
    },
    stopReason: content.some(block => block.type === 'toolCall') ? 'toolUse' : 'stop', timestamp,
  };
}

function convertClaude(row, toolNames, timestamp) {
  const message = requireObject(row.message, 'message');
  if (row.type === 'user') {
    const content = message.content;
    const text = typeof content === 'string' ? content : textParts(content, 'text');
    const userEntry = text.trim() ? { message: { role: 'user', content: [{ type: 'text', text }], timestamp } } : undefined;
    if (!Array.isArray(content)) return userEntry ? [userEntry] : [];

    const entries = [];
    let addedText = false;

    for (const block of content) {
      if (block?.type === 'text' && userEntry && !addedText) {
        entries.push(userEntry);
        addedText = true;
      }
      if (block?.type !== 'tool_result') continue;

      const callId = requireString(block.tool_use_id, 'tool_use_id');
      entries.push({ message: toolResult(callId, toolNames, block.content, block.is_error === true, timestamp) });
    }

    return entries;
  }

  if (!Array.isArray(message.content)) throw new TypeError('Invalid assistant content');

  const content = [];
  for (const block of message.content) {
    if (block?.type === 'text' && block.text !== '') content.push({ type: 'text', text: requireString(block.text, 'text') });
    if (block?.type === 'thinking' && block.thinking !== '') content.push({ type: 'thinking', thinking: requireString(block.thinking, 'thinking') });
    if (block?.type === 'tool_use') {
      content.push({
        type: 'toolCall', id: requireString(block.id, 'tool_use id'), name: requireString(block.name, 'tool name'),
        arguments: requireObject(block.input, 'tool input'),
      });
    }
  }

  // Claude writes a final answer with thinking as a thinking line and a text line, both marked
  // end_turn, so only the line carrying the answer text ends the turn.
  const entries = content.length ? [{ message: assistant(content, 'claude', message.model, timestamp) }] : [];
  const answers = content.some(block => block.type === 'text') && !content.some(block => block.type === 'toolCall');
  if (['end_turn', 'stop_sequence'].includes(message.stop_reason) && answers) entries.push({ turnEnd: true });

  return entries;
}

function convertCodex(row, toolNames, model, timestamp) {
  const payload = requireObject(row.payload, 'payload');
  if (row.type === 'event_msg') return [{ turnEnd: true }];

  // Keep assistant items separate so incremental reads never change tool-call/result pairing or IDs.
  switch (payload.type) {
    case 'message': {
      if (!['user', 'assistant'].includes(payload.role)) return [];

      const text = textParts(payload.content, payload.role === 'user' ? 'input_text' : 'output_text');
      if (!text.trim()) return [];
      if (payload.role === 'user') {
        if (INJECTED_PREFIXES.some(prefix => text.trimStart().startsWith(prefix))) return [];
        return [{ message: { role: 'user', content: [{ type: 'text', text }], timestamp } }];
      }

      return [{ message: assistant([{ type: 'text', text }], 'codex', payload.model ?? model, timestamp) }];
    }
    case 'reasoning': {
      if (payload.summary == null) return [];

      const thinking = textParts(payload.summary, 'summary_text');
      return thinking.trim() ? [{ message: assistant([{ type: 'thinking', thinking }], 'codex', payload.model ?? model, timestamp) }] : [];
    }
    case 'function_call':
    case 'custom_tool_call':
    case 'local_shell_call': {
      const id = requireString(payload.call_id ?? payload.id, 'call_id');
      const name = requireString(payload.type === 'local_shell_call' ? (payload.name ?? 'local_shell') : payload.name, 'tool name');
      let args;
      if (payload.type === 'function_call') {
        const raw = payload.arguments;
        if (typeof raw !== 'string') throw new TypeError('Invalid arguments');

        try {
          args = JSON.parse(raw);
        } catch {
          args = { raw };
        }

        if (!args || typeof args !== 'object' || Array.isArray(args)) args = { raw };
      } else if (payload.type === 'custom_tool_call') {
        if (typeof payload.input !== 'string') throw new TypeError('Invalid custom input');
        args = { input: payload.input };
      } else {
        args = requireObject(payload.action, 'shell action');
      }

      const message = assistant([{ type: 'toolCall', id, name, arguments: args }], 'codex', payload.model ?? model, timestamp);
      return [{ message }];
    }
    case 'function_call_output':
    case 'custom_tool_call_output': {
      const id = requireString(payload.call_id, 'call_id');
      const isError = payload.is_error === true || payload.output?.is_error === true;
      return [{ message: toolResult(id, toolNames, payload.output, isError, timestamp) }];
    }
    default:
      return [];
  }
}

// toolNames maps tool call ids to tool names; pass the same Map on every read of one transcript so
// results whose calls came in an earlier read still get their tool name.
export function readTranscript(harness, path, offset = 0, toolNames = new Map()) {
  if (!['claude', 'codex'].includes(harness)) throw new TypeError(`Unknown harness: ${harness}`);
  if (!Number.isSafeInteger(offset) || offset < 0) throw new TypeError('Offset must be a nonnegative safe integer');

  const fd = openSync(path, 'r');
  let buffer;
  let bytesRead = 0;
  try {
    buffer = Buffer.alloc(Math.max(0, fstatSync(fd).size - offset));
    while (bytesRead < buffer.length) {
      const count = readSync(fd, buffer, bytesRead, buffer.length - bytesRead, offset + bytesRead);
      if (!count) break;
      bytesRead += count;
    }
  } finally {
    closeSync(fd);
  }

  const entries = [];
  let model = 'unknown';
  let start = 0;
  let end;

  while ((end = buffer.indexOf(10, start)) !== -1 && end < bytesRead) {
    const lineOffset = offset + start;
    const line = buffer.toString('utf8', start, end);
    start = end + 1;
    if (!line.trim()) continue;

    try {
      const row = requireObject(JSON.parse(line), 'line');
      if (harness === 'claude') {
        if (!['user', 'assistant'].includes(row.type) || row.isSidechain !== false || row.isMeta === true) continue;
        // Claude's compaction summary is written as a user line; it is not something the user said.
        if (row.isCompactSummary === true || row.isVisibleInTranscriptOnly === true) continue;
      } else {
        if (row.type === 'turn_context' && typeof row.payload?.model === 'string') model = row.payload.model;
        if (row.type !== 'response_item' && !(row.type === 'event_msg' && row.payload?.type === 'task_complete')) continue;
      }

      const timestamp = typeof row.timestamp === 'number' ? row.timestamp : Date.parse(row.timestamp);
      if (!Number.isFinite(timestamp)) throw new TypeError('Invalid timestamp');

      const converted = harness === 'claude' ? convertClaude(row, toolNames, timestamp) : convertCodex(row, toolNames, model, timestamp);
      if (!converted.length) continue;

      const sourceId = harness === 'claude' ? requireString(row.uuid, 'uuid')
        : row.ordinal ?? `${requireString(row.payload.id ?? row.payload.call_id ?? row.payload.turn_id, 'source id')}:${row.payload.type}`;
      if (typeof sourceId !== 'string' && !Number.isSafeInteger(sourceId)) throw new TypeError('Invalid source id');

      converted.forEach((entry, index) => {
        for (const block of entry.message?.content ?? []) {
          if (block.type === 'toolCall') toolNames.set(block.id, block.name);
        }

        // offset is where the source line starts, so a reader can resume before an entry it has not stored.
        entries.push({ id: converted.length === 1 ? String(sourceId) : `${sourceId}:${index}`, offset: lineOffset, ...entry });
      });
    } catch (error) {
      // Do not echo source text: malformed transcripts can contain secrets or enormous tool output.
      console.error(`Malformed transcript line at ${path}:${lineOffset} (${error.name})`);
    }
  }

  return { entries, offset: offset + start };
}
