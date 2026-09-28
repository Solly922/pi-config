---
name: "verify-spatial-plan-diagrams"
description: "Verify SVG game-map plans against stated routes, spawn fairness and mobile readability."
version: 1
created: "2026-09-14"
updated: "2026-09-14"
---
## When to Use
When an HTML plan includes a top-down map with obstacles, spawn positions and suggested movement routes.

## Procedure
1. List the map's claimed invariants, such as centered objective, equal-distance starts, unobstructed approaches and routes avoiding obstacles.
2. Inspect actual SVG coordinates rather than trusting captions. Check spawn distances from the objective and whether drawn paths cross obstacle rectangles or circles.
3. For curved paths, inspect rendered geometry or sample getPointAtLength along the SVG path against obstacle bounds. Include clearance for the drawn player size.
4. Review labels for overlap with paths, obstacle edges, objective markers and spawn numbers.
5. Inspect desktop and 390px views. Measure rendered SVG width against its viewBox: page overflow checks alone do not prove small labels are readable.
6. Use keyboard-focusable local horizontal scrolling when preserving readable diagram scale on phones. Ensure the diagram fits desktop without unnecessary clipping.
7. Recheck the final artifact after corrections, then publish only after removing sensitive information and verifying it is self-contained.

## Pitfalls
- A caption saying 'center' can hide an objective drawn on a player's start instead.
- An illustrative shortcut can accidentally pass through a stall or wall.
- Shrinking a 920-unit SVG to 560 CSS pixels turns 11px labels into roughly 7px text, despite no page overflow.

## Verification
1. Objective and starts satisfy the stated geometry, within rounding tolerance.
2. Routes remain in walkable space and text stays legible.
3. Desktop and mobile pages fit their viewports; any diagram scrolling is local, discoverable and keyboard-accessible.