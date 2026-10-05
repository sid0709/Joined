# Joined V1 roadmap: staged steps

Source of truth: the Notion roadmap.

- English: https://app.notion.com/p/3effe99a5d3f81888ecffef3fe021301
- Korean: https://app.notion.com/p/3effe99a5d3f8123acb3ee94fe46ea2e

If this folder and Notion disagree, Notion wins. Fix the step file to match.

## How this folder works

- Every step is one small feature or task, in `roadmap/step-NN-short-slug.md` (NN = 01, 02, ...).
- Each step file states its goal, in-scope files and areas, out-of-scope items, acceptance criteria, and target branch.
- **Active target branch for W3/W4 is `stage-roadmap-w34`.** W1/W2 step files still name `stage-roadmap` because those PRs landed there. Nothing here merges to `main`. Never open a PR into an `acorn*` branch.
- No backend changes unless the step explicitly requires them for that feature.
- Elon (engineering manager) assigns each step to one specialist. Specialists work in parallel, each only in its own folders, and open one small PR into that week's target branch per step.
- Quinn reviews each PR. Gate: Quinn PASS → Elon merges. Bugbot is skipped. Nothing merges to `main`.
- Jack posts progress in Slack `#sid-development`; Sid coordinates with the user.

## Target branches

| Week  | Target branch       | Notes                                                                                     |
| ----- | ------------------- | ----------------------------------------------------------------------------------------- |
| W1–W2 | `stage-roadmap`     | Historical. Step files 01–14 keep this target.                                            |
| W3–W4 | `stage-roadmap-w34` | **Active.** Cut from `main` at `af09b2adb0aeac2959f982be92850afcbce83fd6`.                |
| —     | `main`              | Deploy stays main-only. Do not merge roadmap work to `main` until launch.                 |
| —     | `acorn*`            | Never touch. Coordinate with Elon for `acorn/**` work; still PR into `stage-roadmap-w34`. |

## Team and file ownership

| Specialist                     | Owns (only these paths)                                                                                                                                                  |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Maya, Scout extension          | `scout-extension/**`                                                                                                                                                     |
| Leo, web frontends             | `joined-frontend/**`, `scoutwell-frontend/**`, `admin-frontend/**`, `connected-frontend/**`, `joined-theme/**`, `packages/design-system/**`, `packages/google-signin/**` |
| Ravi, platform backend         | `joined-backend/**`, `admin-backend/**`, `backend-core/**` except `scout/` and `billing/`, `packages/job-schema/**`                                                      |
| Penny, money and Scout backend | `backend-core/scout/**`, `backend-core/billing/**`, `scoutwell-backend/**`, `packages/scout/**`                                                                          |
| Quinn, QA and review           | `tests/**`, `.github/workflows/**`                                                                                                                                       |
| Elon, integrator               | root files, `bun.lock`, `go.work`, `deploy/**`, `docker/**`, `tools/**`, `roadmap/**`, `acorn/**`                                                                        |

A step that needs a file outside its owner's paths is split, or Elon coordinates the other owner. Live keys, real email, and production data stay off unless the user approves that exact change.

Leo + Elon for `acorn/website` (Elon owns `acorn/**`; Leo implements with Elon coordinating the PR).

## Weekly buckets

### W1: Oct 5 to 11. Foundations and the Scout critical path

Areas: email sign-up and log-in, hide company/recruiter mode for launch, role checks per app, email sending, error logging, basic analytics, Stripe account and products, **Scout extension built from scratch**, Scout share-of-applies earnings backend, server-side job search.

| Step                                                  | Slice                                   | Owner | Status                         |
| ----------------------------------------------------- | --------------------------------------- | ----- | ------------------------------ |
| [step-01](step-01-scout-extension-scaffold.md)        | Scout extension scaffold                | Maya  | Merged (PR #63)                |
| [step-02](step-02-scout-extension-signin.md)          | Scout extension sign-in state           | Maya  | In progress                    |
| [step-03](step-03-email-auth-backend.md)              | Email sign-up and log-in backend        | Ravi  | In progress                    |
| [step-04](step-04-hide-recruiter-mode.md)             | Hide company/recruiter mode for launch  | Leo   | In progress                    |
| [step-05](step-05-scout-share-of-applies-earnings.md) | Scout share-of-applies earnings backend | Penny | In progress                    |
| [step-06](step-06-ci-for-stage-roadmap.md)            | CI for PRs into stage-roadmap           | Quinn | In progress                    |
| [step-07](step-07-server-side-job-search.md)          | Server-side job search                  | Ravi  | In progress (parallel with 03) |
| [step-08](step-08-stripe-products-test-mode.md)       | Stripe products in test mode            | Penny | In progress (parallel with 05) |

Planned next in W1: role checks per app (Ravi), email sign-up and log-in screens (Leo), email sending provider and error logging (Ravi), analytics events (Ravi + Leo), Scout extension job capture and ATS detect (Maya).

### W2: Oct 12 to 18. Scout complete, Premium billing, job quality

Areas: Scout extension finish (draft queue, ATS board detect, status badge, notifications, Chrome Web Store unlisted by Oct 14), Scout website gaps and earnings dashboard, Premium Stripe checkout and billing page, server-side hidden-jobs feed, job import schedule, kill switches, dedupe, dead-link expiry, Acorn website start.

W2 step files stay in this folder if they already exist. Do not delete historical W1/W2 docs.

### W3: Oct 19 to 25. Scraper onboarding; build freeze Friday Oct 23

Areas: scraper onboarding, saved searches and alerts, fit score, SEO, resume builder gaps, application tracker, report buttons, scam score, data export, legal drafts, payout provider, Acorn website profile/resume/billing, admin user and source management, job quality dashboard, earnings report, disputes.

Target branch: **`stage-roadmap-w34`**. Ops-only (not coding steps): scraper account provisioning, staffing review queue, feedback channel process.

Kickoff in parallel after step-33 CI is green (or concurrent if workflows already cover the branch): Ravi 34/36/42, Leo 38/39/40 (35/37 wait on APIs), Penny 46/47. Maya is idle in W3 unless scraper onboarding needs extension tweaks.

| Step                                                          | Slice                                              | Owner      | Status  |
| ------------------------------------------------------------- | -------------------------------------------------- | ---------- | ------- |
| [step-33](step-33-ci-for-stage-roadmap-w34.md)                | CI for PRs into stage-roadmap-w34                  | Quinn      | Planned |
| [step-34](step-34-saved-searches-api.md)                      | Persist saved searches; alert schedule hooks       | Ravi       | Planned |
| [step-35](step-35-saved-searches-ui-alerts.md)                | Saved-search UI + email alert preferences          | Leo        | Planned |
| [step-36](step-36-fit-score-api.md)                           | Fit score + short reason on jobs                   | Ravi       | Planned |
| [step-37](step-37-fit-score-ui.md)                            | Show fit score/reason in search                    | Leo        | Planned |
| [step-38](step-38-seo-job-pages.md)                           | SSR job pages, titles, JobPosting, sitemap, robots | Leo        | Planned |
| [step-39](step-39-resume-builder-gaps.md)                     | Close résumé builder gaps                          | Leo        | Planned |
| [step-40](step-40-application-tracker.md)                     | Saved stage, notes, reminders                      | Leo        | Planned |
| [step-41](step-41-job-report-buttons.md)                      | Report UI/reasons (API exists)                     | Leo        | Planned |
| [step-42](step-42-scam-job-score.md)                          | Scam/fake score; hold risky for admin              | Ravi       | Planned |
| [step-43](step-43-account-data-export.md)                     | Data export endpoint (delete exists)               | Ravi       | Planned |
| [step-44](step-44-account-data-export-ui.md)                  | Export UI + privacy settings surface               | Leo        | Planned |
| [step-45](step-45-legal-drafts-pages.md)                      | Terms/privacy/cookie consent draft pages           | Leo        | Planned |
| [step-46](step-46-scout-payout-identity.md)                   | Stricter identity check before first payout        | Penny      | Planned |
| [step-47](step-47-global-payout-provider.md)                  | Wise/Payoneer/PayPal-style provider                | Penny      | Planned |
| [step-48](step-48-acorn-profile-editor.md)                    | Acorn profile editor (coord Elon for acorn/**)     | Leo        | Planned |
| [step-49](step-49-acorn-resume-library.md)                    | Résumé upload/library shared with extension        | Leo        | Planned |
| [step-50](step-50-acorn-stripe-pricing.md)                    | Acorn pricing + Stripe                             | Penny      | Planned |
| [step-51](step-51-acorn-billing-legal-delete.md)              | Billing page, legal pages, delete-my-data          | Leo        | Planned |
| [step-52](step-52-admin-user-management.md)                   | Lookup, Premium cancel, refund, suspend APIs       | Ravi       | Planned |
| [step-53](step-53-admin-user-management-ui.md)                | Admin UI for user management                       | Leo        | Planned |
| [step-54](step-54-admin-sources-quality-earnings-disputes.md) | Sources, quality, earnings report, disputes        | Ravi+Penny | Planned |

If step-54 is too large, split into 54a sources (Ravi), 54b quality dashboard (Ravi), 54c earnings report (Penny), 54d disputes (Penny) and adjust counts with Sid.

### W4: Oct 26 to Nov 1. Legal, QA, launch prep

Areas: legal documents and agreements, E2E journeys, Stripe live keys, non-US payout test, security pass, load test, production domains for Scout, admin and Acorn, backups and monitoring, scraper feedback fixes, Chrome Web Store listing.

Target branch: **`stage-roadmap-w34`**.

| Step                                             | Slice                                           | Owner      | Status  |
| ------------------------------------------------ | ----------------------------------------------- | ---------- | ------- |
| [step-55](step-55-legal-docs-package.md)         | ToS/privacy/cookie/Premium/Scout contractor     | Leo/Elon   | Planned |
| [step-56](step-56-international-payout-tax.md)   | W-9/W-8BEN + sanction screening hooks           | Penny      | Planned |
| [step-57](step-57-e2e-seeker-premium.md)         | E2E seeker + Premium journeys                   | Quinn      | Planned |
| [step-58](step-58-e2e-scout-acorn.md)            | E2E scout + Acorn journeys                      | Quinn      | Planned |
| [step-59](step-59-stripe-live-config.md)         | Live keys wiring (needs explicit user approval) | Penny      | Planned |
| [step-60](step-60-non-us-payout-test.md)         | Test harness for one non-US payout              | Penny      | Planned |
| [step-61](step-61-security-pass.md)              | Security pass findings + fixes PRs              | Quinn      | Planned |
| [step-62](step-62-load-test-search.md)           | Load test search/job pages                      | Quinn/Ravi | Planned |
| [step-63](step-63-prod-domains-monitoring.md)    | Domains, backups, monitoring hooks              | Ravi       | Planned |
| [step-64](step-64-scraper-feedback-fixes.md)     | Top scraper week-1 extension fixes              | Maya       | Planned |
| [step-65](step-65-scraper-web-feedback-fixes.md) | Top scoutwell website feedback fixes            | Leo        | Planned |
| [step-66](step-66-chrome-web-store-public.md)    | Public (or keep unlisted) listing package       | Maya       | Planned |

### November: launch

Scout + Joined launch per the Notion plan.
