# acorn-frontend

Acorn's website. Accounts created here are the same accounts the extension uses.
Sign-in sets the `acorn_session` cookie; the extension reads it from this origin.

```bash
bun --filter acorn-frontend dev
```

Then open http://localhost:6005. The API is acorn-backend at http://127.0.0.1:8083
(`ACORN_API_URL`). Copy `.env.example` to `.env` when you need to point elsewhere.
