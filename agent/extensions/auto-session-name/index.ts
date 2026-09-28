import { join } from 'node:path';
import { getAgentDir, type ExtensionAPI, type ExtensionContext } from '@earendil-works/pi-coding-agent';
import { DEFAULT_CONFIG, loadConfig } from './config.ts';
import { INITIAL_STATE, restoreState, STATE_TYPE, type AutoNameState } from './state.ts';
import { buildExcerpt, countUserPrompts, fallbackTitle, requestTitle } from './title.ts';

const CONFIG_PATH = join(getAgentDir(), 'extensions', 'auto-session-name', 'config.json');

type RetitleOptions = {
  /** The prompt that started this run. Pi has not added it to the branch yet. */
  pendingPrompt?: string;
  /** From /autoname: skip the ownership check and always ask for a fresh title. */
  force?: boolean;
};

/**
 * Names each session from its first prompt, then re-checks the name every few
 * prompts so it follows the conversation. Once the user or another extension
 * renames the session, automatic renames stop. Pi refreshes the terminal title
 * on every rename, so this extension does not touch it.
 */
export default function autoSessionName(pi: ExtensionAPI) {
  let config = { ...DEFAULT_CONFIG };
  let state: AutoNameState = { ...INITIAL_STATE };
  let sessionId: string | undefined;
  let inFlight: AbortController | undefined;
  let warned = false;

  pi.on('session_start', async (_event, ctx) => {
    sessionId = ctx.sessionManager.getSessionId();
    state = restoreState(ctx.sessionManager.getEntries());
    warned = false;
    const loaded = await loadConfig(CONFIG_PATH);
    config = loaded.config;
    if (loaded.problems.length > 0 && ctx.hasUI) {
      ctx.ui.notify(`auto-session-name: ${loaded.problems.join('; ')}. Using defaults for those settings.`, 'warning');
    }
  });

  pi.on('session_shutdown', () => {
    inFlight?.abort();
    inFlight = undefined;
    sessionId = undefined;
  });

  // First title: name the session from its opening prompt while the agent works on it.
  pi.on('before_agent_start', (event, ctx) => {
    if (pi.getSessionName() !== undefined || !canAutoName(ctx)) return;
    void retitle(ctx, { pendingPrompt: event.prompt });
  });

  // Later titles: every `retitleEvery` prompts the model either renames or answers KEEP.
  pi.on('agent_end', (_event, ctx) => {
    if (!canAutoName(ctx)) return;
    const prompts = countUserPrompts(ctx.sessionManager.getBranch());
    // A count below the last check means /tree moved to a shorter branch, so check that branch too.
    const due = prompts - state.checkedAtPrompt >= config.retitleEvery || prompts < state.checkedAtPrompt;
    if (due) void retitle(ctx, {});
  });

  pi.registerCommand('autoname', {
    description: 'Re-title this session now, or turn auto-naming on/off (usage: /autoname [on|off])',
    handler: async (args, ctx) => {
      const action = args.trim().toLowerCase();
      if (action === 'on' || action === 'off') {
        // "on" also adopts the current name, so an earlier manual /name stops blocking re-titles.
        state = action === 'off' ? { ...state, paused: true } : { ...state, paused: false, name: pi.getSessionName() };
        pi.appendEntry(STATE_TYPE, state);
        ctx.ui.notify(`Auto-naming turned ${action} for this session`, 'info');
        return;
      }
      if (action) {
        ctx.ui.notify('Usage: /autoname [on|off]', 'warning');
        return;
      }
      if (inFlight) {
        ctx.ui.notify('A title is already being generated', 'info');
        return;
      }
      // Failures are reported inside retitle, so only success needs a message here.
      if (await retitle(ctx, { force: true })) ctx.ui.notify(`Session name: ${pi.getSessionName() ?? '(none)'}`, 'info');
    },
  });

  /** Gate for the automatic triggers. /autoname bypasses it. */
  function canAutoName(ctx: ExtensionContext): boolean {
    // Print/JSON runs have no UI, and --no-session runs have no file to show in /resume.
    if (state.paused || !ctx.hasUI || !ctx.sessionManager.getSessionFile()) return false;
    const current = pi.getSessionName();
    return current === undefined || current === state.name;
  }

  /**
   * Ask for a title and apply it if the session is still ours when the answer
   * arrives. One request at a time: overlapping triggers are dropped, not queued.
   * Resolves true when the model answered, false when it failed or was skipped.
   */
  async function retitle(ctx: ExtensionContext, { pendingPrompt, force = false }: RetitleOptions): Promise<boolean> {
    if (inFlight) return false;
    const controller = new AbortController();
    inFlight = controller;
    const startedIn = sessionId;
    const branch = ctx.sessionManager.getBranch();
    const prompts = countUserPrompts(branch) + (pendingPrompt ? 1 : 0);
    const nameBefore = pi.getSessionName();

    let title: string | undefined;
    let failure: string | undefined;
    try {
      const excerpt = buildExcerpt(branch, pendingPrompt);
      // Omitting the current name on /autoname means the model cannot answer KEEP.
      const reply = await requestTitle(ctx.modelRegistry, config, excerpt, force ? undefined : nameBefore, controller.signal);
      if (reply && 'title' in reply) title = reply.title;
    } catch (error) {
      failure = error instanceof Error ? error.message : String(error);
      // Without the model, a clipped opening prompt still beats an unnamed session in /resume.
      if (nameBefore === undefined && pendingPrompt) title = fallbackTitle(pendingPrompt);
    } finally {
      if (inFlight === controller) inFlight = undefined;
    }

    // Drop the answer if the session was replaced or shut down, or renamed by someone else meanwhile.
    // session_shutdown aborts the controller on quit, reload, new, resume, and fork.
    if (controller.signal.aborted || sessionId !== startedIn) return false;
    try {
      if (!force && pi.getSessionName() !== nameBefore) return false;

      // Warn once per session for automatic runs, so a broken model does not nag every few prompts.
      if (failure && (force || !warned)) {
        warned = true;
        ctx.ui.notify(`auto-session-name: ${failure}`, 'warning');
      }
      if (title && title !== nameBefore) pi.setSessionName(title);
      // Failed checks also advance the counter, so an outage costs one call per `retitleEvery` prompts, not one per prompt.
      state = { ...state, name: pi.getSessionName(), checkedAtPrompt: prompts };
      pi.appendEntry(STATE_TYPE, state);
      return failure === undefined;
    } catch {
      // Automatic triggers call this as `void retitle()`, and Pi installs no unhandledRejection
      // handler. A failed session write must cost one title, not crash the whole process.
      return false;
    }
  }
}
