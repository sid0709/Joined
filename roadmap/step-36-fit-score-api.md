# Step 36: Fit score API

- **Week:** W3, Scraper onboarding
- **Owner:** Ravi (platform backend lane)
- **Target branch:** `stage-roadmap-w34` (never `main`, never `acorn*`)
- **PR title:** `feat(jobs): fit score and short reason (roadmap step-36)` (conventional commits: lowercase `type(scope): subject`; every commit message must follow the same format or CI fails)
- **Runs in parallel with step-34.** Keep out of search-CRUD files if they would conflict.

## Goal

Authenticated job search returns a fit score and a short reason so seekers can see why a job matches them.

## In scope

- Investigate `docs/14-job-pool-and-matching.md` (read only) and current `/v1/search/jobs` plus profile/resume fields.
- A 0–100 fit score plus a short reason string (top matching or missing factor) on job search/detail responses for a signed-in seeker. Guests get no score.
- Deterministic, testable scoring from existing profile/resume/job fields (role/skills/seniority/location/salary). Put weights in config. Version the model (`model_version`).
- Do not block search if scoring fails; omit the fields and log.
- Go tests for scoring, guest vs signed-in, and response shape compatibility.

## Out of scope

- No frontend (Leo, step-37).
- No ML training, no embeddings unless already in-repo and cheap.
- No company-side applicant fit UI.

## Acceptance criteria

1. `go vet` and `go test` pass for touched modules.
2. Signed-in search includes `fit_score` and a short reason; guest search is unchanged.
3. Diff stays inside Ravi's lane.
