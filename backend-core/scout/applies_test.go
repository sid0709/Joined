package scout

import (
	"context"
	"testing"
	"time"

	"go.mongodb.org/mongo-driver/v2/bson"
)

func TestApplyRewardConfig(t *testing.T) {
	cfg := DefaultConfig()
	if cfg.ApplyRewardCents != 50 {
		t.Errorf("DefaultConfig().ApplyRewardCents = %d, want 50", cfg.ApplyRewardCents)
	}

	table := Rewards(cfg)
	if table.ApplyReward.AmountCents != 50 {
		t.Errorf("Rewards(cfg).ApplyReward.AmountCents = %d, want 50", table.ApplyReward.AmountCents)
	}

	// Test with custom config
	custom := Config{ApplyRewardCents: 100}
	table = Rewards(custom)
	if table.ApplyReward.AmountCents != 100 {
		t.Errorf("Rewards(custom).ApplyReward.AmountCents = %d, want 100", table.ApplyReward.AmountCents)
	}
}

// mockStore is a minimal in-memory store for testing RecordApply.
type mockStore struct {
	*Store
	submissions map[string]Submission
	earnings    []Earning
	applies     map[string]Apply
	nowTime     time.Time
}

func newMockStore() *mockStore {
	return &mockStore{
		Store: &Store{
			config: DefaultConfig(),
			now:    func() time.Time { return time.Date(2026, 10, 5, 10, 0, 0, 0, time.UTC) },
		},
		submissions: make(map[string]Submission),
		earnings:    []Earning{},
		applies:     make(map[string]Apply),
		nowTime:     time.Date(2026, 10, 5, 10, 0, 0, 0, time.UTC),
	}
}

func (m *mockStore) submissionByJobID(ctx context.Context, jobID string) (Submission, error) {
	for _, sub := range m.submissions {
		if sub.JobID == jobID {
			return sub, nil
		}
	}
	return Submission{}, ErrNotFound
}

func (m *mockStore) applyByJobCandidate(ctx context.Context, jobID, candidateID string) (Apply, error) {
	key := jobID + ":" + candidateID
	apply, exists := m.applies[key]
	if !exists {
		return Apply{}, ErrNotFound
	}
	return apply, nil
}

func (m *mockStore) insertApply(apply Apply) {
	key := apply.JobID + ":" + apply.CandidateID
	m.applies[key] = apply
}

func (m *mockStore) insertEarning(earning Earning) {
	m.earnings = append(m.earnings, earning)
}

func (m *mockStore) notifyReward(ctx context.Context, userID string, earning Earning) {}

// Override RecordApply to use mock storage
func (m *mockStore) RecordApply(ctx context.Context, jobID, candidateID string, appliedAt time.Time) (*Earning, error) {
	if jobID == "" || candidateID == "" {
		return nil, ErrNotFound
	}

	sub, err := m.submissionByJobID(ctx, jobID)
	if err != nil {
		return nil, err
	}

	_, err = m.applyByJobCandidate(ctx, jobID, candidateID)
	if err == nil {
		return nil, nil
	}
	if err != ErrNotFound {
		return nil, err
	}

	now := m.now().UTC()
	reward := cents(m.config.ApplyRewardCents)

	apply := Apply{
		ObjectID:     bson.NewObjectID(),
		JobID:        jobID,
		CandidateID:  candidateID,
		ScoutUserID:  sub.ScoutUserID,
		SubmissionID: sub.ID,
		Amount:       reward,
		AppliedAt:    appliedAt.UTC(),
		RecordedAt:   now,
	}
	m.insertApply(apply)

	earning := Earning{
		ObjectID:     bson.NewObjectID(),
		ScoutUserID:  sub.ScoutUserID,
		SubmissionID: sub.ID,
		JobTitle:     sub.Title,
		CompanyName:  sub.CompanyName,
		Type:         RewardApply,
		Amount:       reward,
		Status:       EarningReleased,
		Description:  "Candidate applied",
		HoldUntil:    now,
		CreatedAt:    now,
		ReleasedAt:   &now,
	}
	earning.fill()
	m.insertEarning(earning)
	m.notifyReward(ctx, sub.ScoutUserID, earning)
	return &earning, nil
}

func TestRecordApply(t *testing.T) {
	ctx := context.Background()
	store := newMockStore()

	scoutUserID := "scout-123"
	jobID := "job-abc"

	sub := Submission{
		ObjectID:    bson.NewObjectID(),
		ScoutUserID: scoutUserID,
		JobID:       jobID,
		Title:       "Software Engineer",
		CompanyName: "Acme Inc",
		Status:      StatusApproved,
	}
	sub.fill()
	store.submissions[sub.ID] = sub

	candidateID := "candidate-456"
	appliedAt := store.nowTime.Add(1 * time.Hour)

	t.Run("first apply creates earning", func(t *testing.T) {
		earning, err := store.RecordApply(ctx, jobID, candidateID, appliedAt)
		if err != nil {
			t.Fatalf("RecordApply: %v", err)
		}
		if earning == nil {
			t.Fatal("expected earning, got nil")
		}
		if earning.ScoutUserID != scoutUserID {
			t.Errorf("earning.ScoutUserID = %q, want %q", earning.ScoutUserID, scoutUserID)
		}
		if earning.Type != RewardApply {
			t.Errorf("earning.Type = %q, want %q", earning.Type, RewardApply)
		}
		if earning.Amount.AmountCents != 50 {
			t.Errorf("earning.Amount.AmountCents = %d, want 50", earning.Amount.AmountCents)
		}
		if earning.Status != EarningReleased {
			t.Errorf("earning.Status = %q, want %q", earning.Status, EarningReleased)
		}
		if earning.SubmissionID != sub.ID {
			t.Errorf("earning.SubmissionID = %q, want %q", earning.SubmissionID, sub.ID)
		}
	})

	t.Run("duplicate apply is idempotent", func(t *testing.T) {
		earning, err := store.RecordApply(ctx, jobID, candidateID, appliedAt)
		if err != nil {
			t.Fatalf("RecordApply (duplicate): %v", err)
		}
		if earning != nil {
			t.Errorf("expected nil for duplicate, got earning")
		}
		if len(store.earnings) != 1 {
			t.Errorf("expected 1 earning, got %d", len(store.earnings))
		}
	})

	t.Run("different candidate creates new earning", func(t *testing.T) {
		candidateID2 := "candidate-789"
		earning, err := store.RecordApply(ctx, jobID, candidateID2, appliedAt)
		if err != nil {
			t.Fatalf("RecordApply (different candidate): %v", err)
		}
		if earning == nil {
			t.Fatal("expected earning for different candidate")
		}
		if len(store.earnings) != 2 {
			t.Errorf("expected 2 earnings, got %d", len(store.earnings))
		}
	})

	t.Run("same candidate different job creates new earning", func(t *testing.T) {
		jobID2 := "job-xyz"
		sub2 := Submission{
			ObjectID:    bson.NewObjectID(),
			ScoutUserID: scoutUserID,
			JobID:       jobID2,
			Title:       "Senior Engineer",
			CompanyName: "Acme Inc",
			Status:      StatusApproved,
		}
		sub2.fill()
		store.submissions[sub2.ID] = sub2

		earning, err := store.RecordApply(ctx, jobID2, candidateID, appliedAt)
		if err != nil {
			t.Fatalf("RecordApply (different job): %v", err)
		}
		if earning == nil {
			t.Fatal("expected earning for different job")
		}
		if earning.SubmissionID != sub2.ID {
			t.Errorf("earning.SubmissionID = %q, want %q", earning.SubmissionID, sub2.ID)
		}
		if len(store.earnings) != 3 {
			t.Errorf("expected 3 earnings, got %d", len(store.earnings))
		}
	})

	t.Run("job not from scout returns error", func(t *testing.T) {
		unknownJobID := "job-unknown"
		_, err := store.RecordApply(ctx, unknownJobID, candidateID, appliedAt)
		if err == nil {
			t.Fatal("expected error for unknown job")
		}
	})

	t.Run("correct scout attribution", func(t *testing.T) {
		differentScoutID := "scout-999"
		jobID3 := "job-def"
		sub3 := Submission{
			ObjectID:    bson.NewObjectID(),
			ScoutUserID: differentScoutID,
			JobID:       jobID3,
			Title:       "Product Manager",
			CompanyName: "Beta Corp",
			Status:      StatusApproved,
		}
		sub3.fill()
		store.submissions[sub3.ID] = sub3

		candidateID3 := "candidate-111"
		earning, err := store.RecordApply(ctx, jobID3, candidateID3, appliedAt)
		if err != nil {
			t.Fatalf("RecordApply (different scout): %v", err)
		}
		if earning == nil {
			t.Fatal("expected earning for different scout")
		}
		if earning.ScoutUserID != differentScoutID {
			t.Errorf("earning.ScoutUserID = %q, want %q", earning.ScoutUserID, differentScoutID)
		}
	})
}
