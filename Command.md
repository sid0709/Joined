# Joined — Command Guide

Everything you need to set up, run, check, and audit this monorepo.

> **Run every command from the repo root.** You never need to `cd` into an app. `bun run dev` starts every frontend and every API together. Each app also has its own root script (`bun run dev:joined`, `bun run dev:admin`, `bun run dev:admin-api`, …), and anything else can target one workspace with `bun --filter <name> <script>`.

> **bun only.** Never use npm, yarn, or pnpm, and never commit `package-lock.json`, `yarn.lock`, or `pnpm-lock.yaml`. The only lockfile is `bun.lock` at the root.

---

## 1. What's in the repo

| Workspace               | Path                      | What it is                                                                            | Dev port | Root dev script          |
| ----------------------- | ------------------------- | ------------------------------------------------------------------------------------- | -------- | ------------------------ |
| `joined-frontend`       | `joined-frontend/`        | Joined job platform — candidate + employer modes (Next.js)                            | 6002     | `bun run dev:joined`     |
| `connected-frontend`    | `connected-frontend/`     | Joined web app (Next.js)                                                              | 6004     | `bun run dev:app`        |
| `joined-theme`          | `joined-theme/`           | Design-system showcase (Next.js)                                                      | 6001     | `bun run dev:theme`      |
| `admin-frontend`        | `admin-frontend/`         | Joined admin console — moderation, jobs, companies (Next.js)                          | 6010     | `bun run dev:admin`      |
| `scoutwell-frontend`    | `scoutwell-frontend/`     | Scoutwell — scouts submit jobs and track rewards (Next.js)                            | 6003     | `bun run dev:scout`      |
| `joined-backend`        | `joined-backend/`         | Joined API (Go) for `joined-frontend`                                                 | 8080     | `bun run dev:joined-api` |
| `admin-backend`         | `admin-backend/`          | Admin API (Go) for `admin-frontend`                                                   | 8081     | `bun run dev:admin-api`  |
| `scoutwell-backend`     | `scoutwell-backend/`      | Scoutwell API (Go) for `scoutwell-frontend` and partners                              | 8082     | `bun run dev:scout-api`  |
| `backend-core`          | `backend-core/`           | Go code every API shares, and its own server: api.joinedhq.com (Acorn under `/acorn`) | 8083     | `bun run dev:core-api`   |
| `acorn-extension`       | `acorn/extension/`        | Acorn Chrome extension (Vite; load `acorn/extension/dist`)                            | —        | `bun run dev:acorn`      |
| `@joined/design-system` | `packages/design-system/` | Shared UI package (Astryx components, tokens, theme)                                  | —        | —                        |

Apps use the design system through the workspace (`"@joined/design-system": "workspace:*"`), so edits in `packages/design-system` show up in every running app immediately. The Go services (`joined-backend`, `admin-backend`, `scoutwell-backend`, and the shared `backend-core`, which also runs its own server for Acorn) sit beside those workspaces; `go.work` at the root ties them together. Shared TypeScript lives in `packages/design-system` (UI), `packages/scout` (the scout API contract), and `packages/job-schema` (job enums shared with the Go backend).

Other folders: `docs/` (product and architecture specs), `tools/` (repo checks), `.husky/` (git hooks).

---

## 2. Dependencies: one version, one `node_modules`

**This is a hard rule for the whole monorepo.**

1. **Every library has exactly one version across the entire repo.** All versions live in one place: the `catalog` in the root `package.json`.
2. **There is exactly one `node_modules` folder, at the repo root.** No app or package has its own. (`bunfig.toml` sets `linker = "hoisted"`.)
3. **When a dependency conflict comes up, fix the code — never install a second version.** No per-app pins, no nested `node_modules`, no aliased duplicates such as `next-old`. If one app needs a newer library, upgrade the catalog version once and update every app's code that breaks.

### How it's wired

- The root `package.json` holds the versions:
  ```jsonc
  "workspaces": {
    "packages": ["connected-frontend", "joined-theme", "joined-frontend", "packages/*"],
    "catalog": { "next": "16.3.6", "react": "19.3.0", "typescript": "5.9.3" /* … */ }
  }
  ```
- Each workspace's `package.json` still lists **which** libraries it uses — but never a version:
  ```jsonc
  "dependencies": { "next": "catalog:", "react": "catalog:", "@joined/design-system": "workspace:*" }
  ```
  Each workspace keeps its own `package.json` because that's what makes it a workspace: its name (for `--filter` and `workspace:*`), the list of libraries it's allowed to import, and its scripts (e.g. its dev port).
- `overrides` in the root `package.json` forces third-party packages onto our version when they'd otherwise pull their own (today: `@types/node`). Every override must equal its catalog version.

### Add a library

1. Add it to the root catalog with an **exact** version:
   ```jsonc
   // package.json → workspaces.catalog
   "zod": "4.1.12"
   ```
2. Reference it from each workspace that imports it:
   ```jsonc
   // joined-frontend/package.json → dependencies
   "zod": "catalog:"
   ```
3. Install from the root:
   ```bash
   bun install
   ```

Only list a library in the workspaces that actually import it. The `import/no-extraneous-dependencies` lint rule fails if code imports something its own `package.json` doesn't declare — with one shared `node_modules`, that import would otherwise work locally and break elsewhere.

### Upgrade a library

1. Change its version **once**, in the root catalog.
2. Reinstall and run the full check suite (section 5).
3. Fix every workspace whose code breaks. Don't pin the old version anywhere.

### How the rule is enforced

You don't have to remember it — three things check it automatically:

| Where                | What runs                             | When                           |
| -------------------- | ------------------------------------- | ------------------------------ |
| `bun run test`       | `tests/dependency-policy.test.js`     | Locally, and in CI's test job  |
| `bun run check:deps` | `tools/check-single-node-modules.mjs` | Locally, and in its own CI job |
| `bun run lint`       | `import/no-extraneous-dependencies`   | Locally, and in CI's lint job  |

The test and `check:deps` share one implementation (`tools/dependency-policy.mjs`). They fail when:

- a `package.json` has a version or range (`"16.3.6"`, `"^16"`) in `dependencies`, `devDependencies`, or `optionalDependencies` instead of `"catalog:"` or `"workspace:*"` — the root `package.json` included;
- a workspace uses `"catalog:"` for a library the catalog doesn't list;
- the catalog uses a range instead of an exact version;
- an entry in `overrides` doesn't match the catalog;
- any workspace has its own `node_modules`;
- a catalog library is installed at the wrong version, or a second copy exists anywhere in `node_modules`.

`peerDependencies` may keep ranges (e.g. `"react": ">=19"`) — they describe compatibility and install nothing.

```bash
bun run check:deps
```

### `bun.lock` — always commit it

The catalog pins every library **we** declare, but those libraries pull in hundreds of their own dependencies with version ranges. `bun.lock` records the exact version of every one of them, so every machine and CI installs the identical tree. CI installs with `bun install --frozen-lockfile`, which fails if `bun.lock` is missing or out of date — after changing any `package.json`, run `bun install` and commit the updated `bun.lock` with it.

> **Transitive dependencies** (libraries _our_ libraries depend on) sometimes need different major versions of the same package — e.g. ESLint and Unlighthouse want different `ajv` majors. Bun tucks those inside the depending package's folder under the root `node_modules`. That's outside our code, so it's allowed; the rule and `check:deps` cover every library we declare.

---

## 3. First-time setup

### Prerequisites

- **bun 1.4.2** — pinned in the root `package.json` (`packageManager`).
  ```bash
  curl -fsSL https://bun.sh/install | bash
  ```
  Check it:
  ```bash
  bun --version
  ```
- **git**, with access to `https://github.com/sid0709/OpenSeat.git`.

### Install

```bash
git clone https://github.com/sid0709/OpenSeat.git
cd Joined
bun install
```

One `bun install` at the root installs every workspace into the single root `node_modules`, and installs the git hooks (husky).

### After pulling changes

If any `package.json` or `bun.lock` changed:

```bash
bun install
```

### Start completely fresh

Use this when installs get into a strange state. Stop any running dev servers first.

```bash
rm -rf node_modules */node_modules packages/*/node_modules
bun install
bun run check:deps
```

---

## 4. Running the apps

### Development

One command starts every frontend and every API. From the repo root:

```bash
bun run dev
```

| Name                   | URL                   | Log prefix     |
| ---------------------- | --------------------- | -------------- |
| Joined app             | http://localhost:6004 | `[app]`        |
| Design-system showcase | http://localhost:6001 | `[theme]`      |
| Joined (job platform)  | http://localhost:6002 | `[joined]`     |
| Joined admin           | http://localhost:6010 | `[admin]`      |
| Joined API             | http://127.0.0.1:8080 | `[joined-api]` |
| Admin API              | http://127.0.0.1:8081 | `[admin-api]`  |
| Scoutwell API          | http://127.0.0.1:8082 | `[scout-api]`  |
| Core API (Acorn)       | http://127.0.0.1:8083 | `[core-api]`   |

Ctrl+C stops all of them. Each API reads its own `.env` (copy that folder's `.env.example`): `joined-backend/.env`, `admin-backend/.env`, `scoutwell-backend/.env`, `backend-core/.env`. Each needs `MONGO_URI`; an API without it exits and everything else keeps running. `bun run dev:api` starts only the four APIs.

### Open one app

| App                    | Command                  | Then open             |
| ---------------------- | ------------------------ | --------------------- |
| Joined (job platform)  | `bun run dev:joined`     | http://localhost:6002 |
| Joined app             | `bun run dev:app`        | http://localhost:6004 |
| Design-system showcase | `bun run dev:theme`      | http://localhost:6001 |
| Joined admin           | `bun run dev:admin`      | http://localhost:6010 |
| Joined API             | `bun run dev:joined-api` | http://127.0.0.1:8080 |
| Admin API              | `bun run dev:admin-api`  | http://127.0.0.1:8081 |
| Scoutwell API          | `bun run dev:scout-api`  | http://127.0.0.1:8082 |
| Core API (Acorn)       | `bun run dev:core-api`   | http://127.0.0.1:8083 |

On macOS, open a running app in the browser:

```bash
open http://localhost:6002
open http://localhost:6004
open http://localhost:6001
open http://localhost:6010
open http://127.0.0.1:8080/health
```

For any other script in one workspace, use `--filter` with the workspace name:

```bash
bun --filter joined-frontend <script>
bun --filter @joined/design-system <script>
```

### Joined: candidate and employer modes

- **First visit** shows "How will you use Joined?". The choice is saved in the `joined_mode` cookie.
- **Candidate mode** — `/` (job search), `/applications`, `/interviews`, `/resumes`, `/profile`, `/settings`, `/messages`.
- **Employer mode** — everything under `/company/*`. With `joined_mode=company`, visiting `/` redirects to `/company` (`joined-frontend/proxy.ts`).
- **Switch modes** from the account menu (top right): "Switch to hiring" / "Switch to job search".
- **See the picker again** — clear the cookie in the browser DevTools console, then reload:
  ```js
  document.cookie = "joined_mode=; path=/; max-age=0";
  ```

### Production build and start

| App                    | Build                     | Start                  |
| ---------------------- | ------------------------- | ---------------------- |
| Connected              | `bun run build:app`       | `bun run start:app`    |
| Joined                 | `bun run build:joined`    | `bun run start:joined` |
| Scoutwell              | `bun run build:scout`     | `bun run start:scout`  |
| Joined admin           | `bun run build:admin`     | `bun run start:admin`  |
| Design-system showcase | `bun run build:theme`     | `bun run start:theme`  |
| All four frontends     | `bun run build:frontends` | start each `start:*`   |
| Every workspace        | `bun run build`           | —                      |

`start:joined` and `start:scout` pass `--port` **6002** and **6003** so they match dev and can run beside Connected on **6004**.

### Troubleshooting

- **Port already in use** — `bun run dev`, `bun run start:frontends`, and each `bun run dev:*` / `bun run start:*` stop whatever is listening on that app's port before starting. If something else grabbed the port afterward:
  ```bash
  lsof -iTCP:6002 -sTCP:LISTEN
  ```
  ```bash
  kill <PID>
  ```
- **A route 404s right after moving or renaming files** — the dev server cached the old route table. Stop the dev server, clear the app's cache, and start it again:
  ```bash
  rm -rf joined-frontend/.next
  ```
  ```bash
  bun run dev:joined
  ```
- **`next build` fails type-checking on `.next/dev/types/...`** — stale files from a dev server. Stop the dev server, clear `.next` as above, then build again.
- **Hydration warning mentioning an attribute you don't recognise** (e.g. `data-job-bid-hooked`) — a browser extension is editing the page. Try an incognito window.

---

## 5. Checks

Run exactly what CI runs before pushing:

```bash
bun run ci
```

It runs every CI job in order, keeps going when one fails, and ends with a pass/fail summary. Run only some jobs by naming them — `lint`, `format`, `typecheck`, `dependencies`, `test`, `build`, `commits`:

```bash
bun run ci lint test
```

`commits` runs commitlint on what your branch adds on top of `origin/main` (`git fetch` first; set `CI_BASE_REF` to compare against another ref). The individual checks it runs:

| Command                     | What it checks                                                                                                                                                                              |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `bun run lint`              | ESLint in every workspace (`lint:workspaces`) and in `tools/` + `tests/` (`lint:repo`), zero warnings allowed.                                                                              |
| `bun run lint:fix`          | Same, auto-fixing what it can.                                                                                                                                                              |
| `bun run typecheck`         | `tsc --noEmit` in every workspace.                                                                                                                                                          |
| `bun run format:check`      | Prettier. Fix with `bun run format`.                                                                                                                                                        |
| `bun run test`              | Every `*.test.*` file — workspace unit tests plus the repo-level `tests/` (including the dependency rule) — with coverage (must stay ≥ 80%, see `bunfig.toml`), then the test-policy check. |
| `bun run check:deps`        | One version per library, one root `node_modules` (section 2).                                                                                                                               |
| `bun run check:boundaries`  | Workspaces don't reach into each other's files; shared code goes through `packages/*`.                                                                                                      |
| `bun run check:test-policy` | No committed `.skip`, `.only`, `.todo`, `fdescribe`, `xit`, and the like.                                                                                                                   |
| `bun run build`             | Production build of all three apps.                                                                                                                                                         |

To check a single workspace:

```bash
bun --filter joined-frontend lint
bun --filter joined-frontend typecheck
```

Run only the repo-level tests (e.g. the dependency rule):

```bash
bun test tests
```

### CI

`.github/workflows/ci.yml` runs on every pull request and every push to `main`, after `bun install --frozen-lockfile`. Each job calls `bun run ci <job>`, so the steps are defined once in `tools/ci.mjs` and `bun run ci` locally runs the same thing. Workspace tasks go through `turbo run`, which picks up every workspace listed in the root `package.json` — adding or renaming a workspace needs no CI change.

| Job                                       | Runs                                                                        |
| ----------------------------------------- | --------------------------------------------------------------------------- |
| Lint and workspace boundaries             | Lint in all four workspaces, lint `tools/` and `tests/`, `check:boundaries` |
| Check formatting                          | `format:check`                                                              |
| Typecheck all workspaces                  | `typecheck` in all four workspaces                                          |
| One version per library, one node_modules | `check:deps`                                                                |
| Test and coverage                         | `bun run test` (includes `tests/dependency-policy.test.js`)                 |
| Vet and test Go                           | `bun run vet:go` then `bun run test:go`                                     |
| Build applications                        | Production build of all three apps                                          |
| Commit conventions                        | commitlint on every commit and the PR title                                 |

---

## 6. Design system

Source: `packages/design-system/src/`.

- **Components** — `src/components/` (re-exported Astryx parts plus Joined composites).
- **Tokens** — `src/styles/tokens.css` (color, spacing, type, radius, shadow).
- **Theme** — `src/theme/joined.theme.ts`. After editing it, regenerate the built theme CSS:
  ```bash
  bun run theme:build
  ```
  This rewrites `src/theme/theme.css` and its generated neighbours. Commit them with the `.ts` change.
- **Brand** — `src/brand/`: `JoinedLogo` (the wordmark) and `JoinedMark` (the app icon and bare symbol), drawn from the masters in `Joined-Logo/`. Use the wordmark where the product is named on its own, and the app icon beside a sub-product name.
- **App icons** — every app's `app/favicon.ico`, `app/icon.svg`, and `app/apple-icon.png` come from `Joined-Logo/3-App-Icon-D-Link`. After changing the artwork, regenerate them:
  ```bash
  bun run brand:icons
  ```

Apps import only from the package, e.g. `import { Button } from "@joined/design-system"`. Never hardcode colors, spacing, or type — use tokens and components.

---

## 7. Performance and accessibility audit (Unlighthouse)

[Unlighthouse](https://unlighthouse.dev) runs Lighthouse against every route it can find. `@unlighthouse/cli` is already a root dev dependency, so you do not install it again.

Dev-server scores are misleadingly low (no minification, dev overlays). Build and start the app first, then audit that production server.

### Audit all frontends (except theme)

`bun run audit` runs Unlighthouse against **connected-frontend**, **joined-frontend**, **scoutwell-frontend**, and **admin-frontend** in sequence. **joined-theme** is not included (`bun run audit:theme` if you need it).

Terminal 1 — build, then start every production frontend on the same ports as `bun run dev` (`start:frontends` frees those ports first):

```bash
bun run build:frontends
bun run start:frontends
```

Individual `bun run dev:*` and `bun run start:*` scripts also free that app's port before launching.

Terminal 2 — crawl and Lighthouse each app (reports under `.unlighthouse/<workspace-name>/`):

```bash
bun run audit
```

### Audit one app

Build and start only that app (`bun run build:<app>` then `bun run start:<app>`), then:

| App                    | Audit command                  | Site it scans                 |
| ---------------------- | ------------------------------ | ----------------------------- |
| Connected              | `bun run audit:app`            | http://localhost:6004         |
| Joined                 | `bun run audit:joined`         | http://localhost:6002         |
| Joined employer pages  | `bun run audit:joined:company` | http://localhost:6002/company |
| Scoutwell              | `bun run audit:scout`          | http://localhost:6003         |
| Joined admin           | `bun run audit:admin`          | http://localhost:6010         |
| Design-system showcase | `bun run audit:theme`          | http://localhost:6001         |

Any other site, including a deployed URL:

```bash
bun run audit -- --site https://your-site.com
```

`bun run audit` passes `--disable-dynamic-sampling`, so Unlighthouse scans every page, including ones that share a route pattern such as `/jobs/[id]`.

Each run writes a static HTML report under `.unlighthouse/<app>/` (gitignored). Preview with `bunx sirv-cli .unlighthouse/connected-frontend` (or the app folder you care about).

`@unlighthouse/cli` does not install an `unlighthouse` command. Targets live in `tools/audit-frontends.mjs`; `bun run audit` uses `tools/audit-all-frontends.mjs`. For a faster, rougher pass on one site, leave dynamic sampling on:

```bash
bun tools/unlighthouse.mjs --site http://localhost:6002
```

---

## 8. Git workflow

### Branches

```bash
git checkout main
git pull
git checkout -b feat/<short-name>
```

Open a pull request back into `main`.

### Hooks (installed by `bun install`)

| Hook         | Runs                     | Effect                                            |
| ------------ | ------------------------ | ------------------------------------------------- |
| `pre-commit` | `bunx lint-staged`       | Prettier formats staged files automatically       |
| `commit-msg` | `bunx commitlint --edit` | Rejects messages that aren't Conventional Commits |

### Commit messages

[Conventional Commits](https://www.conventionalcommits.org) — `type(scope): summary`.

```text
feat(joined-frontend): split candidate and employer modes
fix(design-system): stop nested grid columns inheriting spans
build: unify dependency versions in a root catalog
docs: update command guide
```

Common types: `feat`, `fix`, `docs`, `build`, `refactor`, `style`, `test`, `chore`, `perf`.

### Push

```bash
git push -u origin feat/<short-name>
```

---

## 9. Quick reference

| I want to…                            | Command                                                                                |
| ------------------------------------- | -------------------------------------------------------------------------------------- |
| Install everything                    | `bun install`                                                                          |
| Run everything (frontends + APIs)     | `bun run dev`                                                                          |
| Run Joined                            | `bun run dev:joined` → http://localhost:6002                                           |
| Run the Joined app                    | `bun run dev:app` → http://localhost:6004                                              |
| Run the design-system showcase        | `bun run dev:theme` → http://localhost:6001                                            |
| Run the Joined admin UI               | `bun run dev:admin` → http://localhost:6010                                            |
| Run every API                         | `bun run dev:api`                                                                      |
| Run the Joined API                    | `bun run dev:joined-api` → http://127.0.0.1:8080                                       |
| Run the admin API                     | `bun run dev:admin-api` → http://127.0.0.1:8081                                        |
| Run the Scoutwell API                 | `bun run dev:scout-api` → http://127.0.0.1:8082                                        |
| Run the core API (Acorn's `/acorn/*`) | `bun run dev:core-api` → http://127.0.0.1:8083                                         |
| Build the Acorn extension             | `bun run build:acorn` (watch: `bun run dev:acorn`)                                     |
| Test / vet every Go module            | `bun run test:go` · `bun run vet:go`                                                   |
| Open a running app (macOS)            | `open http://localhost:6002`                                                           |
| Run any script in one workspace       | `bun --filter <workspace> <script>`                                                    |
| Build / start all frontends for audit | `bun run build:frontends` then each `bun run start:*` (see §7)                         |
| Add a library                         | Add to root `catalog`, then `"<lib>": "catalog:"` in the workspace, then `bun install` |
| Upgrade a library                     | Change it once in the root `catalog`, `bun install`, fix the code that breaks          |
| Check one version / one node_modules  | `bun run check:deps` (also runs in `bun run test` and CI)                              |
| Run every CI check locally            | `bun run ci` (or `bun run ci lint test`)                                               |
| Lint / type-check everything          | `bun run lint` · `bun run typecheck`                                                   |
| Format everything                     | `bun run format`                                                                       |
| Run tests                             | `bun run test`                                                                         |
| Rebuild the theme CSS                 | `bun run theme:build`                                                                  |
| Regenerate app icons from the logo    | `bun run brand:icons`                                                                  |
| Audit all frontends (no theme)        | `bun run audit` (after production servers are up)                                      |
| Audit one frontend                    | `bun run audit:joined` · `audit:app` · `audit:scout` · `audit:admin`                   |
| Audit another site only               | `bun run audit -- --site <url>`                                                        |
| Reset installs from scratch           | `rm -rf node_modules */node_modules packages/*/node_modules` then `bun install`        |
| Clear a stale dev cache               | `rm -rf joined-frontend/.next`                                                         |
