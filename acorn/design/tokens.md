# Acorn design tokens

Acorn has no tokens of its own. It uses the Joined design system's tokens, which `sid-ui/styles/joined.css` defines. Use a design-system component first; reach for a token only in Acorn's own layout CSS (`extension/src/sidebar/styles/`).

## What Acorn's CSS uses

| Need                         | Token                                                                     |
| ---------------------------- | ------------------------------------------------------------------------- |
| Page / panel background      | `--color-background-body` / `--color-background-surface`                  |
| Muted fill (logo fallback)   | `--color-background-muted`                                                |
| Text                         | `--color-text-primary`, `--color-text-secondary`, `--color-text-disabled` |
| Accent (running step, focus) | `--color-accent`                                                          |
| Error (failed step or row)   | `--color-error`                                                           |
| Hairlines                    | `--color-border`, `--color-border-emphasized`                             |
| Space                        | `--spacing-0-5` … `--spacing-8` (4px grid)                                |
| Radius                       | `--radius-inner` (8) · `--radius-element` (12) · `--radius-full`          |
| Type                         | `--font-family-body`, `--font-family-code`, `--font-size-sm`              |
| Motion                       | `--ease-standard`                                                         |

## Acorn-local values

A few sizes have no Joined token. They stay as named custom properties next to the rule that uses them, never as bare numbers:

- `--acorn-face-brand-px`: header Acorn Face size (set from `ACORN_FACE_BRAND_PX`)
- `--acorn-mark-size`: row logo mark
- `--acorn-marking-opacity`: a row fading out while it is marked applied
- `--acorn-gen-gap`, `--acorn-gen-height`: generate progress segments
- `--acorn-plan-max-height`: plan step list
- `--acorn-preview-min-height`: résumé preview frame

Don't add hex values, px font sizes, or `--acorn-*` color tokens. A missing color or size belongs in the sid-ui package.
