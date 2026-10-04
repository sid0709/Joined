---
paths:
  - "packages/design-system/**/*.{ts,tsx,css}"
  - "joined-theme/**/*.{ts,tsx,css}"
---

# Theme shows the design system

`joined-theme` is the catalog for `@joined/design-system`. A change to a component, glyph, token, or visual treatment is not done until the theme shows the current look.

When you change `packages/design-system`:

1. Update the matching demo in `joined-theme/components/demos/`.
2. Add a new public component to `joined-theme/lib/catalog.ts` and register its demo in `joined-theme/components/demos/load.ts`.
3. Rewrite demo and catalog copy that still describes the old treatment (radius, sizes, icon weight).

Glyphs have their own page (`glyph`). A new or redrawn icon is shown there in the same change.

## Tokens

`packages/design-system/src/styles/tokens.css` is the only place a color, spacing, type, radius, or shadow value is defined. Components and demos use `var(--color-*)`, `var(--spacing-*)`, `var(--radius-*)`, and `var(--font-*)`.

A new visual value is a named token, then a theme demo. No hex, rgb, or raw font size in a component or demo file.

```tsx
// ❌ design system only
// packages/design-system/src/components/Glyph.tsx gained `sun`

// ✅ same change also updates the theme
// joined-theme/components/demos/glyph.tsx renders <Glyph name="sun" />
```
