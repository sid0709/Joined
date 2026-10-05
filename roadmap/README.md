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
- Implementation order is owned by the Jack / @Claude loop in Slack `#sid-development`. Jack posts one step path at a time and Claude opens one PR into `stage-roadmap` for that step only.
- Elon (engineering) reviews each step PR lightly and merges it into `stage-roadmap`. The next step starts only when Sid says so.

## Weekly buckets

### W1: Oct 5 to 11. Foundations and the Scout critical path

Areas: email sign-up and log-in, hide company/recruiter mode for launch, role checks per app, email sending, error logging, basic analytics, Stripe account and products, **Scout extension built from scratch**, Scout share-of-applies earnings backend, server-side job search.

| Step                                           | Slice                                                    | Status |
| ---------------------------------------------- | -------------------------------------------------------- | ------ |
| [step-01](step-01-scout-extension-scaffold.md) | Scout extension scaffold (shell, manifest, entry points) | Ready  |

More W1 steps are added after step-01 merges and Sid approves the next one.

### W2: Oct 12 to 18. Scout complete, Premium billing, job quality

Areas: Scout extension finish (draft queue, ATS board detect, status badge, notifications, Chrome Web Store unlisted by Oct 14), Scout website gaps and earnings dashboard, Premium Stripe checkout and billing page, server-side hidden-jobs feed, job import schedule, kill switches, dedupe, dead-link expiry, Acorn website start.

### W3: Oct 19 to 25. Scraper onboarding; build freeze Friday Oct 23

Areas: scraper onboarding, saved searches and alerts, fit score, SEO, resume builder gaps, application tracker, report buttons, scam score, data export, legal drafts, payout provider, Acorn website profile/resume/billing, admin user and source management, job quality dashboard, earnings report, disputes.

### W4: Oct 26 to Nov 1. Legal, QA, launch prep

Areas: legal documents and agreements, E2E journeys, Stripe live keys, non-US payout test, security pass, load test, production domains for Scout, admin and Acorn, backups and monitoring, scraper feedback fixes, Chrome Web Store listing.

### November: launch

Scout + Joined launch per the Notion plan.
