# OpenSeat

Permissioned help marketplace (Athens AI sibling). Hunters open jobs; allowed bidders help.

Juniors own product work. Core/platform changes need owner review.

## What's here

A **bun workspaces monorepo**:

| Workspace                 | What it is                                               | Run it                                          |
| ------------------------- | -------------------------------------------------------- | ----------------------------------------------- |
| `opened-frontend`         | Opened job platform — candidate and employer modes       | `bun run dev:opened` → http://localhost:3002    |
| `connected-frontend`      | OpenSeat web app                                         | `bun run dev:app` → http://localhost:3000       |
| `openseat-theme`          | Design-system showcase                                   | `bun run dev:theme` → http://localhost:3001     |
| `scoutwell-frontend`      | Scoutwell — scouts submit jobs and earn on outcomes      | `bun run dev:scout` → http://localhost:3003     |
| `opened-admin`            | Admin console — review queue, scouts, jobs               | `bun run dev:admin` → http://localhost:3010     |
| `opened-backend`          | Opened API (Go) — jobs, accounts, scout pipeline         | `bun run dev:admin-api` → http://127.0.0.1:8080 |
| `@openseat/design-system` | Shared UI package (`packages/design-system`)             | used by every app                               |
| `@openseat/scout`         | Scout API contract (`packages/scout`)                    | Scoutwell and the admin console                 |
| `@openseat/job-schema`    | Job enums shared with the Go API (`packages/job-schema`) | every job-related app                           |

### Scout pipeline setup

1. `opened-backend/.env`: set `ADMIN_API_TOKEN` (e.g. `openssl rand -hex 32`). Without it the staff endpoints are open.
2. `opened-admin/.env.local`: `ADMIN_API_URL` and the same `ADMIN_API_TOKEN` (see `opened-admin/.env.example`).
3. `scoutwell-frontend/.env.local`: `OPENED_API_URL` (see `scoutwell-frontend/.env.example`).

Partners submit jobs over the same API with keys from Scoutwell → API access; see [docs/61-scout-api.md](docs/61-scout-api.md).

Product and architecture specs live in [`docs/`](docs/README.md).

## Quick start

```bash
bun install
bun run dev:opened
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
