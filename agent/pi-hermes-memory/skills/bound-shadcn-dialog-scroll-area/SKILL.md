---
name: "bound-shadcn-dialog-scroll-area"
description: "Keep ShadCN dialog headers and actions fixed while its body scrolls within the viewport"
version: 1
created: "2026-09-14"
updated: "2026-09-14"
---
## When to Use
Use when replacing a native scrolling dialog with Radix/ShadCN ScrollArea, especially when percentage viewport heights do not constrain content.

## Procedure
1. Reuse installed Dialog and ScrollArea primitives. Make DialogContent a bounded-height flex column with overflow hidden; keep header and action footer outside the scroll body.
2. Give the form/content column min-height:0 and flex:1. If the ScrollArea viewport's percentage height remains indefinite, put its root inside a grid min-height:0 flex:1 wrapper so it receives a definite available height.
3. Put comparison content and validation fields inside ScrollArea. Keep footer actions associated with the same form, and preserve focus on open, validation error, and close.
4. For a growing textarea, verify it expands inside the parent scroller rather than acquiring a second scrollbar in the supported browser.
5. Use browser tests on short viewports to compare actual scrollHeight/clientHeight, change scrollTop, and assert action buttons remain in the viewport. Inspect screenshots, not just the presence of ScrollArea markup.

## Pitfalls
- A max-height on DialogContent and flex:1 on ScrollArea alone may leave the Radix viewport's height indefinite, allowing content to be clipped instead of scrolled.
- A fixed header and footer can consume most of a very short viewport. Test the remaining content height and consider a different layout at that boundary.
- ScrollArea hides scrollbars when idle by default; test actual scroll metrics instead of requiring a permanently visible thumb.

## Verification
1. At a short mobile viewport, ScrollArea scrollHeight exceeds clientHeight and scrolling changes scrollTop.
2. Header/contact info and decision actions remain reachable, and focusing invalid fields scrolls them into view.
3. No document-level horizontal overflow or unintended nested textarea scrollbar occurs in the supported browser.