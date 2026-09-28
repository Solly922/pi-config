---
name: "scroll-craft-in-nextjs"
description: "Embed the vendored scroll-craft engine in a Next.js App Router page (React 19, Tailwind v4) without leaking its global CSS or rAF loop into the rest of the SPA, and verify it."
version: 1
created: "2026-09-27"
updated: "2026-09-27"
---
## When to Use
A scroll-craft build must live inside an existing Next.js/React app route (real auth, data or controls) instead of a standalone HTML page. It does not apply to static scroll-craft builds served on their own.

## Procedure
1. Copy engine/scrollcraft.js and scrollcraft.css byte-for-byte into public/scrollcraft/ and add them to eslint globalIgnores and .prettierignore. Verify with cmp before committing.
2. Create public/scrollcraft/<page>.css containing only `@import url("./scrollcraft.css") layer(scrollcraft);`, and add `@layer scrollcraft;` as the first rule of app/globals.css (before `@import "tailwindcss"`). The engine is then the lowest cascade layer, so its unlayered resets (button font/color inherit, body type, :focus-visible) cannot beat Tailwind utilities.
3. Render `<link rel="stylesheet" href="/scrollcraft/<page>.css" />` as the first child of the page root with NO precedence prop. React 19 renders it in place (SSR, no flash) and removes it on unmount. Add an eslint-disable for @next/next/no-css-tags.
4. Mount in a hook: load the script once (a cached promise that appends a <script>), call ScrollCraft.mount(root) after load if still mounted, and ResizeObserver(root) calling api.layout() in a rAF. On unmount, empty api.acts/api.worlds/api.clips (length = 0), splice the api out of ScrollCraft.instances, and remove html.sc-ready when none are left. The engine has no destroy(). Do not use drift, tilt, magnet or spotlight unless the teardown also covers their private state.
5. Every data-sc-* element must render on the first pass and keep its DOM identity. Never put React style opacity/transform/clip-path on engine-driven nodes. Keep data-sc-in stagger children as stable wrappers around anything keyed or remounted.
6. Drive continuous motion in CSS from var(--sc-p). For discrete React state, read el.style.getPropertyValue('--sc-p') after a double rAF on scroll (the engine may read after you), plus a custom refresh event fired after mount and layout. Select a primitive (string key) so React only re-renders when the derived state changes.
7. Add a <noscript><style> that forces [data-sc-cue],[data-sc-in],[data-sc-stagger]>* to opacity 1, plus a data-engine=failed root fallback for script load errors.
8. When fetching data server-side for the first paint, wrap fetchQuery/fetch in try/catch but call unstable_rethrow(error) first (next/navigation), or you swallow Next's dynamic-rendering signal.

## Pitfalls
- CSS modules are unlayered and beat Tailwind v4 utilities regardless of specificity. Never set one property from both (a module display:flex defeats `hidden sm:flex`).
- shoot.mjs contrast parses only rgb(). oklch()/lab() tokens give false failures, so measure separately with canvas-converted colours.
- Screenshot-based contrast sampling must disable transitions (shadcn buttons use transition-all), sample glyph Range rects rather than element boxes, and skip text under fixed chrome.
- A reduced-motion pinned hero set to height:auto jumps its progress to 1 on the first pixel of scroll. Force its hero cue to opacity 1 !important under reduced motion.
- Pinned acts render inside the engine's .sc-stage (sticky, 100svh, overflow clip). Never set position on the stage. Pad stage content for fixed chrome with a token (for example --stage-top) that also covers any extra phone chrome row.
- Scripted multi-file edits can silently miss after a formatter reflows code. Grep for every intended change afterwards.

## Verification
1. Run the harness (shoot.mjs) at desktop, phone and --reduced-motion against the running app, and read sheet.png.
2. Navigate client-side away from the page and assert: no scrollcraft <link>, no html.sc-ready, ScrollCraft.instances.length === 0, and body font-size, line-height and background equal to a fresh load of the destination.
3. Load with JavaScript disabled and assert the key copy computes to opacity 1.
4. Run next build (check for swallowed DYNAMIC_SERVER_USAGE logs), then next start, and confirm the public/scrollcraft files return 200 and the page mounts one instance with no console errors.