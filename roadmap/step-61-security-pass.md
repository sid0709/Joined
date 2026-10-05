# Step 61: Security pass

- **Week:** W4, QA / launch prep
- **Owner:** Quinn (tests and CI lane)
- **Target branch:** `stage-roadmap-w34` (never `main`, never `acorn*`)
- **PR title:** `docs(security): pass findings and follow-up prs (roadmap step-61)` (conventional commits: lowercase `type(scope): subject`; every commit message must follow the same format or CI fails)

## Goal

A security pass is recorded, and fix PRs are opened for anything launch-blocking.

## In scope

- Run the pass against this tree: dependency/advisory scan already in CI if present, secret scan of the diff, auth cookies, CSRF/CORS, SSRF on fetchers, kill-switch defaults, Stripe live-key guard, admin authz, extension permissions.
- Write findings in `docs/` or `roadmap/` (Elon coordinates `docs/**`). Severity, owner, and whether it blocks launch.
- Open separate fix PRs into `stage-roadmap-w34` per owner lane. This step's PR can be the report; fixes must not be one giant mixed diff.

## Out of scope

- No silent prod pentest against live users. No storing secrets in the findings doc.

## Acceptance criteria

1. Findings document lists every issue with owner + follow-up PR or "accepted risk".
2. Launch-blocking items have a linked PR into `stage-roadmap-w34`.
3. Report diff stays in `docs/**` or `roadmap/**`; fix PRs stay in the owning specialist's lane.
