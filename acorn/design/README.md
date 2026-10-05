# Acorn design language

Acorn's side panel is built from **`sid-ui`**, the same components and tokens as every other Joined app. It imports `sid-ui/styles/joined.css` and wraps in `JoinedProvider`, like `joined-frontend`. Acorn adds only what the design system has no equivalent for: the live Acorn Face, the logo-and-face mark on list rows, and the segmented generate progress. Tokens: [`tokens.md`](tokens.md). Cursor policy: [`.cursor/rules/acorn-ui-design.mdc`](../.cursor/rules/acorn-ui-design.mdc).

## Layout

A narrow panel that works like a small app:

1. **Header**: the live Acorn Face, "Acorn", and one line about the active Chrome tab (its job, its remembered page, or "No job on this tab"). A worker `Badge` appears only while something runs. On the right is the account `MoreMenu`, an `Avatar` whose dot is the socket connection, with Acorn Face guide, Settings, and Sign out.
2. **`PillNav`** under the header: **Jobs** (Fill), **Ask** (Q&A), **Tabs** (Custom). The pills are hash links (`#fill`, `#qa`, `#custom`). Counts show work in flight and remembered tabs.
3. **Now card** at the top of Jobs and Tabs: what the active tab is, its résumé status (`Badge`), any run in flight, and the actions that work on it. **Fill page** is the primary button; Generate and Recommend share the row under it. On an unremembered Custom tab the card offers **Remember this tab** instead.
4. **List**: compact rows (`Card`), grouped into "Ready to fill" and "Needs a résumé". The whole row opens or focuses the tab. Preview stays one click away; Download, Mark applied or Forget, Continue, Start over, and View JD sit in the row's ⋯ `MoreMenu`.
5. **Ask**: a chat thread (`ChatLayout`, `ChatMessage`, `ChatComposer`). Paste a question Fill left blank and copy the answer.

Overlays are design-system `Drawer`s: Settings (API URL, connection, version) and the Face guide open as sheets, and the résumé and JD previews open full height. Escape closes them and focus returns.

## Language

- **Reuse first.** Use a design-system component before writing markup or CSS. Don't restyle Joined components; if one doesn't fit, raise it in the sid-ui package.
- **One accent.** Joined blue (`--color-accent`) for primary actions, the selected row (`Card variant="blue"`), and the active pill. Status uses `Badge`: `green` ready, `neutral` waiting, `error` failed.
- **Hierarchy by type.** `Text` and its `type` / `weight` props. No all-caps labels, no raw font sizes.
- **Actions where they apply.** Actions on the current page live in the Now card. Actions on a row live in that row. No floating action bars, and no chevrons that duplicate "click the row".
- **Toasts for issues.** Sign-in, socket, and Fill failures are design-system toasts (`useToast`) through `pushAcornNotice()` in the sidebar or `broadcastOperatorNotice()` from the service worker. Errors hold about 12s. Never `throw` or `console.error` expected operator failures; those show up as Chrome extension Errors.

## Do / don't

| Do                                                              | Don't                                                    |
| --------------------------------------------------------------- | -------------------------------------------------------- |
| Design-system `Button`, `IconButton`, `Badge`, `Card`, `Drawer` | Hand-built buttons, pills, cards, or modals in Acorn CSS |
| Current-tab actions in the Now card                             | A sticky button bar detached from what it acts on        |
| One visible row action plus a ⋯ menu                            | Four icon buttons on every row                           |
| Account, settings, and sign-out in the avatar menu              | "Signed in as …" text, a Sign out pill, a footer strip   |
| Joined tokens (`--color-*`, `--spacing-*`, `--radius-*`)        | New hex values, px font sizes, or Acorn-only tokens      |
