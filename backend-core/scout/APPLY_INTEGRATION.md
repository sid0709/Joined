# Scout Share-of-Applies Integration

This document describes how to integrate the scout share-of-applies earnings into the candidate apply flow.

## Overview

Scouts earn a share when candidates apply to jobs they submitted. The earnings logic is implemented in `backend-core/scout` and exposed via the `RecordApply` entry point.

## Entry Point

### `RecordApply(ctx, jobID, candidateID, appliedAt) -> (*Earning, error)`

**Location:** `backend-core/scout/applies.go`

**Purpose:** Credits the scout when a candidate applies to their job.

**Behavior:**

- **Idempotent**: One candidate applying twice to the same job earns once
- **Deduplication**: Uses unique partial index on `(type=apply, submissionId, jobId, candidateId)` in `scout_earnings` collection
- **Immediate release**: Apply earnings are released immediately (no hold period)
- **Quiet for non-scout jobs**: Returns `(nil, nil)` when the job did not come from a scout submission (most applies)
- **Approved only, newest first**: Credits only an `approved` submission that made it into the search pool. When more than one approved row shares a `jobId`, crediting picks the newest `submittedAt`, then the highest `_id` as a tie-break. Stale rejected or needs-review rows never win.
- **Atomic**: Single write operation ensures exactly-once credit even if retried after failure
- **Returns**:
  - `(*Earning, nil)` if this is the first apply and credit succeeded
  - `(nil, nil)` if already credited (idempotent) or job not from scout (quiet no-op)
  - `(nil, error)` only on unexpected database errors

**Example usage:**

```go
import (
    "github.com/sid0709/OpenSeat/backend-core/scout"
)

// In your candidate apply handler (owned by another team):
func handleCandidateApply(ctx context.Context, jobID, candidateID string) error {
    appliedAt := time.Now()

    // ... existing apply logic ...

    // Credit the scout if this job came from a scout submission (quiet no-op otherwise)
    earning, err := scoutStore.RecordApply(ctx, jobID, candidateID, appliedAt)
    if err != nil {
        // Only log actual errors, not "job not from scout" (which is nil)
        slog.Error("scout RecordApply", "job", jobID, "candidate", candidateID, "error", err)
    }
    if earning != nil {
        slog.Info("scout apply credited", "earning", earning.ID, "scout", earning.ScoutUserID, "amount", earning.Amount.AmountCents)
    }

    return nil
}
```

## Configuration

### Reward Amount

The apply reward is configurable via environment variable:

**Environment variable:** `SCOUT_APPLY_REWARD_CENTS`  
**Default:** `50` (50 cents per apply)

**Example:**

```bash
# Set apply reward to $1.00
export SCOUT_APPLY_REWARD_CENTS=100

# Or in .env
SCOUT_APPLY_REWARD_CENTS=100
```

The configuration is loaded when creating the Store and applies to all future RecordApply calls.

## Database

### Collection: `scout_submissions`

Apply crediting looks up the source submission here (`submissionByJobID`).

**Lookup:** `{jobId, status: "approved"}` sorted `{submittedAt: -1, _id: -1}`

**Index:** `{jobId: 1, status: 1, submittedAt: -1, _id: -1}`

- Equality on `jobId` + `status` so rejected and needs-review rows are never considered
- Sort prefix matches the newest-`submittedAt` then `_id` rule used by `RecordApply`

### Collection: `scout_earnings`

Apply earnings are stored directly in the earnings collection with dedupe fields.

**Fields:**

- `type`: `"apply"`
- `status`: `"released"` (immediately available)
- `amount`: `{ "amount_cents": 50, "currency": "USD" }`
- `submissionId`: links back to the scout's submission
- `jobId`: the job the candidate applied to (dedupe key)
- `candidateId`: the candidate who applied (dedupe key)
- `jobTitle`, `companyName`: context for the scout

**Indexes:**

- Unique partial: `(type, submissionId, jobId, candidateId)` where `type = "apply"`
  - Enforces exactly one earning per (job, candidate) apply
  - Partial index only applies to apply rewards, not other reward types
- Index: `(scoutUserId, _id)` - for scout's earnings list
- Index: `(status, holdUntil)` - for releasing held rewards

## API

Scouts can view their apply earnings via Scoutwell endpoints:

### `GET /v1/scout/earnings` - Earnings Ledger

Lists all earnings (including apply rewards) with pagination.

**Query params:**

- `status=released` - filter by status
- `submission_id={id}` - filter to one job
- `cursor`, `limit` - pagination

**Response:** Paginated list of `Earning` objects

**Example:**

```bash
curl -H "Authorization: Bearer $TOKEN" \
  "https://api.scoutwell.com/v1/scout/earnings?status=released&limit=20"
```

### `GET /v1/scout/earnings/summary` - Earnings Summary

Returns released earnings broken down by reward type.

**Response:**

```json
{
  "by_type": {
    "approval": { "amount_cents": 450, "currency": "USD" },
    "apply": { "amount_cents": 350, "currency": "USD" },
    "interview": { "amount_cents": 750, "currency": "USD" }
  },
  "total": { "amount_cents": 1550, "currency": "USD" }
}
```

### `GET /v1/scout/stats`

Returns overall dashboard including balance (which includes apply earnings).

**Relevant fields:**

```json
{
  "balance": {
    "released": { "amount_cents": 1550, "currency": "USD" },
    "lifetime": { "amount_cents": 1550, "currency": "USD" }
  }
}
```

### `GET /v1/scout/meta`

Returns reward table including configurable apply reward rate.

```json
{
  "rewards": {
    "apply_reward": { "amount_cents": 50, "currency": "USD" },
    "hold_days": 14,
    ...
  }
}
```

## Testing

### Unit Tests

See `backend-core/scout/applies_test.go` for reward configuration tests.

### Integration Testing

To test the full flow:

1. **Create a scout submission** (approved status, with `jobId` set)
2. **Call `RecordApply`** with the job's ID and a candidate ID
3. **Verify**:
   - First call returns an earning
   - Second call with same (jobID, candidateID) returns nil
   - Different candidate on same job creates new earning
   - Earning appears in `GET /v1/scout/earnings`
   - Balance increases by reward amount

### Example test data:

```go
// Setup
sub := scout.Submission{
    ScoutUserID: "scout-123",
    JobID:       "job-abc",
    Status:      scout.StatusApproved,  // Must be approved to earn
    // ... other fields
}

// First apply
earning1, _ := store.RecordApply(ctx, "job-abc", "candidate-456", time.Now())
// earning1 != nil, amount = 50 cents

// Duplicate apply (idempotent)
earning2, _ := store.RecordApply(ctx, "job-abc", "candidate-456", time.Now())
// earning2 == nil (already recorded)

// Different candidate
earning3, _ := store.RecordApply(ctx, "job-abc", "candidate-789", time.Now())
// earning3 != nil, amount = 50 cents

// Non-scout job (quiet no-op)
earning4, err4 := store.RecordApply(ctx, "job-not-from-scout", "candidate-999", time.Now())
// earning4 == nil, err4 == nil (not an error, just no credit)
```

## Error Handling

`RecordApply` behavior:

**Returns `(nil, nil)` - quiet no-op:**

- Job not from a scout submission (most applies)
- Submission not approved yet
- Already credited (idempotent retry)

**Returns `(nil, error)` only for:**

- Empty `jobID` or `candidateID`
- Unexpected database errors

**Important**: The candidate apply flow should not fail if scout crediting fails. Most jobs won't be from scouts, so `(nil, nil)` is the normal case. Only log actual errors (non-nil `err`), and never fail the apply.

## Notes

- **No hold period**: Apply earnings are released immediately (unlike approval/hire rewards which have a 14-day hold)
- **Only approved submissions**: Credits only for submissions in `approved` status that made it into the search pool. Newest `submittedAt` wins; `_id` breaks ties.
- **Atomicity**: Single write operation (earning with dedupe fields) ensures exactly-once credit even after retries
- **Attribution**: The job's `jobId` must match a submission's `jobId` field for attribution to work. The `{jobId, status, submittedAt, _id}` index is what `EnsureIndexes` creates for this lookup.
- **Race safety**: Concurrent applies by same candidate to same job are handled via unique partial index
- **No Stripe/payouts**: This step adds earnings tracking only; actual money movement is separate
