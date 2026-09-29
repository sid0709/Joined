# ADR 0002: The interview is the currency; no bot applications

- Status: Accepted
- Date: 2026-09-29

## Context

The September 2026 investor deck reframes OpenSeat around three products on one account: **Jobs** (free job site with Candidate mode), **Hire** (ATS with an AI interview assistant, Company mode) and **Scout** (people who add hidden jobs). The earlier docs also described a fourth service, **Connect**, in which human bidders and an AI agent applied to jobs on a job hunter's behalf and were paid per bid and per interview.

Volume tools are what flood employers' inboxes (about 11,000 applications a minute on LinkedIn). Companies will not pay for volume; they will pay for real interviews. Selling auto-apply would undermine that promise and the fee model.

## Decision

1. **The interview is the currency.** Job seekers, companies and scouts are paid or charged on confirmed interviews (and an optional $20/month Premium), never on applications, posts, seats or submissions.
2. **Pricing rule: who brought the candidate sets the price.** Company pays $5 internal / $20 external; seeker pays $2 own (after 3–5 free credits a month) / $0 found; free from the 4th interview for the same candidate and job; only registered companies owe fees.
3. **The record is two-sided.** Both calendars witness the interview, both sides classify it, the first-touch source stamp breaks ties, and an unpaid interview locks the next ATS stage.
4. **Bot participation in job applications is banned.** Every application is made personally by the verified candidate in a live session. There is no application API. Auto-apply tools, AI agents, browser automation, apply-for-you services and delegated applying are prohibited and technically blocked (see `docs/22-no-bot-applications.md`).
5. **Connect is retired.** Bidder and agent roles, engagements, assignments, delegation agreements, bid logs, QA sampling, piece-rate pay, client plans, escrow and routing between agent and human are removed from the specs. Roles are now `job_hunter` (Candidate mode), `recruiter` (Company mode) and `scout`.
6. **The AI interview assistant serves the company's HR after the interview** (transcript, analysis, notes). It is advisory, consent-based, and never assists candidates live.

## Consequences

- Docs `20-connect-client`, `21-connect-bidder` and `22-ai-agent` are replaced by `20-hire-ats`, `21-hire-ai-interview-assistant` and `22-no-bot-applications`. Doc `11`, `12`, `13` are renamed to `11-jobs-candidate-mode`, `12-hire-company-mode`, `13-scout-mode`.
- The data model gains source stamps, pipelines and stages, scorecards, classifications, seeker credits, subscriptions and scout pool allocations, and loses engagements, assignments, bid logs, QA reviews, quotas, agent runs and delegation agreements.
- Existing code in this repo (the Scout API, Scoutwell, the admin console, `opened-frontend` job search) is compatible. Hire, calendar tracking and payments are new work; `connected-frontend` marketplace screens describe the retired Connect model and should be reviewed before further investment.
- Prior Phase 1 numbers for bidders and the AI agent no longer support any current claim and were removed from the docs.
- Revenue depends on hiring volume and on both sides classifying honestly; the risk register lives in [70-roadmap.md](../70-roadmap.md) and [32-trust-and-safety.md](../32-trust-and-safety.md).
