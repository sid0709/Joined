# Oak backend (Go)

Go port of the Oak half of `AthensAI/athens-backend` (at the repo root): the `/api/oak` routes and the `/oak` Socket.IO gateway the Oak extension talks to.

```bash
cp .env.example .env   # MONGO_URI (same as joined-backend) and OPENAI_API_KEY
go run ./cmd/server    # :8980
go test ./...
```

## How it differs from the Athens backend

- **Auth is Joined's.** No Oak accounts or `oak_sessions`. A request is signed in by the Joined session token, sent as `Authorization: Bearer` or in the `joined_session` cookie, and checked with `backend-core/auth`. Only job hunter accounts are accepted. `POST /api/oak/auth/signout` answers OK but does not revoke anything, because the session is shared with joined-frontend.
- **Profile is Joined's.** The planner, writer and Q&A read the applicant from `backend-core/candidate` (`Profile`), not from Athens `autoBidProfile`. Joined stores no education, demographics or profile links, so those fields are empty and the prompt notes say so.
- **The model is the server's.** One `OPENAI_API_KEY` and `OPENAI_MODEL` through `backend-core/openai`, not each user's own key. Sampling knobs (`OAK_*_TEMPERATURE`, token limits) and AI usage metering are not ported.
- **Worker pool = saved jobs** the hunter has not applied to. `mark-applied` applies through the same path as Joined's apply.
- **No résumé gate.** Athens refused to fill without a résumé unless the account was an admin, and randomly skipped about 20% of a non-admin's actions. Neither is ported; the planner is always told no résumé is available.
- **Résumé generation and recommendation are empty.** `jobs/:id/recommended-resume`, every `*/preview`, `custom/generate` (+ `/continue`, poll), `custom/recommend`, and the `custom/resumes` and `custom/library-resumes` routes keep the extension's contract and return no file, id or match.

## Layout

| Path               | What                                                                                                                                                           |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `internal/oak`     | Planner, identity classifier, typed-answer writer, option matcher, Q&A, JD extraction. Prompts are extracted verbatim from the TS source into `prompts/*.txt`. |
| `internal/gateway` | Socket.IO at `/oak`: per-account rooms, DOM relay with acks, cross-account isolation.                                                                          |
| `internal/httpapi` | Routes, Joined session handling, Worker pool jobs, empty résumé routes.                                                                                        |
