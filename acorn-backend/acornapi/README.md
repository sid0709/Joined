# Acorn API (Go)

Acorn's HTTP API, in its own service (`acorn-backend`). Go port of the browser-extension backend in `athens-backend` from [sid0709/AthensAI](https://github.com/sid0709/AthensAI): the `/acorn/*` routes and the `/acorn/socket.io` Socket.IO gateway the Acorn extension talks to. [`cmd/server`](../cmd/server) mounts this package at `acornapi.Prefix`, so in production every route is `https://api.joinedhq.com/acorn/...`.

From the repo root:

```bash
cp acorn-backend/.env.example acorn-backend/.env   # MONGO_URI and OPENAI_API_KEY; data goes in AcornDB
bun run dev:acorn-api                              # :8083
go test ./acorn-backend/...
```

## How it differs from the Athens backend

- **Auth is Acorn's.** `POST /acorn/auth/signup` and `POST /acorn/auth/signin` create an account in `acorn_accounts`. acorn-frontend stores the token in the `acorn_session` cookie, and the extension sends it as `Authorization: Bearer`. `POST /acorn/auth/signout` revokes that session.
- **Profile is the Acorn account.** The planner, writer and Q&A read the account's name and email. Education, demographics, and links are empty until a profile editor exists.
- **The model is the server's.** One `OPENAI_API_KEY` and `OPENAI_MODEL` through `backend-core/openai`, not each user's own key. Athens' sampling knobs (temperatures, token limits) and AI usage metering are not ported.
- **Worker pool = saved jobs** the hunter has not applied to. `mark-applied` applies through the same path as Joined's apply.
- **No résumé gate.** Athens refused to fill without a résumé unless the account was an admin, and randomly skipped about 20% of a non-admin's actions. Neither is ported; the planner is always told no résumé is available.
- **Résumé generation and recommendation are empty.** `jobs/:id/recommended-resume`, every `*/preview`, `custom/generate` (+ `/continue`, poll), `custom/recommend`, and the `custom/resumes` and `custom/library-resumes` routes keep the extension's contract and return no file, id or match.

## Layout

| Path                             | What                                                                                                                                                           |
| -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `acorn-backend/acorn`            | Planner, identity classifier, typed-answer writer, option matcher, Q&A, JD extraction. Prompts are extracted verbatim from the TS source into `prompts/*.txt`. |
| `acorn-backend/acornapi/gateway` | Socket.IO at `/acorn/socket.io`: per-account rooms, DOM relay with acks, cross-account isolation.                                                              |
| `acorn-backend/acornapi`         | Routes under `/acorn`, Joined session handling, Worker pool jobs, empty résumé routes.                                                                         |
