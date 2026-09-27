# Coding guide

Day-to-day rules for writing, running, checking, testing, committing, and opening a pull request in this repo. Run every command from the **repo root**.

Longer references: [Command.md](Command.md) (every command), [docs/CONTRIBUTING.md](docs/CONTRIBUTING.md) (git and review policy), [docs/CODING_STYLE.md](docs/CODING_STYLE.md) (names, types, comments).

## While you code

- Use **bun only**. Never npm, yarn, or pnpm. The only lockfile is `bun.lock`.
- Work from the repo root. Do not copy a component, token, or helper into more than one app. Shared UI lives in `packages/*` (for example `@openseat/design-system`). Apps import the package's public exports, never its `src` tree.
- Do not hardcode values that belong in config or tokens:
  - URLs, API hosts, feature flags → env / config
  - Colors, spacing, type, radii, shadows → design tokens (`tokens.css`)
  - Copy used in more than one place → shared constants
  - Magic numbers, IDs, timeouts, limits → named constants
  - Secrets → env only, never in source
- One version of every library, declared once in the root `package.json` `catalog`. Workspaces reference it as `"catalog:"`. There is one `node_modules`, at the root. If versions conflict, update the code. Do not install a second copy.
- After you change any `package.json`, run `bun install` and commit the updated `bun.lock` with it.
- Keep `page.tsx` and `layout.tsx` thin. Default to Server Components. Add `"use client"` only on the smallest file that needs state, events, or browser APIs.
- Name files and symbols the way [docs/CODING_STYLE.md](docs/CODING_STYLE.md) describes: `PascalCase` components, `camelCase` functions, `use-*.ts` hooks, `kebab-case` for most other files, tests as `*.test.ts` or `*.test.tsx` next to the code they cover.
- Keep TypeScript `strict`. Avoid `any`. Prefer named exports except where the framework requires a default export.
- Comments explain intent. Do not leave commented-out code. Follow-ups look like `TODO(#123): short description` with a real issue number.

## Running

| What                        | Command                             | URL                   |
| --------------------------- | ----------------------------------- | --------------------- |
| Opened (job platform)       | `bun run dev:opened`                | http://localhost:3002 |
| OpenSeat app                | `bun run dev:app`                   | http://localhost:3000 |
| Design-system showcase      | `bun run dev:theme`                 | http://localhost:3001 |
| All three                   | `bun run dev`                       | all of the above      |
| One script in one workspace | `bun --filter <workspace> <script>` | —                     |

First time, and after `package.json` or `bun.lock` changes:

```bash
bun install
```

Production build of every app: `bun run build`. One app: `bun run build:opened`, `bun run build:app`, or `bun run build:theme`.

## Prettier

Prettier is the only formatter. Do not run a second formatter on the same files. ESLint checks correctness; Prettier checks layout.

Root config (`.prettierrc.json`), applied to every workspace:

| Setting         | Value    |
| --------------- | -------- |
| Semicolons      | yes      |
| Quotes          | double   |
| Indent          | 2 spaces |
| Trailing commas | all      |
| Print width     | 100      |

`.editorconfig` matches that: UTF-8, LF line endings, 2-space indent, final newline.

Format the repo:

```bash
bun run format
```

Check without writing files (this is what CI runs):

```bash
bun run format:check
```

The pre-commit hook runs Prettier on staged files through lint-staged. You still run `bun run format:check` before a pull request, because a skipped hook does not excuse CI.

## Checks

Run this from the root before you open a pull request:

```bash
bun run lint
bun run check:boundaries
bun run format:check
bun run typecheck
bun run test
bun run build
```

Also run `bun run check:deps` when you touched dependencies.

| Command                     | What it checks                                                            |
| --------------------------- | ------------------------------------------------------------------------- |
| `bun run lint`              | ESLint in every workspace. Zero warnings.                                 |
| `bun run lint:fix`          | Same, auto-fixing what it can.                                            |
| `bun run format`            | Rewrite files with Prettier.                                              |
| `bun run format:check`      | Fail if Prettier would change anything.                                   |
| `bun run typecheck`         | `tsc --noEmit` in every workspace.                                        |
| `bun run test`              | All tests, coverage, then the test-policy check.                          |
| `bun run check:boundaries`  | Apps do not import each other's files. Shared code goes through packages. |
| `bun run check:deps`        | One catalog version per library, one root `node_modules`.                 |
| `bun run check:test-policy` | No skipped, todo, or focused tests.                                       |
| `bun run build`             | Production build of every app.                                            |

One workspace only:

```bash
bun --filter opened-frontend lint
bun --filter opened-frontend typecheck
```

## Testing

- Add tests for behavior you change. Prefer fast unit tests for pure logic and component tests for what a user sees.
- Put them next to the code: `thing.test.ts` or `thing.test.tsx`.
- Do not commit `.skip`, `.only`, `.todo`, `fdescribe`, `fit`, `xdescribe`, `xit`, or `xtest`. `bun run test` fails if it finds them.
- Keep at least **80% coverage** on each source file Bun includes in the coverage report (`bunfig.toml`). When you change a covered file, add or update tests for the new behavior.
- Run everything:

```bash
bun run test
```

- Run one folder or file while you work:

```bash
bun test tests
bun test path/to/file.test.ts
```

`bun test` alone does not run the test-policy check or fail the coverage gate the same way CI does. Before a pull request, use `bun run test`.

## Commits

Branch from the latest `main`. Keep the branch short. Prefixes:

- `feat/` — user-visible feature
- `fix/` — bug fix
- `chore/` — maintenance, docs, infrastructure

```bash
git checkout main
git pull
git checkout -b feat/short-name
```

Messages are [Conventional Commits](https://www.conventionalcommits.org/). The `commit-msg` hook (`bunx commitlint`) rejects anything else. CI checks every commit on the pull request, so skipping the hook locally still fails in CI.

```text
type(optional-scope): summary in imperative mood
```

```text
feat(opened-frontend): split candidate and employer modes
fix(design-system): stop nested grid columns inheriting spans
docs: update the coding guide
test: cover empty search results
chore: document workspace setup
```

Use one of: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `chore`, `ci`, `revert`.

- Subject is lowercase, no trailing period, imperative ("add", "fix", "remove").
- One logical change per commit.
- Do not commit secrets, `.env` files, or lockfiles from npm, yarn, or pnpm.
- Do commit `bun.lock` when dependencies change.

Hooks installed by `bun install`:

| Hook         | What it runs       | What happens                                        |
| ------------ | ------------------ | --------------------------------------------------- |
| `pre-commit` | `bunx lint-staged` | Prettier formats the files you staged               |
| `commit-msg` | `bunx commitlint`  | Rejects a message that is not a Conventional Commit |

Do not pass `--no-verify`. If the hook fails, fix the message or the formatting and commit again.

## Pull requests

Open the pull request against `main`. The **title** must also be a Conventional Commit. CI runs commitlint on the title.

```text
fix: handle empty search results
```

Fill in `.github/PULL_REQUEST_TEMPLATE.md`:

- Link the related issue when there is one.
- Say what changed for the user or for other contributors.
- List the checks you ran and any limitation you know about.
- Confirm tests cover the changed behavior and that you did not leave skipped or focused tests.
- Ask for owner review when the change touches repository policy or platform ownership.

Keep the pull request focused on one change. CI on a pull request to `main` runs lint, formatting, typecheck, dependency policy, tests and coverage, builds, and commit conventions. All of those must pass.
