---
name: "headless-chromium-ui-qa-fallback"
description: "Visually QA local web UI when agent-browser and Playwright MCP are unavailable"
version: 10
created: "2026-08-27"
updated: "2026-09-25"
---
## When to Use
Use only after the preferred agent_browser flow and configured Playwright MCP are unavailable, and a local Chromium binary exists.

## Procedure
1. Start the local application on an unused loopback port and verify it responds with curl.
2. Capture each critical route with `chromium --headless --disable-gpu --no-sandbox --hide-scrollbars` at one desktop viewport and one mobile viewport.
3. If interactions must be verified and no browser driver is installed, launch Chromium with `--remote-debugging-port=<port>` and a fresh `--user-data-dir`, then use Node's built-in `fetch` and `WebSocket` to call the Chrome DevTools Protocol. Enable `Runtime`, `Log`, and `Page`; drive DOM events, open targets, and collect exceptions.
4. Use separate Chromium processes, debug ports, and user-data directories for simultaneous same-origin users that require independent cookies or localStorage. Separate targets in one profile share storage.
5. For React-controlled inputs over CDP, use the native `HTMLInputElement.prototype.value` setter and dispatch a bubbling `input` event before submitting the form.
6. Assert computed styles for visually critical controls, not only text presence. A global unlayered CSS rule can silently override utility classes even when the expected class is present.
7. Capture state-transition screenshots as well as static pages. Check scroll position after a tall form changes into a shorter result or game state; browser scroll anchoring can leave headers offscreen.
8. If ImageMagick is available, combine screenshots into desktop and mobile contact sheets with `montage` so layouts can be compared in one read.
9. Inspect screenshots for missing first-paint content, clipping, overflow, fixed-navigation overlap, contrast, and responsive hierarchy.
10. After any visual or interaction fix, rerun the affected flow and the project lint/build checks.
11. Close CDP WebSockets and stop Chromium processes. Stop only servers started by the QA run; leave pre-existing user development servers alone. Keep screenshots outside the repository unless the user requested artifacts.
## Pitfalls
- Do not treat a successful screenshot command as proof that client-side interactions work.
- Initial opacity animations can produce blank screenshots and poor no-JavaScript first paint; prefer content-visible motion.
- Development overlays can appear in screenshots; distinguish them from product UI.
- Separate CDP targets share localStorage when they use the same Chromium profile; use separate processes/profiles for independent player sessions.
- Programmatic `element.click()` is not a trusted user activation. Browser features such as vibration may be blocked even though the click handler runs.
- `innerText` reflects CSS `text-transform`; use `textContent` or normalize case when assertions should match source text rather than rendered capitalization.
- Headless Chromium may log blocked `beforeunload` prompts or Google GCM registration failures during synthetic navigation. Filter only these exact browser-service messages after confirming application logs are clean.
- After terminating Chromium, wait for the child process to exit before deleting its profile directory. Chromium helpers can still race cleanup; use `rmSync(profile, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 })` or equivalent when `ENOTEMPTY` occurs.
- When a route swaps from a tall form to a shorter interactive state, browser scroll anchoring can preserve an inappropriate offset; inspect the top edge of state screenshots.
- An expected utility class in the DOM is not proof that it wins the cascade. Check computed font sizes, colors, and dimensions for critical controls.
- A mounted animation element is not proof that it animates. Assert its computed geometry or transform after the expected duration and verify the reduced-motion final state separately.
- CSS Grid may use safe alignment for an oversized animated item and place it at the start edge rather than the visual center. For a center-out circle, position it at `left: 50%; top: 50%` and include `translate(-50%, -50%)` in every animation keyframe.
- Do not add Chromium or screenshot dependencies to the project solely for fallback QA.
- CDP `Input.dispatchKeyEvent` with key/code/Windows key code alone may deliver Enter keydown to a native button without firing click. Supply `text: '\r'`, `unmodifiedText: '\r'`, and `nativeVirtualKeyCode: 13`, then assert a detail=0 click.
- `Page.reload` can return while the old document is still visible; wait for the new navigation before focusing and sending key events.
- A temporary Vite fixture outside Tailwind's scan root can render without utility classes. Use the project's compiled CSS or add explicit `@source`, and assert the target's computed geometry before driving taps.
## Verification
1. Every critical route returns the expected HTTP status.
2. Desktop and mobile screenshots exist with the requested dimensions.
3. Critical interactive flows assert visible end states and cross-tab realtime updates where applicable.
4. The CDP script records no `Runtime.exceptionThrown` or error-level `Log.entryAdded` events.
5. The final screenshot pass reports no Chromium ERROR or FATAL output after filtering known external browser-service noise separately.
6. Project lint, type/build, domain-specific checks, and diff checks pass after fixes.
7. QA debug ports, Chromium processes, and servers started by the QA run are stopped. Pre-existing user development servers remain running unless the user asked to stop them.