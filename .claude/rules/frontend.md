---
paths:
  - "**/*.css"
  - "**/*.scss"
  - "**/*.sass"
  - "**/*.less"
  - "resources/views/**"
  - "**/components/**"
  - "**/layouts/**"
  - "**/pages/**"
  - "**/*.blade.php"
  - "**/*.svelte"
  - "**/styles/**"
---

# Frontend Rules

## Design Tokens
- Define spacing, color, typography, and elevation as tokens — never hardcode values in components
- Spacing: use 4/8px rhythm (4, 8, 12, 16, 24, 32, 48, 64)
- Colors: define semantic tokens (primary, secondary, surface, error) — not raw hex values
- Typography: define a type scale (xs, sm, base, lg, xl, 2xl) with consistent line heights
- Elevation/shadows: define levels (none, sm, md, lg, xl) — consistent depth language

## Accessibility (non-negotiable)
- Every interactive element must be keyboard-accessible (`Tab`, `Enter`, `Escape`)
- Every image needs `alt` text — decorative images get `alt=""`
- Form inputs must have associated `<label>` elements — no placeholder-only inputs
- Color contrast: minimum 4.5:1 for text, 3:1 for large text and UI components
- Focus indicators must be visible — never `outline: none` without a replacement
- Use semantic HTML: `<button>` for actions, `<a>` for navigation — never `<div onclick>`
- `aria-label` on icon-only buttons
- Respect `prefers-reduced-motion` — disable animations for users who request it
- Respect `prefers-color-scheme` — support system theme preference when dark mode exists

## Performance
- Images: lazy-load below the fold, use `srcset` for responsive sizes, prefer WebP/AVIF
- Fonts: `font-display: swap` — never block rendering on font load
- Bundle: code-split routes — no single bundle over 200KB gzipped
- CSS: purge unused styles in production builds
- Avoid layout shifts: set explicit `width`/`height` on images and embeds
