# OpenSeat — Command Guide

Everything you need to set up, run, check, and audit this monorepo.

> **Run every command from the repo root.** You never need to `cd` into an app. `bun run dev` starts every frontend and the API together. Each app also has its own root script (`bun run dev:opened`, `bun run dev:admin`, `bun run dev:admin-api`, …), and anything else can target one workspace with `bun --filter <name> <script>`.

> **bun only.** Never use npm, yarn, or pnpm, and never commit `package-lock.json`, `yarn.lock`, or `pnpm-lock.yaml`. The only lockfile is `bun.lock` at the root.

---

## 1. What's in the repo

| Workspace                 | Path                      | What it is                                                 | Dev port | Root dev script         |
| ------------------------- | ------------------------- | ---------------------------------------------------------- | -------- | ----------------------- |
| `opened-frontend`         | `opened-frontend/`        | Opened job platform — candidate + employer modes (Next.js) | 3002     | `bun run dev:opened`    |
| `connected-frontend`      | `connected-frontend/`     | OpenSeat web app (Next.js)                                 | 3000     | `bun run dev:app`       |
| `openseat-theme`          | `openseat-theme/`         | Design-system showcase (Next.js)                           | 3001     | `bun run dev:theme`     |
| `opened-admin`            | `opened-admin/`           | Opened admin UI (Next.js, not a bun workspace)             | 3010     | `bun run dev:admin`     |
| `opened-backend`          | `opened-backend/`         | Opened API (Go)                                            | 8080     | `bun run dev:admin-api` |
| `@openseat/design-system` | `packages/design-system/` | Shared UI package (Astryx components, tokens, theme)       | —        | —                       |

Apps use the design system through the workspace (`"@openseat/design-system": "workspace:*"`), so edits in `packages/design-system` show up in every running app immediately. `opened-admin` and `opened-backend` sit beside those workspaces: the admin app is started with `bun --cwd`, and the API is a Go server.

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
    "packages": ["connected-frontend", "openseat-theme", "opened-frontend", "packages/*"],
    "catalog": { "next": "16.3.6", "react": "19.3.0", "typescript": "5.9.3" /* … */ }
  }
  ```
- Each workspace's `package.json` still lists **which** libraries it uses — but never a version:
  ```jsonc
  "dependencies": { "next": "catalog:", "react": "catalog:", "@openseat/design-system": "workspace:*" }
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
   // opened-frontend/package.json → dependencies
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
cd OpenSeat
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

One command starts every frontend and the API. From the repo root:

```bash
bun run dev
```

| Name                   | URL                   | Log prefix |
| ---------------------- | --------------------- | ---------- |
| OpenSeat app           | http://localhost:3000 | `[app]`    |
| Design-system showcase | http://localhost:3001 | `[theme]`  |
| Opened (job platform)  | http://localhost:3002 | `[opened]` |
| Opened admin           | http://localhost:3010 | `[admin]`  |
| Opened API             | http://127.0.0.1:8080 | `[api]`    |

Ctrl+C stops all of them. The API reads `opened-backend/.env` (copy `opened-backend/.env.example`). It needs `MONGO_URI`; if that file is missing, the API line exits and the frontends keep running.

### Open one app

| App                    | Command                 | Then open             |
| ---------------------- | ----------------------- | --------------------- |
| Opened (job platform)  | `bun run dev:opened`    | http://localhost:3002 |
| OpenSeat app           | `bun run dev:app`       | http://localhost:3000 |
| Design-system showcase | `bun run dev:theme`     | http://localhost:3001 |
| Opened admin           | `bun run dev:admin`     | http://localhost:3010 |
| Opened API             | `bun run dev:admin-api` | http://127.0.0.1:8080 |

On macOS, open a running app in the browser:

```bash
open http://localhost:3002
open http://localhost:3000
open http://localhost:3001
open http://localhost:3010
open http://127.0.0.1:8080
```

For any other script in one workspace, use `--filter` with the workspace name:

```bash
bun --filter opened-frontend <script>
bun --filter @openseat/design-system <script>
```

### Opened: candidate and employer modes

- **First visit** shows "How will you use Opened?". The choice is saved in the `opened_mode` cookie.
- **Candidate mode** — `/` (job search), `/applications`, `/interviews`, `/resumes`, `/profile`, `/settings`, `/messages`.
- **Employer mode** — everything under `/company/*`. With `opened_mode=company`, visiting `/` redirects to `/company` (`opened-frontend/proxy.ts`).
- **Switch modes** from the account menu (top right): "Switch to hiring" / "Switch to job search".
- **See the picker again** — clear the cookie in the browser DevTools console, then reload:
  ```js
  document.cookie = "opened_mode=; path=/; max-age=0";
  ```

### Production build and start

| App                    | Build                  | Start                  |
| ---------------------- | ---------------------- | ---------------------- |
| Opened                 | `bun run build:opened` | `bun run start:opened` |
| OpenSeat app           | `bun run build:app`    | `bun run start:app`    |
| Design-system showcase | `bun run build:theme`  | `bun run start:theme`  |
| All three              | `bun run build`        | —                      |

`next start` serves on port 3000 by default. Pass `--port` to run next to a dev server:

```bash
bun run start:opened --port 3102
```

### Troubleshooting

- **Port already in use** — find the old process and stop it:
  ```bash
  lsof -iTCP:3002 -sTCP:LISTEN
  ```
  ```bash
  kill <PID>
  ```
- **A route 404s right after moving or renaming files** — the dev server cached the old route table. Stop the dev server, clear the app's cache, and start it again:
  ```bash
  rm -rf opened-frontend/.next
  ```
  ```bash
  bun run dev:opened
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
bun --filter opened-frontend lint
bun --filter opened-frontend typecheck
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
| Build applications                        | Production build of all three apps                                          |
| Commit conventions                        | commitlint on every commit and the PR title                                 |

---

## 6. Design system

Source: `packages/design-system/src/`.

- **Components** — `src/components/` (re-exported Astryx parts plus OpenSeat composites).
- **Tokens** — `src/styles/tokens.css` (color, spacing, type, radius, shadow).
- **Theme** — `src/theme/openseat.theme.ts`. After editing it, regenerate the built theme CSS:
  ```bash
  bun run theme:build
  ```
  This rewrites `src/theme/theme.css` and its generated neighbours. Commit them with the `.ts` change.

Apps import only from the package, e.g. `import { Button } from "@openseat/design-system"`. Never hardcode colors, spacing, or type — use tokens and components.

---

## 7. Performance and accessibility audit (Unlighthouse)

[Unlighthouse](https://unlighthouse.dev) runs Lighthouse against every route it can find. `@unlighthouse/cli` is already a root dev dependency, so you do not install it again.

Dev-server scores are misleadingly low (no minification, dev overlays). Build and start the app first, then audit that production server.

### Audit Opened

Terminal 1 — production server on port 3102, so it can sit next to `bun run dev`:

```bash
bun run build:opened
bun run start:opened --port 3102
```

Terminal 2 — scan every route, then open the report:

```bash
bun run audit:opened
```

Employer pages live under `/company`. Start the crawl there so Unlighthouse reaches them:

```bash
bun run audit:opened:company
```

### Audit each app

Use a production server for the app you care about (`bun run build:<app>` then `bun run start:<app>`), then:

| App                    | Audit command                  | Site it scans                 |
| ---------------------- | ------------------------------ | ----------------------------- |
| Opened                 | `bun run audit:opened`         | http://localhost:3102         |
| Opened employer pages  | `bun run audit:opened:company` | http://localhost:3102/company |
| OpenSeat app           | `bun run audit:app`            | http://localhost:3000         |
| Design-system showcase | `bun run audit:theme`          | http://localhost:3001         |
| Opened admin           | `bun run audit:admin`          | http://localhost:3010         |

`next start` listens on port 3000 unless you pass `--port`. Opened's audit script expects **3102** so it does not collide with the OpenSeat app. For the app, theme, or admin, start that one app on the port in the table (stop `bun run dev` first if that port is taken).

Any other site, including a deployed URL:

```bash
bun run audit -- --site https://your-site.com
```

`bun run audit` passes `--disable-dynamic-sampling`, so Unlighthouse scans every page, including ones that share a route pattern such as `/jobs/[id]`.

When a scan finishes, Unlighthouse opens the report in your browser. Reports go to `.unlighthouse/` (already gitignored).

`@unlighthouse/cli` does not install an `unlighthouse` command. The audit scripts run `tools/unlighthouse.mjs`, which starts `node_modules/@unlighthouse/cli/dist/cli.mjs`. For a faster, rougher pass, leave dynamic sampling on:

```bash
bun tools/unlighthouse.mjs --site http://localhost:3102
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
feat(opened-frontend): split candidate and employer modes
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

| I want to…                                      | Command                                                                                |
| ----------------------------------------------- | -------------------------------------------------------------------------------------- |
| Install everything                              | `bun install`                                                                          |
| Run everything (frontends + API)                | `bun run dev`                                                                          |
| Run Opened                                      | `bun run dev:opened` → http://localhost:3002                                           |
| Run the OpenSeat app                            | `bun run dev:app` → http://localhost:3000                                              |
| Run the design-system showcase                  | `bun run dev:theme` → http://localhost:3001                                            |
| Run the Opened admin UI                         | `bun run dev:admin` → http://localhost:3010                                            |
| Run the Opened API                              | `bun run dev:admin-api` → http://127.0.0.1:8080                                        |
| Open a running app (macOS)                      | `open http://localhost:3002`                                                           |
| Run any script in one workspace                 | `bun --filter <workspace> <script>`                                                    |
| Build / start Opened for production             | `bun run build:opened` then `bun run start:opened --port 3102`                         |
| Add a library                                   | Add to root `catalog`, then `"<lib>": "catalog:"` in the workspace, then `bun install` |
| Upgrade a library                               | Change it once in the root `catalog`, `bun install`, fix the code that breaks          |
| Check one version / one node_modules            | `bun run check:deps` (also runs in `bun run test` and CI)                              |
| Run every CI check locally                      | `bun run ci` (or `bun run ci lint test`)                                               |
| Lint / type-check everything                    | `bun run lint` · `bun run typecheck`                                                   |
| Format everything                               | `bun run format`                                                                       |
| Run tests                                       | `bun run test`                                                                         |
| Rebuild the theme CSS                           | `bun run theme:build`                                                                  |
| Audit Opened (after `start:opened --port 3102`) | `bun run audit:opened`                                                                 |
| Audit another site                              | `bun run audit -- --site <url>`                                                        |
| Reset installs from scratch                     | `rm -rf node_modules */node_modules packages/*/node_modules` then `bun install`        |
| Clear a stale dev cache                         | `rm -rf opened-frontend/.next`                                                         |
