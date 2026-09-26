# Client Module

Owned by the **client / hiring** team.

## Routes

| URL | Page |
|-----|------|
| `/marketplace/client/dashboard` | Post jobs, review applicants |

## Structure

```
src/client/
├── components/     # Client-only UI
├── hooks/          # Client dashboard logic
└── types/          # Client-specific types (e.g. ClientJobPost)
```

## Import Rules

✅ Allowed: `@/src/shared/*`, `@/components/ui/*`  
❌ Forbidden: `@/src/candidate/*`
