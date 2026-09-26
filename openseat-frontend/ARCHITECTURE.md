# OpenSeat frontend architecture

OpenSeat is a two-sided work marketplace. `Candidate` means the person bidding
for work; `Client` means the person posting and managing work.

## Product areas

| Area | Candidate workflow | Client workflow |
| --- | --- | --- |
| Identity | Register, choose Candidate, edit profile | Register, choose Client, edit profile |
| Marketplace | Browse, filter, inspect job detail, submit a bid | Browse market, inspect competing supply |
| Work pipeline | My bids, discussion, awarded jobs, active work | Job posts, applicants, approval, active hires |
| Collaboration | Message job owner | Message candidates |
| Delivery | Track milestones, submit updates, mark work ready | Review progress, request changes, complete work |

## Route map

```text
app/marketplace/
├── page.tsx                         # role-aware entry point
├── jobs/page.tsx                    # shared marketplace list/demo
├── jobs/[jobId]/page.tsx            # job detail / right-side detail target
├── messages/page.tsx                # shared conversation inbox
├── candidate/
│   ├── dashboard/page.tsx           # browse and bid
│   ├── bids/page.tsx                # candidate bid pipeline
│   ├── work/page.tsx                # awarded and active work
│   └── profile/page.tsx             # candidate profile
└── client/
    ├── dashboard/page.tsx           # client overview
    ├── jobs/new/page.tsx            # create a job
    ├── jobs/page.tsx                # client-owned jobs
    ├── applications/page.tsx        # applicant review and approval
    ├── work/page.tsx                # active hires and milestones
    └── profile/page.tsx             # client profile
```

## Source ownership

```text
src/
├── candidate/                       # candidate-only UI, hooks, and view models
├── client/                          # client-only UI, hooks, and view models
└── shared/
    ├── auth/                        # auth/session boundary
    ├── components/                  # reusable marketplace components
    ├── data/                        # demo fixtures only
    ├── job-rooms/                   # marketplace state boundary (replace with API)
    ├── types/                       # domain contracts shared by all roles
    └── workspace/                   # future conversations, bids, and milestones
```

The demo currently uses React context and local state. The contexts are
deliberately kept behind domain-shaped methods (`applyToJob`, `postJobRoom`,
`sendChatMessage`, `approveProposal`) so an API client can replace them without
rewriting page components.

## Domain entities to preserve when the backend is added

`User`, `CandidateProfile`, `ClientProfile`, `Job`, `Bid`, `Conversation`,
`Message`, `Contract`, `Milestone`, `WorkSubmission`, and `Notification`.

Every entity should have an owner, lifecycle status, timestamps, and stable IDs.
Do not put server data directly in page components; add it to a shared domain
context or query hook first.

## Marketplace benchmark and product decision

OpenSeat is closest to a hybrid of three established marketplace patterns:

| Benchmark | What it does well | What OpenSeat borrows |
| --- | --- | --- |
| [Upwork proposal review](https://support.upwork.com/hc/en-us/articles/18010402882195--Review-job-proposals) | Structured proposals, shortlist/message/hire/decline/archive actions, and proposal tabs | Proposal lifecycle, comparison actions, and room-scoped review history |
| [Upwork fixed-price protection](https://support.upwork.com/hc/en-us/articles/211062568-How-Upwork-protects-your-payments) | Funded milestones, submission for approval, change requests, automatic release, and dispute assistance | Milestone state machine, escrow status, delivery history, and dispute boundary |
| [Toptal screening](https://www.toptal.com/top-3-percent) | Quality gate before a candidate enters the high-trust network | Identity/quality signals and a future verification service boundary |
| [Fiverr order workflow](https://help.fiverr.com/hc/en-us/articles/37552517993105-The-complete-guide-to-your-Fiverr-order-Statuses-and-process) | Explicit active, delivered, revision, completed, late, cancelled, and review states | Post-hire room statuses, delivery review, revisions, completion, and reviews |

The conclusion is not to copy one competitor. OpenSeat should combine Upwork's
proposal and contract mechanics, Toptal's trust layer, and Fiverr's explicit
delivery state machine around one durable job-room object.

## Current frontend judgement

Before this pass, OpenSeat had a useful route skeleton and a credible design
system, but it was not yet enterprise-ready as a marketplace foundation:

- A proposal was only a rate, cover letter, and status, which made comparison shallow.
- The job brief lived in `JobRoomRecord`, while proposals and messages lived in a separate registry.
- Client review was effectively approve-or-chat; shortlist, reject, invite, compare, and private notes were missing.
- Active Work and Managed Work rendered hard-coded milestone cards instead of a contract lifecycle.
- Payment verification existed as a display field, but there was no escrow, release, review, or dispute state.
- Candidate Dashboard and Find Work both behaved like discovery pages.

The frontend now has a room-level workflow boundary in
`src/shared/types/job-room.ts` and `JobRoomsContext.tsx`. `JobRoomRecord`
contains the job brief and a `JobRoomWorkflow` containing proposals, messages,
the selected candidate, milestones, files, delivery history, trust/payment
state, disputes, reviews, and work status. `applicationsRegistry` remains as a
compatibility-shaped read model for existing components, but the room workflow
is the source of truth.

## Target room lifecycle

```text
Open
  -> Reviewing
  -> Shortlisted / Invited / In Discussion
  -> Awarded
  -> In Progress
  -> In Review
  -> Completed

Any active stage -> Disputed -> In Progress or Completed
```

The proposal lifecycle is separate from the work lifecycle so multiple
candidates can be reviewed without corrupting the selected contract:

```text
Pending -> In Discussion -> Shortlisted -> Invited -> Approved
                                      \-> Rejected / Archived
```

## Production seams still required

The current implementation is an intentionally complete frontend demo, not a
payment or identity provider. Before production, keep the UI contracts but
replace the local provider with these server-owned boundaries:

1. Auth and authorization: server sessions, role checks, organization/team membership, audit logs, and account recovery.
2. Marketplace API: paginated room search, proposal submission, invitations, review actions, and optimistic-concurrency versioning.
3. Contract service: immutable accepted terms, milestone revisions, funding intents, releases, refunds, and idempotency keys.
4. Trust service: KYC/identity verification, payment-method verification, risk holds, sanctions checks, and webhook reconciliation.
5. File service: signed upload/download URLs, malware scanning, retention policy, permissions, and file versioning.
6. Delivery and dispute service: submissions, review windows, change requests, evidence bundles, support queues, and resolution outcomes.
7. Notifications and analytics: outbox events for proposal updates, milestone deadlines, payment events, disputes, and review requests.

The most important invariant is that money, identity, and dispute state must be
server-authoritative. The React context can model those states for UX and
testing, but it must never be the authority that releases funds or declares a
user verified.
