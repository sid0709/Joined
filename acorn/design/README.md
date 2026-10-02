# Acorn design language

Acorn UI follows Airbnb’s product language: a white canvas, near-black type, pill controls, rounded list cards, and a sticky primary action. Reference screens: [listing + Reserve bar](https://mobbin.com/screens/8a6b4476-52d7-4c85-965b-2a870b388eb3), [map listing card](https://mobbin.com/screens/24072f6f-71d3-47f1-92e3-3b63bf4b1b43), [search results](https://mobbin.com/screens/1f92134a-2b99-4027-ab7f-8f6ff087bdc6).

Tokens live in [`tokens.md`](tokens.md) and `extension/src/sidebar/athens-tokens.css`. Cursor policy: [`.cursor/rules/acorn-ui-design.mdc`](../.cursor/rules/acorn-ui-design.mdc).

## Pattern

The signed-in side panel is three chrome bands plus one content list:

1. **Identity row** — logo, product name, signed-in name, worker-count chip, Help, icon-only sign out.
2. **Segmented tabs** — Fill / Q&A / Custom. Pill track, selected chip on white.
3. **List of cards** — jobs (Fill) or remembered tabs (Custom). The card is the hit target.
4. **Footer** — Connection status (expand for API URL). Fill and Custom share a sticky row: Generate, Fill page, Recommend. Custom keeps Remember tab in the list chrome.

Do not add instructional copy, fetch/debug controls, or chevrons that duplicate “click the card.”

## Language

- **Canvas first.** White surfaces, hairline borders (`--athens-border`), no heavy chrome.
- **Hierarchy by type, not boxes.** Title is 14px/600 near-black, one line with ellipsis. Subtitle (Fill company / Custom host) is 12px gray on its own line. Résumé status is a third truncated line.
- **Cards, not rows with arrows.** Rounded 12px cards. Whole card opens or focuses the tab. Fill and Custom share one card: 32px company / tab icon with an 18px Acorn Face silhouette badge, title, subtitle, résumé status, trailing circular download, preview (eye), and check.
- **Pills for controls.** Tabs, Refresh, Fill, icon buttons use `--athens-radius-pill`.
- **One accent.** `--athens-brand` for the selected Fill or Custom card (solid fill, white type), connection dot, and primary CTA. Do not introduce a second accent.
- **Icon-only when the label is obvious.** Sign out is a door/arrow icon, not a “Sign out” pill. Help is a `?` next to it. The worker chip (mini rabbit + count) stays in the identity row so busy thinking/working tabs are visible at a glance.
- **Density in the shell, air in the list.** Collapse header and status. Give the job list the remaining height.
- **Sticky primary action.** Generate, Fill page, and Recommend stay at the bottom. Connection replaces Idle in the status strip.
- **Toasts for issues.** Sign-in, socket, and Fill failures are floating cards (icon + title + detail + dismiss). Never `throw` or `console.error` for expected operator failures — those show up as Chrome extension Errors.

## Notifications

Match Airbnb’s floating status card ([location error](https://mobbin.com/screens/664cb31b-101a-4602-ad26-178791b5f5e1), [success toast](https://mobbin.com/screens/d017c95a-0385-44e6-b0ba-49f12e9d03ec)):

- White card, `--athens-radius-lg`, `--athens-shadow-raised`, just above the Fill CTA.
- Left: 28px circle — `--athens-danger` + `!` (error), `--athens-success` + check (success), `--athens-brand` + `i` (info).
- Bold 14px title, 12px secondary detail, trailing `×`. Title and detail clamp to one line.
- Spring in (`--athens-notice-enter`), drain bar, then exit in under 0.5s (`--athens-notice-exit`) so the job list stays readable. Error toasts hold longer (~12s) so operators can read debug detail.
- Use `pushAcornNotice()` in the sidebar or `broadcastOperatorNotice()` from the service worker.

## Do / don’t

| Do                                                         | Don’t                                                    |
| ---------------------------------------------------------- | -------------------------------------------------------- |
| Logo + Acorn + name + workers + Help + sign out on one row | “Athens account” + “Signed in as” + Sign out pill        |
| Connection in the footer                                   | Idle / Ready occupying the footer                        |
| Click card to open                                         | `>` chevron next to the card                             |
| Circular eye (preview) plus check (mark applied)           | Duplicate navigation affordances                         |
| Tabs + list + Fill CTA                                     | Fetch DOM, “pick a Worker pool…”, “no job attached” copy |
