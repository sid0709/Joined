# Joined V1 roadmap: staged steps

Source of truth: the Notion roadmap.

- English: https://app.notion.com/p/3effe99a5d3f81888ecffef3fe021301
- Korean: https://app.notion.com/p/3effe99a5d3f8123acb3ee94fe46ea2e

If this folder and Notion disagree, Notion wins. Fix the step file to match.

## How this folder works

- Every step is one small feature or task, in `roadmap/step-NN-short-slug.md` (NN = 01, 02, ...).
- Each step file states its goal, in-scope files and areas, out-of-scope items, acceptance criteria, and target branch.
- Target branch for every step is `stage-roadmap`. Nothing here merges to `main`.
- No backend changes unless the step explicitly requires them for that feature.
- Elon (engineering manager) assigns each step to one specialist. Specialists work in parallel, each only in its own folders, and open one small PR into `stage-roadmap` per step.
- Quinn reviews each PR, Elon does a light review and merges it into `stage-roadmap`. Nothing merges to `main`.
- Jack posts progress in Slack `#sid-development`; Sid coordinates with the user.

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

### W3: Oct 19 to 25. Scraper onboarding; build freeze Friday Oct 23

Areas: scraper onboarding, saved searches and alerts, fit score, SEO, resume builder gaps, application tracker, report buttons, scam score, data export, legal drafts, payout provider, Acorn website profile/resume/billing, admin user and source management, job quality dashboard, earnings report, disputes.

### W4: Oct 26 to Nov 1. Legal, QA, launch prep

Areas: legal documents and agreements, E2E journeys, Stripe live keys, non-US payout test, security pass, load test, production domains for Scout, admin and Acorn, backups and monitoring, scraper feedback fixes, Chrome Web Store listing.

### November: launch

Scout + Joined launch per the Notion plan.
