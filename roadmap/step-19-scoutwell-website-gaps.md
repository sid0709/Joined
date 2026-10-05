# Step 19: Scout website gaps

- **Week:** W2
- **Status:** Done
- **Owner:** Leo (lane: Next.js frontends, `sid-ui`, `packages/google-signin`)
- **Target branch:** `stage-roadmap-w34` for any follow-up (originally merged into the retired `stage-roadmap`)
- **PR title:** `feat(scoutwell-frontend): close scout website launch gaps (roadmap step-19)` (every commit must follow commitlint `type(scope): subject` or CI fails)
- **Merged PR:** [#83](https://github.com/sid0709/Joined/pull/83) (`ea6182c`)
- **Starts after: nothing, can start now.** Work only in `scoutwell-frontend`, so it cannot conflict with Leo's step-04 or step-10 in `joined-frontend`.

## Goal

The Scout website has every page a new scout needs at launch: what Scout is, how pay works, how to install the extension, and a clean sign-in path from the extension ("You can close this tab and return to the extension").

## Context and dependencies

`scoutwell-frontend` already has marketing and auth shells, session cookie `scoutwell_session`, and Google sign-in under `app/auth/google/`. Maya's step-02 opens the Scoutwell origin to sign in. Step-15 produces the unlisted listing; the install page reads `SCOUT_EXTENSION_STORE_URL` and shows a placeholder until that env is set. Step-20 adds `/earnings` and should be able to link from Earn.

Pay figures must come from `GET /v1/scout/meta` (`lib/scout/server.ts` → `scoutMeta()`) and `@joined/scout` formatters, not hard-coded cents in copy. Penny's step-05 put `apply_reward` on that meta payload.

What shipped in #83: `/`, `/how-it-works`, `/earn`, `/install`, `/faq`, `/extension` signed-in landing, marketing nav (`lib/nav.ts` `MARKETING_PAGES`), install placeholder when the store URL is empty, FAQ/earn copy from meta.

## In scope

- Investigate the current `scoutwell-frontend` pages and list the gaps in the PR description.
- Pages or sections: landing, how it works, how scouts earn (share-of-applies, numbers from config/API, not hard-coded rates), install the extension (store link from env), FAQ.
- A sign-in landing that the step-02 extension opens: after sign-in it shows "You can close this tab and return to the extension".
- Use `sid-ui`; responsive; basic metadata per page. Import from `"sid-ui"` only (global CSS: `sid-ui/styles/joined.css`). Do not add `packages/design-system` back.

## Out of scope

- No earnings dashboard (step-20).
- No backend changes.
- No other apps (`joined-frontend`, `admin-frontend`, `acorn-frontend`).
- No merge to `main`. Never open a PR into an `acorn*` branch.

## Files and areas to touch

- `scoutwell-frontend/app/(marketing)/page.tsx` — landing
- `scoutwell-frontend/app/(marketing)/how-it-works/page.tsx` (new)
- `scoutwell-frontend/app/(marketing)/earn/page.tsx` (new)
- `scoutwell-frontend/app/(marketing)/install/page.tsx` (new)
- `scoutwell-frontend/app/(marketing)/faq/page.tsx` (new)
- `scoutwell-frontend/app/(auth)/extension/page.tsx` (new)
- `scoutwell-frontend/components/landing/landing-page.tsx`
- `scoutwell-frontend/components/site/how-it-works-view.tsx`, `earn-view.tsx`, `install-view.tsx`, `faq-view.tsx`, `faq-list.tsx`
- `scoutwell-frontend/components/shell/marketing-nav.tsx`
- `scoutwell-frontend/lib/nav.ts`, `lib/routes.ts`, `lib/site-copy.ts`, `lib/config.ts`
- `scoutwell-frontend/.env.example` — `SCOUT_EXTENSION_STORE_URL`
- Tests: `lib/config.test.ts`, `lib/site-copy.test.ts`, `lib/nav.test.ts`, `lib/routes.test.ts`

## Implementation notes

### Routes

| URL | Purpose |
| --- | --- |
| `/` | Landing |
| `/how-it-works` | How Scout works |
| `/earn` | How scouts earn |
| `/install` | Install the extension |
| `/faq` | FAQ |
| `/extension` | Extension sign-in landing |

Marketing shell: `app/(marketing)/layout.tsx` with `ScoutHeader` `audience="site"` and `BrandFooter`. Nav: How it works, Earn, Install, FAQ.

### Env

| Variable | Purpose |
| --- | --- |
| `SCOUTWELL_API_URL` | Server API |
| `SCOUT_EXTENSION_STORE_URL` | Chrome listing; empty → install placeholder (no dead CTA) |
| `JOINED_WEB_URL` | Link back to Joined if needed |
| `SCOUT_PUBLIC_API_URL` | Public API if already used |

`extensionStoreUrl()` in `lib/config.ts`. Do not hard-code the Chrome Web Store URL.

### Pay copy

`earnFigures(meta)` and `faqItems(meta)` in `lib/site-copy.ts` use `@joined/scout` `formatMoney` / `formatRate` and the meta reward table. If meta is missing, show safe fallback copy without inventing a rate.

### Extension landing

`app/(auth)/extension/page.tsx`: signed out → sign-in; signed in → `EXTENSION_SIGNED_IN_BODY` = "You can close this tab and return to the extension". Cookie: `scoutwell_session`.

Maya's client `getSignInUrl()` may point at `/sign-in` or `/extension`. Prefer `/extension` if you touch only scoutwell-frontend; do not edit the extension in this step.

## Acceptance criteria

1. Build, typecheck, lint, and format pass for `scoutwell-frontend`.
2. All new pages render locally and are linked from the main navigation.
3. Diff stays in Leo's lane (`scoutwell-frontend/**` for this step).
4. Earn/FAQ numbers come from meta/config, not hard-coded rates.

## Test and validation

```bash
bun --filter scoutwell-frontend typecheck
bun --filter scoutwell-frontend lint
bun test scoutwell-frontend/lib/site-copy.test.ts scoutwell-frontend/lib/config.test.ts scoutwell-frontend/lib/nav.test.ts
bun --filter scoutwell-frontend build
bun run ci typecheck
```

E2E today only smokes the home title (`tests/e2e/specs/scoutwell-frontend.e2e.ts`). Marketing subpages are manual.

Manual: open `/`, `/how-it-works`, `/earn`, `/install`, `/faq`, `/extension`. Confirm nav links. With `SCOUT_EXTENSION_STORE_URL` empty, install shows a placeholder, not a broken store button.

## Risks and soft parks

- Store URL stays empty until Elon publishes the step-15 unlisted listing.
- No E2E for marketing subpages or the extension signed-in message.
- GitHub Actions runner starvation can cancel jobs. Require real green, not cancelled.

## Definition of done

PR into `stage-roadmap-w34` (this step originally merged to `stage-roadmap` as #83), CI green (not cancelled), Quinn PASS, Elon merges. Never main.
