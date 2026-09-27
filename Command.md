# OpenSeat — Command Guide

Everything you need to set up, run, check, and audit this monorepo. Run commands from the **repo root** unless a step says otherwise.

> **bun only.** Never use npm, yarn, or pnpm, and never commit `package-lock.json`, `yarn.lock`, or `pnpm-lock.yaml`. The lockfile is `bun.lock`.

---

## 1. What's in the repo

| Workspace                 | Path                      | What it is                                                 | Dev port |
| ------------------------- | ------------------------- | ---------------------------------------------------------- | -------- |
| `openseat-frontend`       | `openseat-frontend/`      | OpenSeat web app (Next.js)                                 | 3000     |
| `openseat-theme`          | `openseat-theme/`         | Design-system showcase (Next.js)                           | 3001     |
| `opened-frontend`         | `opened-frontend/`        | Opened job platform — candidate + employer modes (Next.js) | 3002     |
| `@openseat/design-system` | `packages/design-system/` | Shared UI package (Astryx-based components, tokens, theme) | —        |

Apps depend on `@openseat/design-system` through the workspace (`workspace:*`), so changes in `packages/design-system` show up in every app's dev server without publishing.

Other folders: `docs/` (product and architecture specs), `tools/` (repo checks), `.husky/` (git hooks).

---

## 2. First-time setup

### Prerequisites

- **bun 1.4.2** — the version is pinned in `package.json` (`packageManager`).
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

`bun install` installs every workspace at once and runs `prepare`, which installs the git hooks (husky). You don't need to install inside each app folder.

### Keeping dependencies current

After pulling changes that touch any `package.json` or `bun.lock`:

```bash
bun install
```

Add a dependency to one workspace (run from the root):

```bash
bun add <pkg> --cwd opened-frontend
bun add -d <pkg> --cwd opened-frontend
```

Or `cd` into the workspace and run `bun add <pkg>` there.

---

## 3. Running the apps

Each app is a Next.js dev server. Run one per terminal tab.

### Opened — job platform (port 3002)

```bash
bun run --cwd opened-frontend dev
```

Open http://localhost:3002.

- **First visit** shows the "How will you use Opened?" picker. The choice is saved in the `opened_mode` cookie.
- **Candidate mode** lives at `/` (job search), `/applications`, `/interviews`, `/resumes`, `/profile`, `/settings`, `/messages`.
- **Employer mode** lives under `/company/*`. With `opened_mode=company`, visiting `/` redirects to `/company` (see `opened-frontend/proxy.ts`).
- **Switch modes** from the account menu (top right): "Switch to hiring" / "Switch to job search".
- **See the picker again:** clear the cookie in the browser DevTools console, then reload:
  ```js
  document.cookie = "opened_mode=; path=/; max-age=0";
  ```

### OpenSeat app (port 3000)

```bash
bun run --cwd openseat-frontend dev
```

Open http://localhost:3000.

### Design-system showcase (port 3001)

```bash
bun run --cwd openseat-theme dev
```

Open http://localhost:3001. Use it to preview components and tokens from `packages/design-system`.

### Filter syntax (same result)

`--filter` targets a workspace by its package name and works from anywhere in the repo:

```bash
bun run --filter opened-frontend dev
bun run --filter openseat-frontend dev
bun run --filter openseat-theme dev
```

### Production build and start (one app)

```bash
bun run --cwd opened-frontend build
bun run --cwd opened-frontend start
```

`next start` serves on port 3000 by default. Pass a port to avoid clashing with another app:

```bash
bun run --cwd opened-frontend start --port 3102
```

### Dev server troubleshooting

- **Port already in use** — find and stop the old process:
  ```bash
  lsof -iTCP:3002 -sTCP:LISTEN
  ```
  ```bash
  kill <PID>
  ```
- **A route 404s right after moving or renaming files** — the dev server cached the old route table. Stop the server, clear its cache, and start it again:
  ```bash
  rm -rf opened-frontend/.next
  ```
  ```bash
  bun run --cwd opened-frontend dev
  ```
- **`next build` fails type-checking on `.next/dev/types/...`** — those are stale files from a running dev server. Stop the dev server, run the `rm -rf .next` step above, then build again.
- **Hydration warning mentioning an attribute you don't recognise** (e.g. `data-job-bid-hooked`) — a browser extension is editing the page. Try an incognito window.

---

## 4. Checks: lint, types, format, tests

### Whole repo

```bash
bun run lint
bun run typecheck
bun run format:check
bun run test
```

Auto-fix what can be fixed:

```bash
bun run lint:fix
bun run format
```

> The root `lint`, `typecheck`, and `build` scripts cover `openseat-frontend`, `openseat-theme`, and `@openseat/design-system`. Check **`opened-frontend`** with its own commands below.

### One workspace

```bash
bun run --cwd opened-frontend lint
bunx tsc --noEmit -p opened-frontend/tsconfig.json
bun run --cwd openseat-frontend typecheck
bun run --cwd openseat-theme typecheck
bun run --filter @openseat/design-system typecheck
bun run --filter @openseat/design-system lint
```

### Repo policy checks

```bash
bun run check:boundaries
bun run check:test-policy
```

- `check:boundaries` — workspaces can't reach into each other's files; shared code goes through `packages/*`.
- `check:test-policy` — no committed `.skip`, `.only`, `.todo`, `fdescribe`, `xit`, and the like.
- `bun run test` also enforces **80%** coverage (`bunfig.toml`).

> Both checks currently scan `openseat-frontend`, `openseat-theme`, and `packages/design-system` — not `opened-frontend` yet.

### Build everything the root build covers

```bash
bun run build
```

---

## 5. Design system

Source: `packages/design-system/src/`.

- **Components** — `src/components/` (re-exported Astryx parts plus OpenSeat composites).
- **Tokens** — `src/styles/tokens.css` (color, spacing, type, radius, shadow).
- **Theme** — `src/theme/openseat.theme.ts`. After editing it, regenerate the built theme CSS:
  ```bash
  bun run --filter @openseat/design-system theme:build
  ```
  This rewrites `src/theme/theme.css` and related generated files. Commit them together with the `.ts` change.

Apps import only from the package, for example `import { Button } from "@openseat/design-system"`. Never hardcode colors, spacing, or type — use tokens and components.

---

## 6. Performance and accessibility audit (Unlighthouse)

[Unlighthouse](https://unlighthouse.dev) runs Lighthouse against every route it can find. It's already a root dev dependency.

### Audit a deployed site

```bash
bunx unlighthouse --site https://your-site.com --max-routes -1 --disable-dynamic-sampling
```

- `--max-routes -1` — no limit on how many routes to scan.
- `--disable-dynamic-sampling` — scan every page, even ones that share a route pattern (e.g. every `/jobs/[id]`).

### Audit a local app

Scores from a dev server are misleadingly low (no minification, dev overlays). Audit a production build instead:

```bash
bun run --cwd opened-frontend build
bun run --cwd opened-frontend start --port 3102
```

In a second terminal:

```bash
bunx unlighthouse --site http://localhost:3102 --max-routes -1 --disable-dynamic-sampling
```

When the scan finishes, Unlighthouse opens its report UI in your browser. Reports are written to `.unlighthouse/`, which is already gitignored.

Tips:

- **Employer pages** (`/company/*`) are only reachable once the `opened_mode=company` cookie is set. For a quick local check, start the scan from that path so the crawler begins there:
  ```bash
  bunx unlighthouse --site http://localhost:3102/company --max-routes -1 --disable-dynamic-sampling
  ```
- **Faster, rougher pass** — drop `--disable-dynamic-sampling` to sample one page per route pattern.

---

## 7. Git workflow

### Branches

Branch from `main`, work there, and open a pull request back into `main`.

```bash
git checkout main
git pull
git checkout -b feat/<short-name>
```

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
docs: add command guide
chore: bump dependencies
```

Common types: `feat`, `fix`, `docs`, `refactor`, `style`, `test`, `chore`, `perf`.

### Before you push

```bash
bun run lint
bun run typecheck
bun run --cwd opened-frontend lint
bun run test
```

```bash
git push -u origin feat/<short-name>
```

---

## 8. Quick reference

| I want to…                          | Command                                                                                      |
| ----------------------------------- | -------------------------------------------------------------------------------------------- |
| Install everything                  | `bun install`                                                                                |
| Run Opened                          | `bun run --cwd opened-frontend dev`                                                          |
| Run OpenSeat app                    | `bun run --cwd openseat-frontend dev`                                                        |
| Run the design-system showcase      | `bun run --cwd openseat-theme dev`                                                           |
| Lint the repo                       | `bun run lint`                                                                               |
| Lint Opened                         | `bun run --cwd opened-frontend lint`                                                         |
| Type-check the repo                 | `bun run typecheck`                                                                          |
| Type-check Opened                   | `bunx tsc --noEmit -p opened-frontend/tsconfig.json`                                         |
| Format everything                   | `bun run format`                                                                             |
| Run tests                           | `bun run test`                                                                               |
| Rebuild the theme CSS               | `bun run --filter @openseat/design-system theme:build`                                       |
| Build + serve Opened for production | `bun run --cwd opened-frontend build` then `bun run --cwd opened-frontend start --port 3102` |
| Audit a site                        | `bunx unlighthouse --site <url> --max-routes -1 --disable-dynamic-sampling`                  |
| Clear a stale dev cache             | `rm -rf opened-frontend/.next`                                                               |
