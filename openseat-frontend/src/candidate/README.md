# Candidate Module

Owned by the **candidate / freelancer** team.

## Routes

| URL | Page |
|-----|------|
| `/marketplace/candidate/dashboard` | Job room browse & bid |
| `/marketplace/candidate/profile` | Profile setup |

## Structure

```
src/candidate/
├── components/     # Candidate-only UI
├── hooks/          # Candidate dashboard logic
└── types/          # Candidate-specific type re-exports
```

## Import Rules

✅ Allowed: `@/src/shared/*`, `@/components/ui/*`  
❌ Forbidden: `@/src/client/*`
