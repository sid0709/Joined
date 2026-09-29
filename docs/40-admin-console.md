# 40 — Admin Console

**App:** `admin-web` · Staff SSO + hardware-key MFA · Every action audited.

## Roles

| Role       | Can                                                                         |
| ---------- | --------------------------------------------------------------------------- |
| Support    | View users (PII masked), resend notifications, view tracker, open cases     |
| Moderator  | Work moderation queues, decide reports/disputes/scout reviews               |
| Trust lead | Suspensions, bans, rule changes, link-graph views                           |
| Finance    | Ledger views, reconciliation, payouts approval, adjustments (dual approval) |
| Ops        | Ingestion sources, pool management, rate limits, source kill switches       |
| Admin      | Roles, pricing books, feature flags, configuration                          |

## Sections

| Section            | Contents                                                                                                                                      |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------- |
| **Overview**       | North-star metric, applications/interviews today (internal vs external), queue sizes and SLA breaches, payment health                         |
| **Users**          | Search by email/ID/phone; role; tier; risk; linked accounts; timeline of key events; actions (restrict, force re-verify, lift apply cooldown) |
| **Companies**      | Verification status, claims, registration, jobs, billing, fee history, classification-mismatch rate                                           |
| **Jobs**           | Search the pool; source; hidden status; quality score; expire/remove; merge duplicates                                                        |
| **Moderation**     | Queues from [32-trust-and-safety.md](32-trust-and-safety.md)                                                                                  |
| **Hire ops**       | ATS health; AI assistant runs (success rate, cost per interview, consent declines); stage-lock backlog                                        |
| **Automation**     | Bot-application detections, blocked applies, challenge pass rates, enforcement actions ([22](22-no-bot-applications.md))                      |
| **Tracking**       | Detection accuracy dashboards; unconfirmed interviews; classification mismatches; hidden-interview flags                                      |
| **Finance**        | Ledger explorer, daily reconciliation, payout batches (approve/hold), invoices, refunds, adjustments                                          |
| **Pricing**        | Price books with effective dates; preview impact; publish (Admin + Finance approval)                                                          |
| **Config & flags** | Free-credit count (3–5), hold periods, apply rate limits, billable interview limit (3), thresholds, feature flags per cohort                  |
| **Audit log**      | Filterable, exportable                                                                                                                        |

## Requirements

- PII masked by default; "reveal" requires a reason and is logged.
- Bulk actions (e.g. expire 1,000 jobs) require confirmation with count and are reversible where possible.
- Config changes versioned with diff and rollback.

## Acceptance criteria

- Changing `hold_period_days` creates a versioned config entry and applies only to interviews confirmed afterward.
- A payout batch cannot be sent without a Finance approval distinct from its creator.
