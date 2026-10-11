# Personalized ranking

`backend-core/ranking` ranks job search for joined-backend: the hunter's profile (target roles,
current title, experience, skills), the typed query (or none), and exact filters, combined into
one ordered list. MongoDB stays the source of truth; everything here is derived and rebuildable.

## Principles

1. **Filters decide pass/fail; similarity decides order.** A filter never enters a score. One
   `Filter` runs three ways (bitmaps, a per-job predicate, a Qdrant payload filter) at the same
   resolution (pay in whole thousands of USD, dates in days), and a property test keeps them equal.
2. **Multi-stage.** Candidate generation (all jobs → about 1,000) → features and scoring →
   re-ranking → a cached ranked list that every page slices.
3. **No expensive work at query time.** Jobs and profiles are normalized and embedded when they
   change; a typed query is embedded once and cached.

## Architecture

```
Mongo jobs ──scan (_id order)──▶ Index (in memory: features + roaring bitmaps)
     │                                 │
     └──(indexer instance)──▶ embedder (TEI, bge-small 384d) ──▶ Qdrant `jobs` (title, body, lexical)
profiles ──on save / first search──▶ embedder ──▶ Qdrant `users` (profile + one vector per role)

GET /v1/search/jobs ─▶ Service.Search
   ├─ cache hit (Redis + in-process layer) ─▶ slice the ranked list
   └─ miss ─▶ Index.Match(filter) ─▶ retrieve (Qdrant batch + in-process channels, RRF)
             ─▶ features ─▶ model (linear v0 | LightGBM) ─▶ re-rank ─▶ cache ─▶ page
```

| File                                 | Role                                                                                                                        |
| ------------------------------------ | --------------------------------------------------------------------------------------------------------------------------- |
| `normalize.go`, `profile.go`         | Job and profile features: workplace, region, annual-USD pay, seniority, occupations (O\*NET-SOC families), canonical skills |
| `taxonomy.go`, `data/*.json`         | Job families with SOC codes and title aliases; skill synonyms                                                               |
| `index.go`, `filter.go`              | In-memory feature store, bitmaps, exact counts, facets                                                                      |
| `qdrant.go`, `embed.go`, `sparse.go` | Vector index client, embedder clients (TEI, OpenAI-compatible), BM25 sparse vectors                                         |
| `retrieve.go`                        | Candidate channels and reciprocal-rank fusion                                                                               |
| `features.go`, `score.go`, `lgbm.go` | Feature vector (`FeatureNames`, version `f1`), linear weights, native LightGBM evaluator                                    |
| `rank.go`, `rerank.go`               | Build a ranked list; freshness boost, duplicate removal, company spread                                                     |
| `cache.go`, `feed.go`, `users.go`    | Ranked-list cache, "For you" feeds and new-job fan-out, profile vectors                                                     |
| `sync.go`                            | Mongo → index → Qdrant: full load, incremental poll, reconcile, reindex                                                     |
| `events.go`, `eval.go`               | Impression/interaction logs and training export; golden-set evaluation                                                      |

## Requests

| Input                              | Handling                                                                                                                                               |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Blank query, no filters, signed in | The precomputed feed (`feed:{user}:{profileHash}`), extended by the full ranking past its end                                                          |
| Blank query + filters              | Exact bitmap filter; channels: profile vectors (Qdrant, filtered), recent jobs, the profile's job families; every filtered job when at most 1,000 pass |
| Typed query (+ filters)            | Query vector on `title` and `body` + BM25 sparse, filtered in Qdrant, fused with RRF; relevance floor drops the tail                                   |
| Signed out                         | No personalization; freshness-led weights for blank queries                                                                                            |
| Sort by newest / pay / applicants  | Blank query: exact over every filtered job. Typed query: the relevant set, re-ordered                                                                  |

Several target roles each get their own retrieval channel, fused with RRF, so no role crowds out
another. Query understanding (`query.go`) suggests filter chips ("remote", "senior", "$150k") but
never applies them.

**Relevance floor.** A meaning-only hit counts for a typed query when its title cosine is at
least 0.72 or its body cosine at least 0.70. A keyword-only hit needs half the best keyword score
and a third of the query's terms (rounded up, filter words such as "remote" aside) in its title,
skills, or company, so a word that only appears in a summary ("a platform for registered
nurses") does not make a job relevant. The cosines were measured with bge-small on the live
catalog (real matches 0.72+, a query the catalog cannot answer tops out at 0.63–0.68).
Re-measure them if the embedding model changes.

## Ranking

`FeatureNames` lists the 24 features: query relevance (dense similarities, BM25, exact title,
company, family, skills), personalization (role and profile similarity, family affinity, skill
overlap, seniority, location and region, pay vs. floor, visa, the deterministic fit score), and
shared signals (recency with a 14-day half-life, applicants, company completeness).

- **v0** — `linearWeights`, one weight set per mode (`query`, `profile`, `anonymous`), each
  summing to 1.
- **v1** — a LightGBM LambdaMART model behind `RANKING_MODEL_PATH`, served to
  `RANKING_LTR_PERCENT` of signed-in users by a stable hash of their id. `lgbm.go` evaluates the
  LightGBM text format (v3/v4) natively; a test checks it against LightGBM's own predictions.

Re-ranking adds a small boost for jobs under 48 hours old, removes duplicate postings (the stored
dedupe key, else company + title + location), and allows at most 3 jobs per company in any 20.

## Operations

```bash
bun run dev:ranking                 # local Qdrant, Redis, and embedder (docker/ranking.compose.yml)
bun run dev:ranking:down

go run -C joined-backend ./cmd/rankctl reindex -version v2 -drop-old
go run -C joined-backend ./cmd/rankctl eval -baseline eval.json -out eval.json
go run -C joined-backend ./cmd/rankctl eval -case "profile: ml" -verbose -explain
go run -C joined-backend ./cmd/rankctl export -since 720h -out training
go run -C joined-backend ./cmd/rankctl loadtest -url http://127.0.0.1:8080 -rps 100 -duration 60s -p95 50ms
go run -C joined-backend ./cmd/rankctl synth -jobs 1000000 -searches 1000
```

The server image includes `/app/rankctl`.

- **Sync.** Every instance loads the in-memory index (full scan in `_id` order), polls for jobs
  inserted since the last `_id` every 30 s, and reconciles fully every 15 min (edits, status
  changes, removals). Hydration reads by `_id`, so no new Mongo index is needed. With
  `RANKING_INDEXER=true` (one instance) the same changes are mirrored into Qdrant by revision:
  a change to the embedded texts re-embeds the job; a payload or tokenizer change
  (`TextVersion`) is rewritten in place without re-embedding.
- **Changing the embedding model or vector layout.** Pick a new collection version and run
  `rankctl reindex -version vN`: it fills `jobs_vN` and moves the `jobs` alias only once it is
  complete. Then set `RANKING_COLLECTION_VERSION=vN`.
- **Learned ranking.** `rankctl export` → `tools/ranking/train_ltr.py` (see its docstring; run it
  in Docker on macOS) → copy `model.txt` to `/srv/joined/models/` → set
  `RANKING_MODEL_PATH=/models/model.txt` and raise `RANKING_LTR_PERCENT` gradually while comparing
  apply rates per arm (`arm` is logged on every impression).
- **Degraded ranking.** When a typed query cannot be embedded within 300 ms (the embedder is down
  or busy with a backfill), the query runs on the keyword channel alone; when profile vectors are
  unavailable, a blank search ranks the in-process channels alone. Such a list is marked
  `Degraded`, cached for 30 s instead of the full TTL, and never stored as a feed.
- **Fallback.** If the index is still loading, or Qdrant is unreachable for a typed query,
  `ErrFallback` sends the request to the Mongo search (logged as `ranked search fallback`). That
  search uses the `$text` index when the collection has one; without it, every term must appear
  (case-insensitively) in the title, company, or skills, newest first.

## Measured performance

Apple M1 Pro, local Docker, uncached searches (`NoCache`):

| Scenario                                                                 | p50   | p95   |
| ------------------------------------------------------------------------ | ----- | ----- |
| 1M jobs, in-process stages (filters, facets, channels, scoring, re-rank) | 9 ms  | 22 ms |
| 200k jobs in Qdrant, typed queries, full pipeline                        | 15 ms | 21 ms |
| 200k jobs in Qdrant, profile searches, full pipeline                     | 21 ms | 27 ms |
| 1M jobs, full load and normalize                                         | 4.3 s | —     |

Add about 5 ms for embedding a new typed query (repeats are cached) and the Mongo read that
hydrates one page. Measure with `BenchmarkSearchMillion`, `BenchmarkLoadMillion`, `rankctl synth`,
and `rankctl loadtest`.

Capacity at 1M jobs: Qdrant about 1.1 GB RAM (int8 vectors) plus originals on disk, the in-memory
index about 1 GB per backend instance, Redis up to its 1 GB cap.
