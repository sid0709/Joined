# Step 32: Acorn website scaffold

Status: Done (merged in W2)

- **Week:** W2, Acorn website
- **Owner:** Elon (integrator lane: `acorn/**`, root files)
- **Target branch:** `stage-roadmap` (never `main`)
- **PR title:** `feat(acorn): acorn website scaffold (roadmap step-32)` (conventional commits: lowercase `type(scope): subject`; every commit message must follow the same format or CI fails)
- **Starts after: nothing, can start now.** New folder only, plus the root workspaces entry.

## Goal
Acorn has a website app that builds and runs locally, ready for the W3 profile, resume, and billing pages.

## In scope
- New Next.js app `acorn/website` using catalog versions and `@joined/design-system`, with a landing page, sign-in placeholder that reuses the `joined_session` flow, and a local dev port that does not clash with `tools/local-services.mjs`.
- Add `acorn/website` to the root `package.json` workspaces and `tools/local-services.mjs`; `bun.lock` update.
- Short `acorn/website/README.md`.

## Out of scope
- No deploy, Docker, nginx, or DNS changes (W4), no backend changes, no changes to `acorn/extension`.
- Page content beyond the landing belongs to W3; Elon may hand UI pages to Leo then.

## Acceptance criteria
1. `bun install`, build, typecheck, lint, format pass.
2. `bun --filter <acorn website package> dev` serves the landing page locally.
3. Diff touches only `acorn/website/**`, root `package.json`, `bun.lock`, and `tools/local-services.mjs`.
