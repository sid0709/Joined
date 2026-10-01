# ADR 0001: Monorepo tooling and workspace policy

- Status: Accepted
- Date: 2026-09-26

## Context

Joined contains two Next.js applications and a shared design-system package.
They need consistent dependency installation, linting, formatting, typechecks,
tests, and builds while retaining their current directory layout. The
repository's contributor rules require Bun; a second package manager would
create conflicting lockfiles and CI behavior.

## Decision

- Keep Bun 1.4.2 as the package manager and `bun.lock` as the workspace lockfile.
- Keep the existing `joined-frontend/`, `joined-theme/`, and
  `packages/design-system/` paths. Any move to an `apps/` layout needs a
  separate agreed change.
- Use Turbo to run workspace lint, typecheck, and build tasks, and use root
  scripts for repository-wide formatting, tests, coverage, and policy checks.
- Use ESLint with type-aware TypeScript rules and Next.js rules in the two app
  workspaces. Use Prettier as the sole formatter across tracked source and docs.
- Use Bun's test runner and require at least 80% coverage for each source file
  represented in the coverage report. Do not allow skipped, todo, or focused
  tests. Add tests alongside new behavior because unimported files do not
  contribute coverage.
- Keep local Husky hooks as fast feedback. CI is authoritative because local
  hooks can be bypassed.
- Run CI for pull requests targeting `main` and pushes to `main`. Validate
  Conventional Commit pull request titles in CI.
- Keep ownership, CODEOWNERS, and branch-protection settings under the
  repository owner's control. Do not apply live GitHub settings from scripts.
- Defer Changesets and semantic releases until the repository publishes
  versioned packages. Defer release automation until its credentials and
  release policy exist.

## Consequences

Every workspace has explicit lint and typecheck tasks, while shared code uses
its package's public exports. CI catches type, lint, formatting, test,
coverage, boundary, build, and pull request title failures before merge. The
coverage threshold is per reported source file rather than a claim that every
file in every application is covered; new behavior must include tests as the
test suites grow.

Branch protection and required owner reviews still need to be maintained by
the repository owner in GitHub settings.
