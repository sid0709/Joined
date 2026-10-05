---
paths:
  - "{connected-frontend,joined-frontend,admin-frontend,scoutwell-frontend,acorn-frontend}/**/*.{ts,tsx,js,jsx}"
---

# Next.js (App Router)

When the workspace is a Next.js app, follow current App Router practice. Read that app's `node_modules/next/dist/docs/` before using APIs that may have changed.

## File size and splitting

- Keep `page.tsx` / `layout.tsx` thin: compose, don't dump UI and data logic in the route file.
- Split by concern: `components/`, `lib/`, `hooks/`, route-local `_components` only when not reused.
- Extract anything reused across routes into shared components. Interactive UI comes from `sid-ui` (see the design-system rule). App-only composition lives in `components/`.
- One component per file when it has its own state, data, or styles. Don't grow a 400-line page.

## Routing

- Use the App Router file conventions: `page.tsx`, `layout.tsx`, `loading.tsx`, `error.tsx`, `not-found.tsx`, `route.ts`.
- Nested layouts for shared chrome. Route groups `(group)` for organization without changing the URL.
- Colocate route-only files next to the route. Promote to `components/` or `packages/` as soon as a second route needs them.

## Server vs client (smaller bundles)

- Default to **Server Components**. Add `"use client"` only when the file needs browser APIs, state, or event handlers.
- Push `"use client"` to the smallest leaf (a button, a form), not the whole page.
- Dynamic-import heavy client-only widgets (`next/dynamic` or `import()`) so they are not in the initial bundle.
- Fetch on the server when possible. Don't ship data-loading libraries to the client without a reason.

```tsx
// ❌ whole page is a client component
"use client";
export default function Page() {
  /* fetch + form + layout */
}

// ✅ server page, tiny client island
export default function Page() {
  return <JobForm />; // JobForm.tsx is the only "use client" file
}
```

## Reuse and config

The design-system rule is mandatory in these apps. Do not add a local button, input, modal, or token.

- Named exports, stable props, no copy-pasted JSX between routes.
- Hosts and flags come from that app's `lib/config.ts` (`joinedApiUrl`, `scoutwellApiUrl`, admin `API_PROXY`). `next.config.ts` may read `NEXT_OUTPUT`. Components do not read URL env vars themselves.
- Timeouts, page sizes, and ids are named constants in the owning module, as in `scoutwell-frontend/lib/config.ts`. An app with no config module gets one before a host is introduced.
