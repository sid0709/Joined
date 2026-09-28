# OpenSeat — agent instructions

This is a **bun workspaces monorepo**. Work from the repo root. Shared UI lives in `packages/*` (e.g. `@openseat/design-system`). Apps consume shared packages; do not copy the same component, token, or helper into more than one workspace.

Workspaces: `connected-frontend`, `openseat-theme`, `opened-frontend`, `packages/*`.

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

Never hardcode values that belong in config, tokens, env, or shared constants:

- URLs, API hosts, feature flags → env / config module
- Colors, spacing, type, radii, shadows → design tokens (`tokens.css`)
- Copy used in more than one place → shared constants (or i18n)
- Magic numbers, IDs, timeouts, limits → named constants
- Secrets → env only, never in source

```ts
// ❌
fetch("https://api.example.com/jobs");
<div style={{ color: "#111", padding: 16 }} />;

// ✅
fetch(`${env.API_BASE_URL}/jobs`);
<div className="text-fg p-md" />;
```

If a constant is used in more than one workspace, put it in a shared package — not duplicated per app.

## Best practice

- Prefer composition and reuse over duplication.
- Keep modules small and single-purpose. Split a file when it mixes unrelated concerns or grows past a focused unit of work.
- Colocate types with the code that owns them; share types from packages when more than one app needs them.
- Change the source of truth (tokens, shared components, config) instead of patching call sites with one-off values.

## Next.js apps (`connected-frontend`, `openseat-theme`, `opened-frontend`, any future Next.js workspace)

When the folder is a Next.js project, follow current App Router practice. Read that app's `node_modules/next/dist/docs/` before using APIs that may have changed.

### File size and splitting

- Keep `page.tsx` / `layout.tsx` thin: compose, don't dump UI and data logic in the route file.
- Split by concern: `components/`, `lib/`, `hooks/`, route-local `_components` only when not reused.
- Extract anything reused across routes into shared components — prefer `@openseat/design-system` or the app `components/` folder.
- One component per file when it has its own state, data, or styles. Don't grow a 400-line page.

### Routing

- Use the App Router file conventions: `page.tsx`, `layout.tsx`, `loading.tsx`, `error.tsx`, `not-found.tsx`, `route.ts`.
- Nested layouts for shared chrome. Route groups `(group)` for organization without changing the URL.
- Colocate route-only files next to the route. Promote to `components/` or `packages/` as soon as a second route needs them.

### Server vs client (smaller bundles)

- Default to **Server Components**. Add `"use client"` only when the file needs browser APIs, state, or event handlers.
- Push `"use client"` to the smallest leaf (a button, a form), not the whole page.
- Dynamic-import heavy client-only widgets (`next/dynamic` or `import()`) so they are not in the initial bundle.
- Fetch on the server when possible. Don't ship data-loading libraries to the client without a reason.

```tsx
// ❌ whole page is a client component
"use client";
export default function Page() { /* fetch + form + layout */ }

// ✅ server page, tiny client island
export default function Page() {
  return <JobForm />; // JobForm.tsx is the only "use client" file
}
```

### Reuse

- Use existing design-system primitives before creating a new button, input, modal, or token.
- Don't duplicate CSS or component variants that already exist in `packages/design-system`.
- Named exports, stable props, no copy-pasted JSX between routes.
