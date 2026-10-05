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
- **Deduplication**: Uses unique index on `(jobId, candidateId)` in `scout_applies` collection
- **Immediate release**: Apply earnings are released immediately (no hold period)
- **Returns**: The created earning if this is the first apply, or `nil` if already recorded (not an error)

**Example usage:**

```go
import (
    "github.com/sid0709/OpenSeat/backend-core/scout"
)

// In your candidate apply handler:
func handleCandidateApply(ctx context.Context, jobID, candidateID string) error {
    appliedAt := time.Now()

    // ... existing apply logic ...

    // Credit the scout if this job came from a scout submission
    earning, err := scoutStore.RecordApply(ctx, jobID, candidateID, appliedAt)
    if err != nil {
        // Log but don't fail the apply if scout crediting fails
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

The apply reward is configured in `backend-core/scout/rewards.go`:

```go
const ApplyRewardCents = 50  // $0.50 per qualifying apply
```

To change the rate:

1. Update the constant in `rewards.go`
2. The new rate applies to all future applies
3. No code changes needed elsewhere

## Database

### Collection: `scout_applies`

Tracks each credited apply to ensure dedupe.

**Indexes:**

- Unique: `(jobId, candidateId)` - enforces one earning per (job, candidate) pair
- Index: `(scoutUserId, recordedAt)` - for scout's apply history (future use)

### Collection: `scout_earnings`

Stores the earning record. Apply earnings have:

- `type`: `"apply"`
- `status`: `"released"` (immediately available)
- `amount`: `{ "amount_cents": 50, "currency": "USD" }`
- `submissionId`: links back to the scout's submission
- `jobTitle`, `companyName`: context for the scout

## API

Scouts can view their apply earnings via existing Scoutwell endpoints:

### `GET /v1/scout/earnings`

Lists all earnings (including apply rewards).

**Query params:**

- `type=apply` - filter to apply rewards only
- `submission_id={id}` - filter to one job
- `status=released` - filter by status
- `cursor`, `limit` - pagination

**Example:**

```bash
curl -H "Authorization: Bearer $TOKEN" \
  "https://api.scoutwell.com/v1/scout/earnings?type=apply&limit=20"
```

### `GET /v1/scout/stats`

Returns summary including balance (which includes apply earnings).

```json
{
  "balance": {
    "released": { "amount_cents": 1250, "currency": "USD" },
    "lifetime": { "amount_cents": 1250, "currency": "USD" }
  }
}
```

### `GET /v1/scout/meta`

Returns reward table including apply reward rate.

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
    Status:      scout.StatusApproved,
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
```

## Error Handling

`RecordApply` returns an error if:

- `jobID` is empty
- `candidateID` is empty
- Job is not found (not from a scout submission)
- Database errors

**Important**: Apply flow should not fail if scout crediting fails. Log the error and continue.

## Notes

- **No hold period**: Apply earnings are released immediately (unlike approval/hire rewards which have a 14-day hold)
- **Attribution**: The job's `jobId` must match a submission's `jobId` field for attribution to work
- **Race safety**: Concurrent applies by same candidate to same job are handled via unique index
- **No Stripe/payouts**: This step adds earnings tracking only; actual money movement is separate
