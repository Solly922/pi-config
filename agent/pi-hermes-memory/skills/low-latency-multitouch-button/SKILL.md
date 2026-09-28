---
name: "low-latency-multitouch-button"
description: "Implement and verify immediate pointer-down controls that support multitouch without breaking keyboard or assistive activation"
version: 2
created: "2026-08-28"
updated: "2026-09-11"
---
## When to Use
Use for latency-sensitive web controls such as game buzzers, pads, or triggers that must fire on contact rather than pointer release and must work while other fingers are already touching the screen.

## Procedure
1. Use `pointerdown` rather than `click` for touch, pen, and primary-mouse activation. Do not filter touch events by `isPrimary`, because that rejects additional fingers.
2. Keep the native button `click` path only for activations where `MouseEvent.detail === 0`; this preserves keyboard and common assistive-technology activation while ignoring compatibility clicks that follow pointer input.
3. Add a synchronous ref guard before any React state update or network request. State alone can remain stale across same-render pointer events. Clear the guard only when the failing request still owns it, and reset it when the session ends.
4. Do not apply `touch-action: none` merely to get pointer-down timing. Pointer-down arrives without it, and disabling touch actions can block panning or pinch zoom over a large control.
5. Keep backend submission idempotent even with the client guard.

## Pitfalls
- A disabled state set through React may not prevent two pointer events delivered before rerender.
- An old round's rejected request must not clear a newer round's guard or loading state.
- Synthetic accessibility clicks often have `detail === 0`; removing click entirely can break keyboard or assistive input.
- A single successful backend record does not prove one client request when the backend is idempotent.

## Verification
1. In a real touch-enabled browser session, hold one finger outside the control, then place another finger on it. Assert the visible and server result before releasing either finger.
2. Place two touch points on the control in one interaction and instrument outgoing transport calls. Assert exactly one submission.
3. Verify keyboard activation still works and ordinary pointer compatibility clicks do not submit twice.
4. For continuous joystick plus button controls, hold both, lift only the button finger, and verify movement continues while the button releases. Then cancel the remaining touch and verify neutral state.
5. When driving Chromium CDP Input.dispatchTouchEvent, touchEnd touchPoints identifies the fingers being lifted, not the fingers remaining on screen. Record pointer IDs if a multi-finger assertion fails before changing application code.
6. Check browser errors, lint, type/build checks, and reduced-motion/loading behavior.