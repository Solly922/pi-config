---
name: frontend-design
description: Create distinctive, production-grade frontend pages and visual artifacts. Use for new pages, landing pages, marketing surfaces, posters, presentations, or explicitly expressive redesigns.
license: MIT
metadata:
  origin: ECC
  adapted-for: pi-0.80.6
---

# Frontend Design

Use this skill for expressive visual work. For restrained application dashboards and internal product UI, apply `uncodexify` as the primary visual constraint.

## Direction Before Code

Establish:

- Purpose and audience.
- Existing brand or design-system constraints.
- One clear visual direction and one memorable device.
- Accessibility, performance, framework, and asset constraints.

Preserve an established product language unless the user requested a redesign.

## Craft

- Build strong hierarchy through typography, scale, rhythm, and composition.
- Use a cohesive palette with tokens rather than scattered literal values.
- Prefer deliberate asymmetry, texture, geometry, or restraint over generic card grids.
- Add only a few meaningful transitions. Respect `prefers-reduced-motion`.
- Use native CSS and existing dependencies before adding packages.
- Avoid interchangeable startup layouts, purple gradient defaults, decorative metric cards, and unexplained glass effects.

## Production Requirements

- Semantic structure and keyboard operation.
- Visible focus, readable contrast, and useful labels.
- Responsive layouts that work on narrow mobile and desktop viewports.
- Stable loading, empty, error, and disabled states where applicable.
- No horizontal overflow or interaction hidden behind hover alone.

Verify the rendered result with available browser tooling. Do not claim visual verification if no browser was used.
