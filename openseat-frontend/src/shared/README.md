# Shared Marketplace Layer

Cross-team code used by both **candidate** and **client** surfaces.

## Owns

- Authentication (`auth/`)
- Domain types (`types/`)
- Job room state provider (`job-rooms/`)
- Shared presentation components (`components/`)

## Rules

- Do **not** import from `@/src/candidate/*` or `@/src/client/*`
- Keep this layer minimal — role-specific UI belongs in the respective module
