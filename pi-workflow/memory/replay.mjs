// Turns converted transcript entries into what pi stores and emits during an agent run, on a pi
// session that mirrors a native thread. Each stored message records the transcript ids it came
// from, so a restarted replayer rebuilds its state from the session and never stores a line twice.

const TURN_END = 'pi-workflow.turn-end';

export function createReplayer({ sessionManager, emit }) {
  const seen = new Set();
  const toolNames = new Map();
  let draft;
  let turn;
  let turnIndex = 0;

  restore(sessionManager.getBranch());

  // pendingOffset is where the transcript must be read again from after a restart: the first line
  // of an assistant response that is not stored yet.
  return { toolNames, replay, finish, pendingOffset: () => draft?.offset };

  function restore(entries) {
    for (const entry of entries) {
      if (entry.type === 'custom' && entry.customType === TURN_END) {
        seen.add(entry.data?.nativeId);
        closeRestoredTurn();
        continue;
      }

      if (entry.type !== 'message') continue;

      const { message } = entry;
      for (const id of message.nativeIds ?? []) seen.add(id);
      for (const block of message.content ?? []) if (block?.type === 'toolCall') toolNames.set(block.id, block.name);

      if (message.role === 'assistant') {
        closeRestoredTurn();
        turn = { message, entryId: entry.id, results: [] };
      } else if (message.role === 'toolResult') {
        turn?.results.push({ message, entryId: entry.id });
      } else if (message.role === 'user') {
        closeRestoredTurn();
      }
    }
  }

  // Counts the turns the session already ended, so turn_end numbering carries on after a restart.
  function closeRestoredTurn() {
    if (!turn) return;

    turn = undefined;
    turnIndex++;
  }

  async function replay(entry) {
    if (seen.has(entry.id)) return;
    seen.add(entry.id);

    if (entry.turnEnd) {
      await finish();
      sessionManager.appendCustomEntry(TURN_END, { nativeId: entry.id });
      await emit({ type: 'agent_end', messages: [] });
      await emit({ type: 'agent_settled', aborted: false });
      return;
    }

    const { message } = entry;

    // Both harnesses write one model response as several transcript lines (thinking, text, each
    // tool call); pi stores the response as one assistant message.
    if (message.role === 'assistant') {
      if (draft) {
        draft.message.content.push(...message.content);
        draft.ids.push(entry.id);
        return;
      }

      await closeTurn();
      draft = { message: { ...message, content: [...message.content] }, ids: [entry.id], offset: entry.offset };
      return;
    }

    await storeDraft();

    if (message.role === 'toolResult') {
      const stored = { ...message, nativeIds: [entry.id] };
      const entryId = sessionManager.appendMessage(stored);
      await emit({ type: 'message_end', message: stored });
      turn?.results.push({ message: stored, entryId });
      return;
    }

    await closeTurn();
    await emit({ type: 'agent_start' });

    const stored = { ...message, nativeIds: [entry.id] };
    sessionManager.appendMessage(stored);
    await emit({ type: 'message_end', message: stored });
  }

  async function finish() {
    await storeDraft();
    await closeTurn();
  }

  async function storeDraft() {
    if (!draft) return;

    const hasToolCalls = draft.message.content.some((block) => block.type === 'toolCall');
    const stored = { ...draft.message, stopReason: hasToolCalls ? 'toolUse' : 'stop', nativeIds: draft.ids };
    draft = undefined;

    const entryId = sessionManager.appendMessage(stored);
    await emit({ type: 'message_end', message: stored });
    turn = { message: stored, entryId, results: [] };
  }

  async function closeTurn() {
    if (!turn) return;

    const { message, entryId, results } = turn;
    turn = undefined;
    await emit({
      type: 'turn_end',
      turnIndex: turnIndex++,
      message,
      toolResults: results.map((result) => result.message),
      messageEntryId: entryId,
      toolResultEntryIds: results.map((result) => result.entryId),
    });
  }
}
