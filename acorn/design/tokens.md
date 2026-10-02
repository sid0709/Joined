# Acorn design tokens

Source of truth: `extension/src/sidebar/athens-tokens.css` (`:root`). Import those variables. Do not add new hex values in components.

## Color

| Token                     | Value                | Use                                                |
| ------------------------- | -------------------- | -------------------------------------------------- |
| `--athens-canvas`         | `#ffffff`            | App background, cards, selected tab chip           |
| `--athens-surface-subtle` | `#f7f7f7`            | Tab track, logo fallback, muted fills              |
| `--athens-text`           | `#0d0d0d`            | Titles, Acorn wordmark, primary copy               |
| `--athens-text-secondary` | `#5d5d5d`            | Display name, job meta                             |
| `--athens-text-muted`     | `#8e8e8e`            | Footer status, placeholders, check icon            |
| `--athens-border`         | `#dedede`            | Card and hairline borders                          |
| `--athens-border-strong`  | `#c7c7c7`            | Hover border                                       |
| `--athens-hover`          | `rgb(13 13 13 / 6%)` | Card / icon hover                                  |
| `--athens-brand`          | `#1f6feb`            | Fill CTA, selected Fill/Custom card, connection on |
| `--athens-brand-strong`   | `#1556b8`            | Fill hover / in-flight, selected card hover        |
| `--athens-brand-subtle`   | `#eef5ff`            | Icon hover fill                                    |
| `--athens-brand-border`   | `#c9ddfb`            | Icon hover outline                                 |
| `--athens-danger`         | `#c0362c`            | Errors, failed steps, error toast icon             |
| `--athens-success`        | `#0e8a3a`            | Success toast icon                                 |
| `--athens-focus`          | `#1f6feb`            | Focus ring                                         |

Airbnb’s product pink is not Acorn’s brand. Keep `--athens-brand` as the single accent.

## Space

`--athens-space-1` 4px · `--athens-space-2` 8px · `--athens-space-3` 12px · `--athens-space-4` 16px · `--athens-space-5` 20px · `--athens-space-6` 24px · `--athens-space-8` 32px

Shell padding is 12–16px. Card padding is 8–12px. List gap is 8px.

## Radius

| Token                  | Value | Use                                            |
| ---------------------- | ----- | ---------------------------------------------- |
| `--athens-radius-sm`   | 8px   | Logo, small controls                           |
| `--athens-radius-md`   | 12px  | Job cards, inputs                              |
| `--athens-radius-lg`   | 16px  | Overlays                                       |
| `--athens-radius-pill` | 999px | Tabs, Fill, Refresh, circular check / sign-out |

## Type

`--font-athens`: `-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`

| Token                   | Size | Use                            |
| ----------------------- | ---- | ------------------------------ |
| `--athens-font-size-xs` | 12px | Meta, tabs, footer             |
| `--athens-font-size-sm` | 14px | Job title, body                |
| `--athens-font-size-md` | 16px | Acorn wordmark, Fill label     |
| `--athens-font-size-lg` | 20px | Rare; prefer md in the sidebar |

Titles: 600, letter-spacing `-0.01em` to `-0.02em`. No all-caps section labels.

## Elevation and motion

`--athens-shadow-control`: `0 1px 2px rgb(13 13 13 / 5%)` — selected tab, Fill.
`--athens-shadow-raised`: overlays only.
`--athens-transition-fast`: `150ms ease` — hover/color only.
`--athens-notice-enter`: `200ms` spring — toast in.
`--athens-notice-exit`: `180ms` — toast out (under 0.5s so the list stays readable).

## Components

- **Identity row:** 28px logo, 16px Acorn, truncated name, worker-count chip (18px acorn + number), 32px Help, 32px sign out.
- **List card (Fill and Custom):** Shared `SidebarListCard`. 32px company logo (Fill) or tab favicon (Custom) with an 18px Acorn Face silhouette badge hanging on the bottom-right corner (no plate). Both stay on screen; the acorn follows that row’s mode. 1-line title ellipsis, subtitle on its own line (company / host), résumé status on a third truncated line, trailing circular 32px download, preview (eye), and check. Download and eye are disabled until a résumé exists. Fill check marks applied; Custom check forgets the tab. Selected: `--athens-brand` fill, `--athens-canvas` type, white-outline controls. No location, no chevron.
- **Connection footer:** 8px status dot + “Connection” + state. Expand for API URL.
- **Fill CTA:** three sticky pills above the footer — Generate, Fill page (primary), Recommend. Custom disables them until Remember tab.
- **Notice toast:** floating card just above Fill. Spring in, drain bar, exit under 0.5s. Errors hold ~12s and wrap detail so Fill/DOM failures are readable. Error / success / info via `pushAcornNotice`. Do not throw for sign-in or socket failures.
