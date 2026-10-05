# Client Module (Job Hunter)

Owned by the **job hunter** side of the marketplace. A job hunter posts tasks to a board, bidders
contact the task owner in chat, and the job hunter assigns links from the admin-managed job pool
to the bidders they connect with. There is no bidder directory: every bidder relationship starts
from an inquiry on a task.

## Routes

| URL                                 | Page                                                 |
| ----------------------------------- | ---------------------------------------------------- |
| `/marketplace/client/dashboard`     | Overview, attention items, throughput                |
| `/marketplace/client/jobs`          | Task board (permanent and one-time tasks)            |
| `/marketplace/client/jobs/new`      | Task composer with bidder preview                    |
| `/marketplace/client/jobs/[taskId]` | Task detail: inquiries, bidders, assignments         |
| `/marketplace/client/bidders`       | Hiring pipeline: kanban board, one ticket per bidder |
| `/marketplace/client/calendar`      | Interview calendar: book, join, record outcomes      |
| `/marketplace/client/pool`          | Admin-managed job pool, assign links to bidders      |
| `/marketplace/client/work`          | Monitoring, QA review queue, bidder feedback         |
| `/marketplace/client/messages`      | Inquiry inbox, counter-offers, accept/decline        |
| `/marketplace/client/payments`      | Invoices, wallet, per-link payments                  |
| `/marketplace/client/notifications` | Activity feed                                        |
| `/marketplace/client/profile`       | Profile, interview availability, preferences         |

Route paths live in `src/shared/routes/hunter.ts`.

## Structure

```
src/client/
├── components/     # bidders, interviews, profile, dashboard, tasks, pool, monitoring, messages, billing, notifications, ui, charts
├── context/        # HunterContext: in-memory mock state and actions
├── data/           # Mock data (pool, bidders, tasks, inquiries, assignments, invoices)
├── hooks/          # useHunterMetrics: derived numbers shared by pages
├── lib/            # format + selectors
├── styles/         # hunter.css (design-token based)
└── types/          # hunter.ts
```

## Import Rules

✅ Allowed: `@/src/shared/*`, `sid-ui`
❌ Forbidden: `@/src/candidate/*`
