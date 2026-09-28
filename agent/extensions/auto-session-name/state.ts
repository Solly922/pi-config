import type { SessionEntry } from '@earendil-works/pi-coding-agent';

export const STATE_TYPE = 'auto-session-name';

/** Saved as a custom session entry so ownership and pause survive /resume and /reload. */
export type AutoNameState = {
  /**
   * The last name this extension applied. If the session's current name differs,
   * the user (via /name) or another extension (pi-subagents) renamed it, and
   * auto-naming leaves it alone.
   */
  name?: string;
  /** User-prompt count at the last title check. Spaces out re-titles. */
  checkedAtPrompt: number;
  /** Set by `/autoname off`. */
  paused: boolean;
};

export const INITIAL_STATE: AutoNameState = { checkedAtPrompt: 0, paused: false };

/**
 * Read the newest saved state from the whole session file, not just the active
 * branch: Pi stores the session name file-wide, so ownership has to match it.
 */
export function restoreState(entries: readonly SessionEntry[]): AutoNameState {
  for (let i = entries.length - 1; i >= 0; i--) {
    const entry = entries[i];
    if (entry.type !== 'custom' || entry.customType !== STATE_TYPE) continue;
    const data = (entry.data ?? {}) as Partial<Record<keyof AutoNameState, unknown>>;
    return {
      name: typeof data.name === 'string' ? data.name : undefined,
      checkedAtPrompt: typeof data.checkedAtPrompt === 'number' ? data.checkedAtPrompt : 0,
      paused: data.paused === true,
    };
  }
  return { ...INITIAL_STATE };
}
