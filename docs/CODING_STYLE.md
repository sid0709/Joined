# Coding style

Use the root Prettier configuration and `.editorconfig` for every workspace.
Prettier is the only formatter; do not run a second formatter over the same
files. ESLint handles correctness and policy checks, not formatting.

## Names and files

- Use `PascalCase` for React components and component types.
- Use `camelCase` for variables, functions, hooks, and object properties.
- Prefix React hooks with `use` and keep each hook in a `use-*.ts` or
  `use-*.tsx` file.
- Use `kebab-case` for general TypeScript, test, style, and documentation files.
- Use `PascalCase` filenames for standalone component files when that matches
  the existing design-system convention.
- Name tests beside the code they cover as `*.test.ts` or `*.test.tsx`.

## TypeScript and exports

- Keep `strict` TypeScript enabled in every workspace. Prefer precise types;
  avoid `any`, and use `unknown` at untrusted boundaries before narrowing.
- Prefer named exports for shared APIs. Use default exports for framework
  entry points and lazily loaded modules whose loader contract expects one.
- Add JSDoc to every public export from a shared package. Describe its purpose;
  include parameter and return details when they add useful information.
- Put reusable UI and logic in `packages/*`. Applications must import it via
  the package's declared public exports, never by reaching into its `src` tree.
- Keep functions focused. ESLint enforces a cyclomatic complexity maximum of
  40; split larger decision trees into named helpers. Aim for no more than 100
  lines per function, extracting reusable or independent sections when needed.
- Handle promises explicitly. Await them, return them to an awaiting caller, or
  deliberately mark fire-and-forget work with `void` and document why.

## Comments and styles

- Comments should explain intent, constraints, or non-obvious tradeoffs. Do not
  leave commented-out code in the repository.
- Track follow-up work with `TODO(#123): explain the task`, using a real issue
  number and a short description.
- Prefer design tokens and shared styles over one-off colors, spacing,
  typography, or radii.
- Keep import groups ordered by ESLint and use Prettier for formatting.

## Validation

Use Bun from the repository root. Before opening a pull request, run the
workspace lint, format, typecheck, test/coverage, and build checks described in
[Contributing](CONTRIBUTING.md). CI runs the same checks for pull requests to
`main` and pushes to `main`.
