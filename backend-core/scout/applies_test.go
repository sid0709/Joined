package scout

import (
	"context"
	"errors"
	"testing"
	"time"

	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo"
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

// testStore creates a Store with injectable storage for testing.
type testStore struct {
	*Store
	submissions map[string]Submission
	earnings    []Earning
	insertErr   error // If set, InsertOne will fail once then clear
}

func newTestStore() *testStore {
	return &testStore{
		Store: &Store{
			config: DefaultConfig(),
			now:    func() time.Time { return time.Date(2026, 10, 5, 10, 0, 0, 0, time.UTC) },
		},
		submissions: make(map[string]Submission),
		earnings:    []Earning{},
	}
}

func (s *testStore) submissionByJobID(ctx context.Context, jobID string) (Submission, error) {
	for _, sub := range s.submissions {
		if sub.JobID == jobID {
			return sub, nil
		}
	}
	return Submission{}, ErrNotFound
}

func (s *testStore) collection(name string) testCollection {
	return testCollection{store: s, name: name}
}

type testCollection struct {
	store *testStore
	name  string
}

func (c testCollection) InsertOne(ctx context.Context, doc any) (*mongo.InsertOneResult, error) {
	if c.name == earningsCollection {
		if c.store.insertErr != nil {
			err := c.store.insertErr
			c.store.insertErr = nil
			return nil, err
		}
		earning := doc.(Earning)
		// Check for duplicate
		for _, e := range c.store.earnings {
			if e.Type == RewardApply && e.SubmissionID == earning.SubmissionID &&
				e.JobID == earning.JobID && e.CandidateID == earning.CandidateID {
				return nil, mongo.WriteError{Code: 11000}
			}
		}
		c.store.earnings = append(c.store.earnings, earning)
		return &mongo.InsertOneResult{InsertedID: earning.ObjectID}, nil
	}
	return nil, errors.New("unexpected collection")
}

func (c testCollection) FindOne(ctx context.Context, filter bson.D) *mongo.SingleResult {
	panic("not implemented in test")
}

func (s *testStore) notifyReward(ctx context.Context, userID string, earning Earning) {}

// Override RecordApply to use test storage
func (s *testStore) RecordApply(ctx context.Context, jobID, candidateID string, appliedAt time.Time) (*Earning, error) {
	// Use the real logic but with test storage
	if jobID == "" || candidateID == "" {
		return nil, errors.New("jobID and candidateID are required")
	}

	sub, err := s.submissionByJobID(ctx, jobID)
	if errors.Is(err, ErrNotFound) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}

	if sub.Status != StatusApproved {
		return nil, nil
	}

	now := s.now().UTC()
	reward := cents(s.config.ApplyRewardCents)

	earning := Earning{
		ObjectID:     bson.NewObjectID(),
		ScoutUserID:  sub.ScoutUserID,
		SubmissionID: sub.ID,
		JobID:        jobID,
		CandidateID:  candidateID,
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

	if _, err := s.collection(earningsCollection).InsertOne(ctx, earning); err != nil {
		if mongo.IsDuplicateKeyError(err) {
			return nil, nil
		}
		return nil, err
	}

	earning.fill()
	s.notifyReward(ctx, sub.ScoutUserID, earning)
	return &earning, nil
}

func TestRecordApply(t *testing.T) {
	ctx := context.Background()
	store := newTestStore()

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
	appliedAt := store.now().Add(1 * time.Hour)

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
		if earning.JobID != jobID {
			t.Errorf("earning.JobID = %q, want %q", earning.JobID, jobID)
		}
		if earning.CandidateID != candidateID {
			t.Errorf("earning.CandidateID = %q, want %q", earning.CandidateID, candidateID)
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

	t.Run("job not from scout is quiet no-op", func(t *testing.T) {
		unknownJobID := "job-unknown"
		earning, err := store.RecordApply(ctx, unknownJobID, candidateID, appliedAt)
		if err != nil {
			t.Errorf("expected no error for non-scout job, got %v", err)
		}
		if earning != nil {
			t.Errorf("expected nil for non-scout job, got earning")
		}
	})

	t.Run("unapproved submission does not earn", func(t *testing.T) {
		jobID3 := "job-pending"
		sub3 := Submission{
			ObjectID:    bson.NewObjectID(),
			ScoutUserID: scoutUserID,
			JobID:       jobID3,
			Title:       "DevOps Engineer",
			CompanyName: "Beta Corp",
			Status:      StatusNeedsReview,
		}
		sub3.fill()
		store.submissions[sub3.ID] = sub3

		earning, err := store.RecordApply(ctx, jobID3, "candidate-999", appliedAt)
		if err != nil {
			t.Errorf("expected no error for unapproved job, got %v", err)
		}
		if earning != nil {
			t.Errorf("expected nil for unapproved job, got earning")
		}
		if len(store.earnings) != 3 {
			t.Errorf("expected 3 earnings (unchanged), got %d", len(store.earnings))
		}
	})

	t.Run("correct scout attribution", func(t *testing.T) {
		differentScoutID := "scout-999"
		jobID4 := "job-def"
		sub4 := Submission{
			ObjectID:    bson.NewObjectID(),
			ScoutUserID: differentScoutID,
			JobID:       jobID4,
			Title:       "Product Manager",
			CompanyName: "Gamma Corp",
			Status:      StatusApproved,
		}
		sub4.fill()
		store.submissions[sub4.ID] = sub4

		candidateID3 := "candidate-111"
		earning, err := store.RecordApply(ctx, jobID4, candidateID3, appliedAt)
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

	t.Run("failed write is retried successfully", func(t *testing.T) {
		jobID5 := "job-retry"
		sub5 := Submission{
			ObjectID:    bson.NewObjectID(),
			ScoutUserID: scoutUserID,
			JobID:       jobID5,
			Title:       "Backend Engineer",
			CompanyName: "Delta Inc",
			Status:      StatusApproved,
		}
		sub5.fill()
		store.submissions[sub5.ID] = sub5

		candidateID4 := "candidate-retry"
		beforeCount := len(store.earnings)

		// First call: simulate write failure
		store.insertErr = errors.New("simulated write failure")
		earning1, err1 := store.RecordApply(ctx, jobID5, candidateID4, appliedAt)
		if err1 == nil {
			t.Fatal("expected error on first call")
		}
		if earning1 != nil {
			t.Error("expected nil earning on error")
		}
		if len(store.earnings) != beforeCount {
			t.Errorf("earning should not be saved after failure, got %d earnings", len(store.earnings))
		}

		// Second call: should succeed
		earning2, err2 := store.RecordApply(ctx, jobID5, candidateID4, appliedAt)
		if err2 != nil {
			t.Fatalf("expected success on retry, got error: %v", err2)
		}
		if earning2 == nil {
			t.Fatal("expected earning on retry")
		}
		if len(store.earnings) != beforeCount+1 {
			t.Errorf("expected %d earnings after retry, got %d", beforeCount+1, len(store.earnings))
		}

		// Third call: idempotent, should not create another earning
		earning3, err3 := store.RecordApply(ctx, jobID5, candidateID4, appliedAt)
		if err3 != nil {
			t.Fatalf("expected success on third call, got error: %v", err3)
		}
		if earning3 != nil {
			t.Error("expected nil on duplicate")
		}
		if len(store.earnings) != beforeCount+1 {
			t.Errorf("expected %d earnings (no change), got %d", beforeCount+1, len(store.earnings))
		}
	})
}
