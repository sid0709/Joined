# Acorn API (Go)

Acorn's routes inside backend-core. Go port of the browser-extension backend in `athens-backend` from [sid0709/AthensAI](https://github.com/sid0709/AthensAI): the `/acorn/*` routes and the `/acorn/socket.io` Socket.IO gateway the Acorn extension talks to. backend-core's server ([`cmd/server`](../cmd/server)) mounts this package at `acornapi.Prefix`, so in production every route is `https://api.joinedhq.com/acorn/...`.

From the repo root:

```bash
cp backend-core/.env.example backend-core/.env   # MONGO_URI (same as joined-backend) and OPENAI_API_KEY
bun run dev:core-api                             # :8083
go test ./backend-core/...
```

## How it differs from the Athens backend

- **Auth is Joined's.** No Acorn accounts or Athens session collection. A request is signed in by the Joined session token, sent as `Authorization: Bearer` or in the `joined_session` cookie, and checked with `backend-core/auth`. Only job hunter accounts are accepted. `POST /acorn/auth/signout` answers OK but does not revoke anything, because the session is shared with joined-frontend.
- **Profile is Joined's.** The planner, writer and Q&A read the applicant from `backend-core/candidate` (`Profile`), not from Athens `autoBidProfile`. Joined stores no education, demographics or profile links, so those fields are empty and the prompt notes say so.
- **The model is the server's.** One `OPENAI_API_KEY` and `OPENAI_MODEL` through `backend-core/openai`, not each user's own key. Athens' sampling knobs (temperatures, token limits) and AI usage metering are not ported.
- **Worker pool = saved jobs** the hunter has not applied to. `mark-applied` applies through the same path as Joined's apply.
- **No résumé gate.** Athens refused to fill without a résumé unless the account was an admin, and randomly skipped about 20% of a non-admin's actions. Neither is ported; the planner is always told no résumé is available.
- **Résumé generation and recommendation are empty.** `jobs/:id/recommended-resume`, every `*/preview`, `custom/generate` (+ `/continue`, poll), `custom/recommend`, and the `custom/resumes` and `custom/library-resumes` routes keep the extension's contract and return no file, id or match.

## Layout

| Path                            | What                                                                                                                                                           |
| ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `backend-core/acorn`            | Planner, identity classifier, typed-answer writer, option matcher, Q&A, JD extraction. Prompts are extracted verbatim from the TS source into `prompts/*.txt`. |
| `backend-core/acornapi/gateway` | Socket.IO at `/acorn/socket.io`: per-account rooms, DOM relay with acks, cross-account isolation.                                                              |
| `backend-core/acornapi`         | Routes under `/acorn`, Joined session handling, Worker pool jobs, empty résumé routes.                                                                         |
