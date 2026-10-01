# Marketplace App Routes

Route tree for the Joined marketplace. Role-specific UI lives in `src/candidate/` and `src/client/` — pages here are thin entry points only.

## URL Map

| URL                                | Owner     | Purpose                                                 |
| ---------------------------------- | --------- | ------------------------------------------------------- |
| `/marketplace`                     | Shared    | Role-based redirect hub                                 |
| `/marketplace/login`               | Shared    | Authentication                                          |
| `/marketplace/register`            | Shared    | Registration                                            |
| `/marketplace/join`                | Shared    | Role selection onboarding                               |
| `/marketplace/candidate/dashboard` | Candidate | Candidate home, job discovery, filters, and bidding     |
| `/marketplace/jobs`                | Candidate | Full job marketplace, detail drawer, and bid submission |
| `/marketplace/candidate/profile`   | Candidate | Candidate profile, rate, skills, and biography          |
| `/marketplace/candidate/bids`      | Candidate | Proposal statuses and links to jobs/messages            |
| `/marketplace/candidate/work`      | Candidate | Approved jobs and delivery stages                       |
| `/marketplace/messages`            | Candidate | Job-based client conversations                          |
| `/marketplace/client/dashboard`    | Client    | Post jobs, review applicants, message, and hire         |
| `/marketplace/client/profile`      | Client    | Account details and client workspace status             |
| `/marketplace/client/jobs/new`     | Client    | Publish a new job room                                  |
| `/marketplace/client/jobs`         | Client    | Review job rooms and applicant counts                   |
| `/marketplace/client/applications` | Client    | Compare applicants, chat, and approve hires             |
| `/marketplace/client/work`         | Client    | Approved hires and delivery stages                      |

## Layout Guards

- `candidate/layout.tsx` — redirects non-candidates away
- `client/layout.tsx` — redirects non-clients away
- Root `layout.tsx` — wraps all routes with auth + job room providers
