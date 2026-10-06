# Joined V1 roadmap: staged steps

Source of truth: the Notion roadmap.

- English: https://app.notion.com/p/3effe99a5d3f81888ecffef3fe021301
- Korean: https://app.notion.com/p/3effe99a5d3f8123acb3ee94fe46ea2e

If this folder and Notion disagree, Notion wins. Fix the step file to match.

## How this folder works

- Every step is one small feature or task, in `roadmap/step-NN-short-slug.md` (NN = 01, 02, ...).
- **Each step file is a standalone Cursor task doc.** A cloud agent should be able to pick up one file, with no tribal knowledge, and ship one PR. Files include goal, context, in/out of scope, real paths, contracts, acceptance criteria, test commands, risks, and definition of done.
- **Active target branch for W3/W4 is `stage-roadmap-w34`.** W1/W2 work originally merged into the retired `stage-roadmap`. Follow-ups land on `stage-roadmap-w34`. Nothing here merges to `main`. Never open a PR into an `acorn*` branch.
- No backend changes unless the step explicitly requires them for that feature.
- Elon (engineering manager) assigns each step to one specialist. Specialists work in parallel, each only in its own folders, and open one small PR into that week's target branch per step.
- Quinn reviews each PR. Gate: Quinn PASS → Elon merges. Bugbot is skipped. Nothing merges to `main`.
- Jack posts progress in Slack `#sid-development`; Sid coordinates with the user.

Status values in the index: **Done**, **In review**, **Planned**.

## Target branches

| Week  | Target branch       | Notes                                                                                     |
| ----- | ------------------- | ----------------------------------------------------------------------------------------- |
| W1–W2 | `stage-roadmap`     | Historical. Step files 01–32 that already merged name this as the original target.        |
| W3–W4 | `stage-roadmap-w34` | **Active.** Cut from `main` at `af09b2adb0aeac2959f982be92850afcbce83fd6`.                |
| —     | `main`              | Deploy stays main-only. Do not merge roadmap work to `main` until launch.                 |
| —     | `acorn*`            | Never touch. Coordinate with Elon for `acorn/**` work; still PR into `stage-roadmap-w34`. |

## Team and file ownership

| Specialist                     | Owns (only these paths)                                                                                                                       |
| ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Maya, Scout extension          | `scout-extension/**`                                                                                                                          |
| Leo, web frontends             | `joined-frontend/**`, `scoutwell-frontend/**`, `admin-frontend/**`, `connected-frontend/**`, `acorn-frontend/**`, `packages/google-signin/**` |
| Ravi, platform backend         | `joined-backend/**`, `admin-backend/**`, `backend-core/**` except `scout/` and `billing/`, `packages/job-schema/**`                           |
| Penny, money and Scout backend | `backend-core/scout/**`, `backend-core/billing/**`, `scoutwell-backend/**`, `packages/scout/**`                                               |
| Quinn, QA and review           | `tests/**`, `.github/workflows/**`                                                                                                            |
| Elon, integrator               | root files, `bun.lock`, `go.work`, `deploy/**`, `docker/**`, `tools/**`, `roadmap/**`, `acorn/**`, `acorn-backend/**`                         |

Product UI is the external `sid-ui` package (catalog pin; source and `sid-ui-theme` catalog live in https://github.com/sid0709/sid-ui). Do not add design-system source under `packages/`. A missing primitive is added in the sid-ui repo, published, and the catalog pin bumped — not copied into an app.

A step that needs a file outside its owner's paths is split, or Elon coordinates the other owner. Live keys, real email, and production data stay off unless the user approves that exact change.

Leo owns `acorn-frontend/**`. Elon owns `acorn-backend/**` and `acorn/**` (extension, demo, shared). Steps 48–51 that need both get Elon on the PR. Never open a git branch named `acorn*`.

## Step index

All 66 steps. Status is Done / In review / Planned.

### W1: Oct 5 to 11. Foundations and the Scout critical path

Areas: email sign-up and log-in, hide company/recruiter mode for launch, role checks per app, email sending, error logging, Stripe account and products, Scout extension scaffold through capture, Scout share-of-applies earnings, server-side job search, e2e smoke.

| Step                                                  | Slice                                   | Owner | Status                    |
| ----------------------------------------------------- | --------------------------------------- | ----- | ------------------------- |
| [step-01](step-01-scout-extension-scaffold.md)        | Scout extension scaffold                | Maya  | Done (#63)                |
| [step-02](step-02-scout-extension-signin.md)          | Scout extension sign-in state           | Maya  | Done (#68)                |
| [step-03](step-03-email-auth-backend.md)              | Email sign-up and log-in backend        | Ravi  | Done (#72; follow-up #81) |
| [step-04](step-04-hide-recruiter-mode.md)             | Hide company/recruiter mode for launch  | Leo   | Done (#70)                |
| [step-05](step-05-scout-share-of-applies-earnings.md) | Scout share-of-applies earnings backend | Penny | Done (#69; follow-up #84) |
| [step-06](step-06-ci-for-stage-roadmap.md)            | CI for PRs into stage-roadmap           | Quinn | Done (#64)                |
| [step-07](step-07-server-side-job-search.md)          | Server-side job search                  | Ravi  | Done (#71)                |
| [step-08](step-08-stripe-products-test-mode.md)       | Stripe products in test mode            | Penny | Done (#66)                |
| [step-09](step-09-role-checks-per-app.md)             | Role checks per app                     | Ravi  | Done (#77)                |
| [step-10](step-10-email-auth-screens.md)              | Email sign-up and log-in screens        | Leo   | Done (#79)                |
| [step-11](step-11-email-provider.md)                  | Email sending provider                  | Ravi  | Done (#76)                |
| [step-12](step-12-error-logging.md)                   | Structured error logging                | Ravi  | Done (#75)                |
| [step-13](step-13-scout-job-capture-ats.md)           | Scout job capture and ATS detect        | Maya  | Done (#85)                |
| [step-14](step-14-e2e-smoke-harness.md)               | E2E smoke harness                       | Quinn | Done (#67)                |

W1/W2 follow-ups (not new steps): #81 (step-03 fix), #84 (step-05 hardening), #87 (Penny soft follow-ups), #93 (billing mount).

### W2: Oct 12 to 18. Scout complete, Premium billing, job quality

Areas: Scout extension finish (draft queue, ATS boards, status badge, notifications, Chrome Web Store unlisted), Scout website gaps and earnings dashboard, Premium Stripe checkout and billing page, hidden-jobs feed, job import schedule, kill switches, dedupe, dead-link expiry, Acorn website start.

| Step                                                             | Slice                                   | Owner | Status      |
| ---------------------------------------------------------------- | --------------------------------------- | ----- | ----------- |
| [step-15](step-15-scout-extension-store-package.md)              | Chrome Web Store unlisted package       | Maya  | Done (#89)  |
| [step-16](step-16-scout-extension-draft-queue-submit.md)         | Draft queue and submit                  | Maya  | Done (#92)  |
| [step-17](step-17-scout-extension-more-ats-boards.md)            | Detect more ATS boards                  | Maya  | Done (#99)  |
| [step-18](step-18-scout-extension-status-badge-notifications.md) | Status badge and notifications          | Maya  | Done (#100) |
| [step-19](step-19-scoutwell-website-gaps.md)                     | Scoutwell website launch gaps           | Leo   | Done (#83)  |
| [step-20](step-20-scout-earnings-dashboard.md)                   | Scout earnings dashboard                | Leo   | Done (#86)  |
| [step-21](step-21-premium-billing-page.md)                       | Premium pricing and billing page        | Leo   | Done (#96)  |
| [step-22](step-22-job-dedupe.md)                                 | Job dedupe key and merge                | Ravi  | Done (#88)  |
| [step-23](step-23-hidden-jobs-feed.md)                           | Server-side hidden-jobs feed            | Ravi  | Done (#91)  |
| [step-24](step-24-dead-link-expiry.md)                           | Dead-link expiry checker                | Ravi  | Done (#95)  |
| [step-25](step-25-job-import-schedule.md)                        | Scheduled job import runner             | Ravi  | Done (#97)  |
| [step-26](step-26-kill-switches.md)                              | Runtime kill switches                   | Ravi  | Done (#98)  |
| [step-27](step-27-scout-extension-intake-api.md)                 | Extension submission intake API         | Penny | Done (#82)  |
| [step-28](step-28-scout-submission-status-api.md)                | Submission status and notifications API | Penny | Done (#94)  |
| [step-29](step-29-premium-checkout-api.md)                       | Premium checkout and portal (test mode) | Penny | Done (#90)  |
| [step-30](step-30-scout-extension-ci.md)                         | Scout extension CI                      | Quinn | Done (#74)  |
| [step-31](step-31-e2e-email-auth-journey.md)                     | E2E email sign-up and log-in journey    | Quinn | Done (#101) |
| [step-32](step-32-acorn-website-scaffold.md)                     | Acorn website scaffold                  | Leo   | Done (#80)  |

W2 step files stay in this folder. Do not delete historical W1/W2 docs.

### W3: Oct 19 to 25. Scraper onboarding; build freeze Friday Oct 23

Areas: scraper onboarding, saved searches and alerts, fit score, SEO, resume builder gaps, application tracker, report buttons, scam score, data export, legal drafts, payout provider, Acorn (`acorn-frontend` + `acorn-backend`) profile/resume/billing, admin user and source management, job quality dashboard, earnings report, disputes.

Target branch: **`stage-roadmap-w34`**. Ops-only (not coding steps): scraper account provisioning, staffing review queue, feedback channel process.

Kickoff in parallel after step-33 CI is green (or concurrent if workflows already cover the branch): Ravi 34/36/42, Leo 38/39/40 (35/37 wait on APIs), Penny 46/47. Maya is idle in W3 unless scraper onboarding needs extension tweaks.

| Step                                                          | Slice                                              | Owner      | Status      |
| ------------------------------------------------------------- | -------------------------------------------------- | ---------- | ----------- |
| [step-33](step-33-ci-for-stage-roadmap-w34.md)                | CI for PRs into stage-roadmap-w34                  | Quinn      | Done (#104) |
| [step-34](step-34-saved-searches-api.md)                      | Persist saved searches; alert schedule hooks       | Ravi       | Done (#106) |
| [step-35](step-35-saved-searches-ui-alerts.md)                | Saved-search UI + email alert preferences          | Leo        | Done        |
| [step-36](step-36-fit-score-api.md)                           | Fit score + short reason on jobs                   | Ravi       | Done (#108) |
| [step-37](step-37-fit-score-ui.md)                            | Show fit score/reason in search                    | Leo        | Done        |
| [step-38](step-38-seo-job-pages.md)                           | SSR job pages, titles, JobPosting, sitemap, robots | Leo        | Done (#107) |
| [step-39](step-39-resume-builder-gaps.md)                     | Close résumé builder gaps                          | Leo        | Done (#109) |
| [step-40](step-40-application-tracker.md)                     | Saved stage, notes, reminders                      | Leo        | Done (#112) |
| [step-41](step-41-job-report-buttons.md)                      | Report UI/reasons (API exists)                     | Leo        | Done        |
| [step-42](step-42-scam-job-score.md)                          | Scam/fake score; hold risky for admin              | Ravi       | Done (#110) |
| [step-43](step-43-account-data-export.md)                     | Data export endpoint (delete exists)               | Ravi       | Done        |
| [step-44](step-44-account-data-export-ui.md)                  | Export UI + privacy settings surface               | Leo        | Done        |
| [step-45](step-45-legal-drafts-pages.md)                      | Terms/privacy/cookie consent draft pages           | Leo        | Done        |
| [step-46](step-46-scout-payout-identity.md)                   | Stricter identity check before first payout        | Penny      | Done (#111) |
| [step-47](step-47-global-payout-provider.md)                  | Wise/Payoneer/PayPal-style provider                | Penny      | Done (#113) |
| [step-48](step-48-acorn-profile-editor.md)                    | Acorn profile editor (`acorn-frontend` + API)      | Leo        | BLOCKED     |
| [step-49](step-49-acorn-resume-library.md)                    | Résumé upload/library shared with extension        | Leo        | BLOCKED     |
| [step-50](step-50-acorn-stripe-pricing.md)                    | Acorn pricing + Stripe                             | Penny      | Done        |
| [step-51](step-51-acorn-billing-legal-delete.md)              | Billing page, legal pages, delete-my-data          | Leo        | BLOCKED     |
| [step-52](step-52-admin-user-management.md)                   | Lookup, Premium cancel, refund, suspend APIs       | Ravi       | Done        |
| [step-53](step-53-admin-user-management-ui.md)                | Admin UI for user management                       | Leo        | Done        |
| [step-54](step-54-admin-sources-quality-earnings-disputes.md) | Sources, quality, earnings report, disputes        | Ravi+Penny | Done        |

If step-54 is too large, split into 54a sources (Ravi), 54b quality dashboard (Ravi), 54c earnings report (Penny), 54d disputes (Penny) and adjust counts with Sid.

### W4: Oct 26 to Nov 1. Legal, QA, launch prep

Areas: legal documents and agreements, E2E journeys, Stripe live keys, non-US payout test, security pass, load test, production domains for Scout, admin and Acorn, backups and monitoring, scraper feedback fixes, Chrome Web Store listing.

Target branch: **`stage-roadmap-w34`**.

| Step                                             | Slice                                           | Owner      | Status  |
| ------------------------------------------------ | ----------------------------------------------- | ---------- | ------- |
| [step-55](step-55-legal-docs-package.md)         | ToS/privacy/cookie/Premium/Scout contractor     | Leo/Elon   | Done    |
| [step-56](step-56-international-payout-tax.md)   | W-9/W-8BEN + sanction screening hooks           | Penny      | Done    |
| [step-57](step-57-e2e-seeker-premium.md)         | E2E seeker + Premium journeys                   | Quinn      | Done    |
| [step-58](step-58-e2e-scout-acorn.md)            | E2E scout + Acorn journeys                      | Quinn      | Done    |
| [step-59](step-59-stripe-live-config.md)         | Live keys wiring (needs explicit user approval) | Penny      | Done    |
| [step-60](step-60-non-us-payout-test.md)         | Test harness for one non-US payout              | Penny      | Done    |
| [step-61](step-61-security-pass.md)              | Security pass findings + fixes PRs              | Quinn      | Planned |
| [step-62](step-62-load-test-search.md)           | Load test search/job pages                      | Quinn/Ravi | Planned |
| [step-63](step-63-prod-domains-monitoring.md)    | Domains, backups, monitoring hooks              | Ravi       | Planned |
| [step-64](step-64-scraper-feedback-fixes.md)     | Top scraper week-1 extension fixes              | Maya       | Planned |
| [step-65](step-65-scraper-web-feedback-fixes.md) | Top scoutwell website feedback fixes            | Leo        | Planned |
| [step-66](step-66-chrome-web-store-public.md)    | Public (or keep unlisted) listing package       | Maya       | Planned |

### November: launch

Scout + Joined launch per the Notion plan.
