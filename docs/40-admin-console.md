# 40 — Admin Console

**App:** `admin-web` · Staff SSO + hardware-key MFA · Every action audited.

## Roles

| Role | Can |
|---|---|
| Support | View users (PII masked), resend notifications, view tracker, open cases |
| Moderator | Work moderation queues, decide reports/disputes/scout reviews |
| Trust lead | Suspensions, bans, rule changes, link-graph views |
| Finance | Ledger views, reconciliation, payouts approval, adjustments (dual approval) |
| Ops | Routing overrides, ingestion sources, bidder workforce management, quotas |
| Admin | Roles, pricing books, feature flags, configuration |

## Sections

| Section | Contents |
|---|---|
| **Overview** | North-star metric, applications/interviews today, queue sizes and SLA breaches, payment health |
| **Users** | Search by email/ID/phone; modes; tier; risk; linked accounts; timeline of key events; actions (restrict, force re-verify, reset quotas) |
| **Companies** | Verification status, claims, jobs, billing, spend caps, assisted policy overrides |
| **Jobs** | Search the pool; source; quality score; route; expire/remove; merge duplicates |
| **Moderation** | Queues from [32-trust-and-safety.md](32-trust-and-safety.md) |
| **Connect ops** | Assignment backlog by route; agent run health (success rate by ATS/adapter, cost per run); bidder workforce (online, throughput, QA rates); QA sampling queue |
| **Tracking** | Detection accuracy dashboards; unconfirmed interviews; hidden-interview flags |
| **Finance** | Ledger explorer, daily reconciliation, payout batches (approve/hold), invoices, refunds, adjustments |
| **Pricing** | Price books with effective dates; preview impact; publish (Admin + Finance approval) |
| **Config & flags** | Quotas, caps, hold periods, thresholds, router lists (`bulk_ats`), feature flags per cohort |
| **Audit log** | Filterable, exportable |

## Requirements

- PII masked by default; "reveal" requires a reason and is logged.
- Bulk actions (e.g. expire 1,000 jobs) require confirmation with count and are reversible where possible.
- Config changes versioned with diff and rollback.

## Acceptance criteria

- Changing `hold_period_days` creates a versioned config entry and applies only to interviews confirmed afterward.
- A payout batch cannot be sent without a Finance approval distinct from its creator.
