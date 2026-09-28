---
name: "verify-local-html-artifact"
description: "Verify a self-contained local HTML artifact with structural checks and browser QA"
version: 2
created: "2026-08-21"
updated: "2026-09-22"
---
## When to Use
Use after creating or revising a standalone HTML plan, report, diagram, or other local browser artifact.

## Procedure
1. Run a small Python HTMLParser check for balanced tags, unique IDs, valid internal anchors, required doctype and viewport metadata, and remote resource references.
2. Serve the containing directory on an unused loopback port with a detached `python3 -m http.server`; browser tooling blocks content inspection on local `file://` pages.
3. Open the artifact with agent_browser QA and check important text, console errors, page errors, network failures, and a desktop screenshot.
4. Set a 375px viewport, reload the page, and compare `document.documentElement.scrollWidth` with `clientWidth`; fix any page-wide overflow while preserving intentional scroll containers.
5. Capture a mobile screenshot, verify responsive substitutions and focusable overflow regions, then stop the temporary server and remove inspection-only artifacts.

## Pitfalls
- Do not reuse a guessed port; another process may return a misleading 404.
- A child can overflow inside an intentional table or code scroller without causing page-wide overflow. Check document width separately.
- CSS grid items often need min-width: 0 or minmax(0, 1fr) before scroll containers can shrink.
- If agent_browser QA reports an unsupported agent-browser version, use an existing Playwright installation with an installed browser (for example, project playwright + /usr/bin/google-chrome), checking console/page/network errors, 320px/375px document width, and screenshots.
- Postplan upload rejects every <link> tag, including a data: favicon. Omit it; a local favicon 404 is benign when the document has no other failed resources.
- Do not claim a screenshot exists unless agent_browser or Playwright reports a successful artifact write.
## Verification
1. The structural parser exits successfully.
2. Browser QA reports expected text with no console or page errors.
3. At 375px, document scroll width equals viewport width.
4. The final HTML contains no remote resources unless the brief explicitly allows them.