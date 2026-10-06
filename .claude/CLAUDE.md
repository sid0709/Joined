# Joined — agent instructions

This is a **bun workspaces monorepo**. Work from the repo root. Shared UI is the `sid-ui` package (https://github.com/sid0709/sid-ui). Apps consume it from the catalog. Do not copy a component, token, or helper into a workspace, and do not add the source back under `packages/`.

Workspaces: `connected-frontend`, `joined-frontend`, `admin-frontend`, `scoutwell-frontend`, `packages/*`, `joined-backend`, `admin-backend`, `scoutwell-backend`, `backend-core`. The component catalog is `sid-ui-theme` in the sid-ui repo. Acorn (extension, website, API) lives in the sibling Acorn repo.

Before pushing, run `bun run ci` — it runs exactly what GitHub CI runs (`tools/ci.mjs`).

## Package manager

Use **bun only**. Never npm, yarn, or pnpm.

```bash
bun install
bun add <pkg>
bun add -d <pkg>
bun run <script>
bunx <cli>
```

Do not create or commit `package-lock.json`, `yarn.lock`, or `pnpm-lock.yaml`. Prefer `bun.lock`.

If a launch/debug config still calls `npm`, switch it to `bun`.

## No hardcoding

Never inline a value that belongs in env, a config module, a design token, or a named constant. This applies in every language. The stack rule for the files you are editing says where that value lives.

- Secrets and API hosts come from the environment or that stack's config module. A literal host or key in source is a bug.
- Colors, spacing, type, radii, and shadows in UI come from `sid-ui` tokens. A hex color or an inline style for those is a bug.
- Timeouts, limits, ids, and protocol strings are named constants in the module that owns them.
- A value used by more than one workspace lives in one shared package.

User-facing copy can sit next to the only component that shows it. Copy used in a second place moves to a shared constant.

## Stack rules

Follow the rule that matches the folder you are editing, and use only that folder's stack. The files in `.claude/rules/` are mandatory. Cursor loads the same text from `.cursor/rules/`.

| Folder | Rule |
| --- | --- |
| Next.js: `connected-frontend`, `joined-frontend`, `admin-frontend`, `scoutwell-frontend` | `.claude/rules/nextjs.md` |
| UI on `sid-ui`: those apps, `packages/scout` | `.claude/rules/design-system.md` |
| Go: `joined-backend`, `admin-backend`, `scoutwell-backend`, `backend-core` | `.claude/rules/go.md` |
| `sid-ui-theme` catalog in the sid-ui repo | `.claude/rules/theme.md` |

## Best practice

- Match the neighboring files in that workspace before introducing a new pattern.
- Prefer composition and reuse over duplication.
- Keep modules small and single-purpose. Split a file when it mixes unrelated concerns or grows past a focused unit of work.
- Colocate types with the code that owns them; share types from packages when more than one app needs them.
- Change the source of truth (tokens, shared components, config) instead of patching call sites with one-off values.
