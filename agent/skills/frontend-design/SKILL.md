---
name: frontend-design
description: Create distinctive, production-grade frontend pages and visual artifacts. Use for landing pages, marketing surfaces, presentations, or explicitly expressive redesigns; not routine product UI.
license: MIT
metadata:
  origin: ECC
  adapted-for: pi-0.80.6
---

# Frontend Design

Use this skill for expressive visual work. For dashboards, settings, forms, tables, and internal tools, use `uncodexify` as the primary constraint.

Before coding, establish purpose, audience, content, brand or design-system constraints, visual direction, accessibility, performance, framework, and asset limits. Preserve established product language unless a redesign was requested.

## Craft

- Build hierarchy through typography, scale, rhythm, and composition.
- Use a cohesive tokenized palette.
- Prefer deliberate composition over generic card grids and interchangeable startup layouts.
- Add only meaningful transitions and respect `prefers-reduced-motion`.
- Avoid decorative metrics, default purple gradients, and unexplained glass effects.

## Production Requirements

Preserve semantic structure, keyboard operation, visible focus, readable contrast, useful labels, responsive layouts, and stable loading, empty, error, and disabled states where relevant. Avoid horizontal overflow and hover-only interaction.

Verify the rendered result with available browser tooling. If none is available, report visual verification as not performed.
