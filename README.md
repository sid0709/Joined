# Joined

Permissioned help marketplace (Athens AI sibling). Hunters open jobs; allowed bidders help.

Juniors own product work. Core/platform changes need owner review.

## What's here

A **bun workspaces monorepo**:

| Workspace               | What it is                                                              | Run it                                           |
| ----------------------- | ----------------------------------------------------------------------- | ------------------------------------------------ |
| `joined-frontend`       | Joined job platform — candidate and employer modes                      | `bun run dev:joined` → http://localhost:3002     |
| `connected-frontend`    | Joined web app                                                          | `bun run dev:app` → http://localhost:3000        |
| `joined-theme`          | Design-system showcase                                                  | `bun run dev:theme` → http://localhost:3001      |
| `scoutwell-frontend`    | Scoutwell — scouts submit jobs and earn on outcomes                     | `bun run dev:scout` → http://localhost:3003      |
| `admin-frontend`        | Admin console — review queue, scouts, jobs                              | `bun run dev:admin` → http://localhost:3010      |
| `joined-backend`        | Joined API (Go) — accounts, job search, hunter and recruiter workspaces | `bun run dev:joined-api` → http://127.0.0.1:8080 |
| `admin-backend`         | Admin API (Go) — staff routes behind the admin console                  | `bun run dev:admin-api` → http://127.0.0.1:8081  |
| `scoutwell-backend`     | Scoutwell API (Go) — scout accounts, submissions, partner API keys      | `bun run dev:scout-api` → http://127.0.0.1:8082  |
| `backend-core`          | Shared Go code the three APIs build on                                  | used by every API                                |
| `@joined/design-system` | Shared UI package (`packages/design-system`)                            | used by every app                                |
| `@joined/scout`         | Scout API contract (`packages/scout`)                                   | Scoutwell and the admin console                  |
| `@joined/job-schema`    | Job enums shared with the Go API (`packages/job-schema`)                | every job-related app                            |

### Backend services

Each app has its own Go API that runs and deploys on its own. The apps call their API from the server only.

| App                            | API                        | Serves                                                                                                |
| ------------------------------ | -------------------------- | ----------------------------------------------------------------------------------------------------- |
| `joined-frontend`              | `joined-backend` (8080)    | `/v1/auth` (hunters, recruiters), `/v1/search`, `/v1/me`, `/v1/company`, `/v1/schedule`               |
| `admin-frontend`               | `admin-backend` (8081)     | `/v1/settings`, `/v1/jobs`, `/v1/companies`, `/v1/reports`, `/v1/admin/*`; all need `ADMIN_API_TOKEN` |
| `scoutwell-frontend`, partners | `scoutwell-backend` (8082) | `/v1/auth` (scouts), `/v1/scout/*`                                                                    |

All three share one MongoDB and build on `backend-core`: the domain stores, the HTTP helpers, and the sign-in routes. A rule that crosses domains, like deleting an account, behaves the same whichever API runs it. Each service reads its own `.env` (copy its `.env.example`). `bun run dev:api` starts all three; `bun run test:go` tests every Go module.

### Production

Merging to `main` builds every service into a Docker image and deploys Joined to https://joinedhq.com. How it works, and every setting the GitHub `production` environment needs, is in [deploy/README.md](deploy/README.md).

### Scout pipeline setup

1. `admin-backend/.env`: set `ADMIN_API_TOKEN` (e.g. `openssl rand -hex 32`). Without it the staff endpoints are open.
2. `admin-frontend/.env.local`: `ADMIN_API_URL` and the same `ADMIN_API_TOKEN` (see `admin-frontend/.env.example`).
3. `scoutwell-frontend/.env.local`: `SCOUTWELL_API_URL` (see `scoutwell-frontend/.env.example`).

Partners submit jobs over the Scoutwell API with keys from Scoutwell → API access; see [docs/61-scout-api.md](docs/61-scout-api.md).

Product and architecture specs live in [`docs/`](docs/README.md).

## Quick start

```bash
bun install
bun run dev:joined
```

Run everything from the **repo root** — no need to `cd` into an app. The full command guide (setup, running each app, checks, audits, git workflow) is in **[Command.md](Command.md)**.

## Dependency rule: one version, one `node_modules`

- **Every library has exactly one version across the whole monorepo**, declared once in the `catalog` of the root `package.json`. Workspaces reference it as `"catalog:"` and never pin their own version.
- **There is one `node_modules`, at the root.** No app or package has its own.
- **When a dependency conflict appears, update the code — never install a second version of the same library.**

This is enforced automatically — you can't merge a mistake by accident:

- **`bun run test`** includes `tests/dependency-policy.test.js`, which fails if any `package.json` has a version number or range (e.g. `"next": "16.3.6"`) instead of `"catalog:"`, or if a second copy of a library is installed.
- **`bun run check:deps`** runs the same rules on their own.
- **CI** runs both on every pull request, plus the `import/no-extraneous-dependencies` lint rule.

Always commit **`bun.lock`**: it pins the exact version of every indirect dependency too, and CI installs with `--frozen-lockfile`.

See [Command.md → Dependencies](Command.md#2-dependencies-one-version-one-node_modules) for how to add or upgrade a library.

## Other conventions

- **bun only** — never npm, yarn, or pnpm. The only lockfile is `bun.lock`.
- **No hardcoding** — colors, spacing, and type come from design tokens; URLs and flags from config.
- **Shared code goes in `packages/*`**, never copied between apps.
- **Conventional Commits** — enforced by the `commit-msg` hook.

Day-to-day rules (coding, running, checks, tests, commits, pull requests): [`guide.md`](guide.md).

Details: [`CLAUDE.md`](.claude/CLAUDE.md), [`docs/CONTRIBUTING.md`](docs/CONTRIBUTING.md), [`docs/CODING_STYLE.md`](docs/CODING_STYLE.md).
