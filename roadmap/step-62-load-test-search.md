# Step 62: Load test search and job pages

- **Week:** W4, QA / launch prep
- **Owner:** Quinn / Ravi (Quinn owns the harness in `tests/**`; Ravi owns API fixes in his lane)
- **Target branch:** `stage-roadmap-w34` (never `main`, never `acorn*`)
- **PR title:** `test(load): search and job pages (roadmap step-62)` (conventional commits: lowercase `type(scope): subject`; every commit message must follow the same format or CI fails)

## Goal

Search and public job pages have a repeatable load test with a recorded baseline.

## In scope

- A load script under `tests/` (k6, vegeta, or a small Go/bun runner — pick what the repo can run in CI or document as local-only). Targets: `/v1/search/jobs` and public job HTML on joined-frontend.
- Document concurrency, duration, and pass/fail thresholds (p95 latency, error rate). Do not point at production.
- If the test shows a backend bug, Ravi fixes in a follow-up PR; do not mix huge query-planner changes into the harness PR.

## Out of scope

- No production load. No write/apply flood. No Scout/Acorn in this step.

## Acceptance criteria

1. One documented command produces a summary (p95, errors).
2. Thresholds are named constants in the harness, not magic numbers in CI YAML.
3. Harness PR stays in `tests/**` (Quinn); API fixes stay in Ravi's lane.
