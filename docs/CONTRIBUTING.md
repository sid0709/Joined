# Contributing

OpenSeat uses Bun workspaces. Install the pinned dependencies from the
repository root:

```sh
bun install --frozen-lockfile
```

The workspaces are `openseat-frontend`, `openseat-theme`, and
`packages/design-system`. Read [Coding Style](CODING_STYLE.md) before changing
shared code. Keep repository policy and owner settings aligned with the
existing [CODEOWNERS](../.github/CODEOWNERS); ask the owner before proposing
ownership or branch-protection changes.

## Branching and commits

Use trunk-based development: branch from the latest `main`, keep the branch
short-lived, and send completed work back to `main` in a pull request. Use one
of these prefixes to make branch intent clear:

- `feat/` for user-visible features
- `fix/` for bug fixes
- `chore/` for maintenance, documentation, and infrastructure

Use Conventional Commit messages, such as `feat: add keyboard navigation`,
`fix: preserve calendar month boundaries`, or `chore: document workspace setup`.
The commit hook checks messages locally, and CI also checks the pull request
title. Local hooks can be skipped, so CI is the required source of enforcement.

## Tests and checks

Add tests for changed behavior. Prefer fast unit tests for pure logic and
component tests for user-visible behavior. Tests must not be skipped, marked as
todo, or left focused with `.only`. Keep at least 80% coverage for each source
file included in the Bun coverage report; add tests whenever a covered file's
behavior changes. Coverage does not claim that unimported files have been
tested, so workspaces should add tests alongside new behavior.

Run the repository checks from the root before opening a pull request:

```sh
bun run lint
bun run check:boundaries
bun run format:check
bun run typecheck
bun run test
bun run build
```

Use `bun run format` to format the repository with Prettier. Pre-commit runs
lint-staged; CI runs the complete checks for pull requests targeting `main`.

## Pull requests

Open pull requests against `main`. Use a Conventional Commit title, link the
related issue, explain the behavior or policy change, and list validation and
known limitations. Keep each pull request focused and respond to review
feedback. GitHub's configured owner review and branch protection requirements
remain managed by the repository owner.
