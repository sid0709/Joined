# Step 61: Security pass

- **Week:** W4
- **Status:** Planned
- **Owner:** Quinn (tests and CI lane; Elon coordinates `docs/**`)
- **Target branch:** `stage-roadmap-w34`
- **PR title:** `docs(security): pass findings and follow-up prs (roadmap step-61)`

Every commit must be a lowercase conventional commit (`type(scope): subject`) or commitlint fails CI.

## Goal

A security pass is recorded, and fix PRs are opened for anything launch-blocking. This step’s PR is the report; fixes are separate per-owner PRs into `stage-roadmap-w34`.

## Context and dependencies

Product/compliance checklist: `docs/90-compliance-privacy-security.md` (ASVS L2, SSRF, secrets, extension MV3). Admin authz: `docs/62-staff-company-api.md`. Billing live guard: `STRIPE_ALLOW_LIVE` in `backend-core/billing/config.go`. Error reporting hook: `SENTRY_DSN` via `backend-core/config` `LoadErrorReporting()` + `httpkit.NewReporter()` (warns, no-op adapter — no Sentry SDK). CSRF: `joined-frontend/lib/auth/csrf.ts`. CORS: `backend-core/httpkit/cors.go`, `CORS_ORIGINS`. Kill-switch defaults: `backend-core/killswitch`. Extension permissions: `scout-extension/store/permission-justifications.md`, `manifest.json`.

CI today: `bun run ci dependencies` / `tests/dependency-policy.test.js` (catalog + single node_modules) — **not** an advisory/OSV scan. No gitleaks/trufflehog in `.github` or `tools/`.

Related soft parks: e2e-smoke `continue-on-error`; step-47 live payout flag; step-16 `scripting` justification if still missing.

## In scope

- Run the pass against this tree: dependency/advisory scan if you add a documented command, secret scan of the diff, auth cookies, CSRF/CORS, SSRF on fetchers, kill-switch defaults, Stripe live-key guard, admin authz, extension permissions.
- Write findings in `docs/` (Elon coordinates `docs/**`). Each item: severity, owner, launch-blocking or not, follow-up PR or “accepted risk”.
- Open separate fix PRs into `stage-roadmap-w34` per owner lane. This step’s PR can be the report; fixes must not be one giant mixed diff.

## Out of scope

- No silent prod pentest against live users. No storing secrets in the findings doc.
- No product feature work in the report PR.
- No merge to `main`.

## Files and areas to touch

- `docs/91-security-pass.md` (new) or a dated file under `docs/` — Elon
- `docs/90-compliance-privacy-security.md` — link
- `docs/README.md` — index
- Optional: `tools/` or `.github/workflows` for a secret/advisory job (Quinn) — only if it stays non-secret and fail-closed on found keys
- Fix PRs: each specialist’s lane, not this diff

## Implementation notes

Minimum checklist (record pass/fail + evidence):

1. `git grep` / secret scan for `sk_live`, `rk_live`, `whsec_`, `AKIA`, private keys
2. Cookie flags on `joined_session`, `scoutwell_session`, `joined_admin_session`
3. CSRF on email auth routes (`joined-frontend/lib/auth/csrf.ts`)
4. CORS allowlists (`CORS_ORIGINS`) — no `*` with credentials
5. SSRF on job URL fetchers / dead-link checker — private IPs and metadata hosts
6. Kill-switch defaults (fail safe: checkout/submissions can default on, but document it)
7. `STRIPE_ALLOW_LIVE` and `PAYOUT_ALLOW_LIVE` refuse-by-default
8. Admin `admin()` bearer + actor audit
9. Extension host permissions vs `permission-justifications.md` (add `scripting` if step-16 still needs it)
10. Dependency policy (`bun run ci dependencies`); note the lack of OSV if you do not add one

Severity: blocker / major / accepted risk. Owner: Maya / Leo / Ravi / Penny / Quinn / Elon.

Do not paste secret values into the findings doc.

## Acceptance criteria

1. Findings document lists every issue with owner + follow-up PR or “accepted risk”.
2. Launch-blocking items have a linked PR into `stage-roadmap-w34`.
3. Report diff stays in `docs/**` or `roadmap/**`; fix PRs stay in the owning specialist's lane.

## Test and validation

```bash
bun run ci lint
bun run ci dependencies
bun run ci go
git grep -nE 'sk_live_|rk_live_|BEGIN (RSA |OPENSSH )?PRIVATE'
```

If you add a scanner, document the exact command in the findings file.

## Risks and soft parks

- e2e-smoke still `continue-on-error`.
- Step-16: add `scripting` to `scout-extension/store/permission-justifications.md` if not already there.
- Infra: runner starvation cancels jobs; require real green.
- A report with no linked fix PRs does not clear launch blockers.

## Definition of done

Report PR into `stage-roadmap-w34`, CI green (not cancelled), Quinn PASS, Elon merges. Never `main`. Blockers have their own PRs.
