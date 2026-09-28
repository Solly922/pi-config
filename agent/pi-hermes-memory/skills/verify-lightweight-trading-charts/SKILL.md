---
name: "verify-lightweight-trading-charts"
description: "Verify Lightweight Charts in a read-only React trading dashboard backed by decimal financial data."
version: 1
created: "2026-09-21"
updated: "2026-09-21"
---
## When to Use
Adding TradingView Lightweight Charts to React interfaces that show trades, price history and portfolio observations.

## Procedure
1. Keep decimal amounts as strings across the API. Accept Python Decimal exponent forms such as 0E-8 and 1E-8; convert to numbers only for chart geometry.
2. Use a separate execution series at actual execution timestamps/prices. Attach trade markers to it rather than requiring execution timestamps to equal candle timestamps.
3. Scope table/th/td application CSS to application table containers; Lightweight Charts uses internal tables for layout.
4. Preserve chart visible range and selected decisions across polling; include initial pre-cycle wealth so entry costs are visible.
5. Test with synthetic fills between candle timestamps. Click actual rendered markers and confirm details; test keyboard-equivalent journal buttons and mobile overflow.
6. Serve bundled attribution/license files through the production backend, not only the Vite dev server.

## Pitfalls
- Global table padding can halve the canvas width without any console error.
- Candle-only marker matching hides almost every real execution.
- Vite proxy must changeOrigin when backend Host checks expect the backend port.
- A freshly loaded API response can contain old market observations; label both clocks.

## Verification
1. Types/build and Playwright pass, including marker click and exponent decimal fixtures.
2. Desktop screenshot shows correctly sized canvases; mobile has no document overflow.
3. Production attribution links and dev proxy return HTTP200.