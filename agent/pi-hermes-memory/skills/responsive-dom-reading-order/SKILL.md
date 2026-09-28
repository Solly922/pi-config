---
name: "responsive-dom-reading-order"
description: "Keep responsive visual order aligned with semantic and assistive-technology reading order"
version: 1
created: "2026-08-28"
updated: "2026-08-28"
---
## When to Use
Use when a responsive layout changes the visible order of navigation, hero content, forms, or other meaningful sections across breakpoints.

## Procedure
1. Choose the narrow/mobile reading order as the DOM order because that layout is usually linear and exposes ordering mistakes most clearly.
2. Use CSS Grid placement or breakpoint-specific `order` values only to reposition content on wider screens.
3. Verify the DOM sequence directly, then inspect mobile and desktop screenshots to confirm the intended visual placement.
4. Keyboard through interactive elements and confirm focus order follows the visible mobile order.

## Pitfalls
- CSS `order` changes appearance but not screen-reader or keyboard reading order.
- A desktop-first JSX order can look correct in a two-column grid while becoming semantically backwards when stacked on mobile.
- Do not use positive `tabindex` values to repair ordering; fix the DOM structure.

## Verification
1. Meaningful sections appear in the intended sequence in the DOM.
2. Mobile visual order matches DOM and focus order.
3. Desktop placement remains correct through CSS layout rules.
4. No horizontal overflow or focus-target regression appears at either breakpoint.