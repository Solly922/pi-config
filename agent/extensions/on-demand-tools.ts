import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import { Type } from 'typebox';

const GROUPS = {
  web: ['web_search', 'source_check', 'fetch_content', 'get_search_content'],
  browser: ['agent_browser'],
} as const;
const LAZY_TOOLS = new Set<string>(Object.values(GROUPS).flat());
const STATE_TYPE = 'on-demand-tools';

export default function onDemandTools(pi: ExtensionAPI) {
  const enabled = new Set<keyof typeof GROUPS>();

  pi.on('session_start', (_event, ctx) => {
    enabled.clear();
    // Restore only this branch's choices when resuming, forking, or reloading.
    for (const entry of ctx.sessionManager.getBranch()) {
      if (entry.type !== 'custom' || entry.customType !== STATE_TYPE) continue;
      const groups = (entry.data as { groups?: unknown } | undefined)?.groups;
      if (!Array.isArray(groups)) continue;
      for (const group of groups) {
        if (group === 'web' || group === 'browser') enabled.add(group);
      }
    }

    const restored = new Set<string>([...enabled].flatMap((group) => [...GROUPS[group]]));
    const active = pi.getActiveTools().filter((name) => !LAZY_TOOLS.has(name) || restored.has(name));
    const registered = new Set(pi.getAllTools().map((tool) => tool.name));
    for (const name of restored) {
      if (registered.has(name)) active.push(name);
    }
    pi.setActiveTools([...new Set([...active, 'enable_tools'])]);
  });

  pi.registerTool({
    name: 'enable_tools',
    label: 'Enable web or browser tools',
    description:
      'Enable optional tools for this session. Use web for internet search, fetching URLs, or source verification; browser for interactive websites, screenshots, clicks, forms, or browser testing. Enable the needed group before using it. No user setup is needed.',
    parameters: Type.Object({
      group: Type.Union([Type.Literal('web'), Type.Literal('browser')]),
    }),
    async execute(_toolCallId, params) {
      // Validate here too so programmatic callers cannot select arbitrary tools.
      if (params.group !== 'web' && params.group !== 'browser') {
        return {
          content: [{ type: 'text', text: 'Unknown group. Choose web or browser.' }],
          details: {},
          isError: true,
        };
      }
      const registered = new Set(pi.getAllTools().map((tool) => tool.name));
      const requested = GROUPS[params.group];
      const available = requested.filter((name) => registered.has(name));
      const missing = requested.filter((name) => !registered.has(name));
      if (available.length === 0) {
        return {
          content: [{ type: 'text', text: `The ${params.group} tools are not installed or loaded in this session.` }],
          details: { missing },
          isError: true,
        };
      }

      const active = pi.getActiveTools();
      const added = available.filter((name) => !active.includes(name));
      // Additive activation lets Pi use deferred schemas where supported.
      if (added.length > 0) pi.setActiveTools([...new Set([...active, ...added])]);
      if (!enabled.has(params.group)) {
        enabled.add(params.group);
        pi.appendEntry(STATE_TYPE, { groups: [...enabled] });
      }
      const status = added.length > 0 ? `Enabled: ${added.join(', ')}.` : 'These tools are already enabled.';
      return {
        content: [{ type: 'text', text: `${status}${missing.length ? ` Unavailable: ${missing.join(', ')}.` : ''}` }],
        details: { group: params.group, added, missing },
      };
    },
  });
}
