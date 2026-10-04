# Acorn — agent instructions

These add to the repo-root instructions. Read [`../policy-acorn.md`](../policy-acorn.md) before planning or editing Acorn.

## ⚠️ Every Acorn change bumps the version

**Any change that ships in the Acorn extension bumps its version in the same commit.** This covers code, UI, copy, styles, the manifest, and dependencies under `acorn/extension/` or in a package it bundles (`acorn/packages/*`). Docs-only and test-only changes don't bump.

- **One place to edit:** `"version"` in `acorn/extension/package.json`. Nothing else holds a copy. Don't add `version` back to `manifest.json`, and don't hardcode it anywhere.
- **The build carries it everywhere:** `acorn/extension/vite.config.ts` reads it, writes it into the built `manifest.json`, exposes it as `import.meta.env.VITE_ACORN_VERSION`, and prints it on every build:

  ```
  Acorn extension v1.8.0 (production)
  ```

  The sidebar shows it in the Connection footer ("Acorn v1.8.0").

- **Semver:**
  - patch (`1.8.0` → `1.8.1`): bug fixes and copy or style tweaks
  - minor (`1.8.1` → `1.9.0`): new features or UI
  - major (`1.9.0` → `2.0.0`): breaking changes, for example the extension no longer works with the deployed backend (`/acorn/*` routes, socket events, stored data shape)
- **After bumping:** run `bun run build:acorn` and check the log line shows the new version before you commit.
