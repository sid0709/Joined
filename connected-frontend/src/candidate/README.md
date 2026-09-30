# Candidate (bidder) module

Owned by the **bidder** team. A bidder browses tasks posted by job hunters, chats to agree a
rate, gets connected, applies to the links the hunter assigns, answers the hunter's reviews and
gets paid per approved link. Everything runs on mock data held in one context.

## Routes

| URL                                     | Page                                           |
| --------------------------------------- | ---------------------------------------------- |
| `/marketplace/candidate/dashboard`      | Daily throughput, queue, attention list        |
| `/marketplace/jobs`                     | Task board (search, filter, save)              |
| `/marketplace/jobs/[taskId]`            | Task detail, fit check, contact the hunter     |
| `/marketplace/candidate/bids`           | Pipeline board from inquiry to connected       |
| `/marketplace/candidate/invitations`    | Hunter invitations (accept, decline)           |
| `/marketplace/candidate/calendar`       | Interviews (join, reschedule, cancel)          |
| `/marketplace/messages?thread=<id>`     | Chat with hunters, rate proposals, progress    |
| `/marketplace/candidate/work?desk=<id>` | Assigned links per desk, submit, fix, ask      |
| `/marketplace/candidate/feedback`       | Hunter reviews: approved, mistakes, discussion |
| `/marketplace/candidate/earnings`       | Payouts, early payout, rate level              |
| `/marketplace/candidate/performance`    | QA rate, pace, work by ATS, level path         |
| `/marketplace/candidate/profile`        | Profile, skills, minimum rates, availability   |
| `/marketplace/candidate/tests`          | Assessments that unlock gated tasks            |
| `/marketplace/candidate/notifications`  | Notification inbox                             |

## Structure

```
src/candidate/
├── components/     # Views; ui/ holds bidder-only pieces
├── context/        # BidderWorkspaceContext: all state and actions
├── data/           # Mock hunters, board, pipeline, work, account
├── lib/            # Derived values (payouts, fit checks, scripted hunter replies)
├── styles/         # bidder.css (bx-*), built on the shared kit
└── types/          # workspace.ts
```

Route constants live in `src/shared/routes/bidder.ts`.

## Import rules

✅ Allowed: `@/src/shared/*` (including `shared/kit`, `shared/lib`, `shared/mock`)
❌ Forbidden: `@/src/client/*`

The UI kit (`hx-*` classes, `Panel`, `PageHeader`, `StatCard`, charts) is shared with the job
hunter workspace, so both roles look and behave the same.
