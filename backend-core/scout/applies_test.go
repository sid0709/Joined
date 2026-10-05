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

	custom := Config{ApplyRewardCents: 100}
	table = Rewards(custom)
	if table.ApplyReward.AmountCents != 100 {
		t.Errorf("Rewards(custom).ApplyReward.AmountCents = %d, want 100", table.ApplyReward.AmountCents)
	}
}

// fakeStorage provides in-memory storage for testing the production RecordApply.
type fakeStorage struct {
	submissions map[string]Submission
	earnings    []Earning
	nextErr     error // If set, next insert returns this error then clears it
}

func newFakeStorage() *fakeStorage {
	return &fakeStorage{
		submissions: make(map[string]Submission),
		earnings:    []Earning{},
	}
}

func (f *fakeStorage) findSubmission(ctx context.Context, jobID string) (Submission, error) {
	subs := make([]Submission, 0, len(f.submissions))
	for _, sub := range f.submissions {
		subs = append(subs, sub)
	}
	return newestApprovedSubmission(jobID, subs)
}

func (f *fakeStorage) insertEarning(ctx context.Context, earning Earning) error {
	if f.nextErr != nil {
		err := f.nextErr
		f.nextErr = nil
		return err
	}

	// Check for duplicate
	for _, e := range f.earnings {
		if e.Type == RewardApply && e.SubmissionID == earning.SubmissionID &&
			e.JobID == earning.JobID && e.CandidateID == earning.CandidateID {
			// Return an error that mongo.IsDuplicateKeyError recognizes
			return mongo.WriteException{
				WriteErrors: []mongo.WriteError{{Code: 11000, Message: "duplicate key"}},
			}
		}
	}

	f.earnings = append(f.earnings, earning)
	return nil
}

func newTestStore(storage *fakeStorage) *Store {
	s := &Store{
		config: DefaultConfig(),
		now:    func() time.Time { return time.Date(2026, 10, 5, 10, 0, 0, 0, time.UTC) },
	}
	s.findSubmissionByJobID = storage.findSubmission
	s.insertEarning = storage.insertEarning
	s.notifyReward = func(ctx context.Context, userID string, earning Earning) {}
	return s
}

func TestRecordApply(t *testing.T) {
	ctx := context.Background()
	storage := newFakeStorage()
	store := newTestStore(storage)

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
	storage.submissions[sub.ID] = sub

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
		if len(storage.earnings) != 1 {
			t.Errorf("expected 1 earning in storage, got %d", len(storage.earnings))
		}
	})

	t.Run("duplicate apply is idempotent", func(t *testing.T) {
		beforeCount := len(storage.earnings)
		earning, err := store.RecordApply(ctx, jobID, candidateID, appliedAt)
		if err != nil {
			t.Fatalf("RecordApply (duplicate): %v", err)
		}
		if earning != nil {
			t.Errorf("expected nil for duplicate, got earning")
		}
		if len(storage.earnings) != beforeCount {
			t.Errorf("expected %d earnings (unchanged), got %d", beforeCount, len(storage.earnings))
		}
	})

	t.Run("different candidate creates new earning", func(t *testing.T) {
		candidateID2 := "candidate-789"
		beforeCount := len(storage.earnings)
		earning, err := store.RecordApply(ctx, jobID, candidateID2, appliedAt)
		if err != nil {
			t.Fatalf("RecordApply (different candidate): %v", err)
		}
		if earning == nil {
			t.Fatal("expected earning for different candidate")
		}
		if len(storage.earnings) != beforeCount+1 {
			t.Errorf("expected %d earnings, got %d", beforeCount+1, len(storage.earnings))
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
		storage.submissions[sub2.ID] = sub2

		beforeCount := len(storage.earnings)
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
		if len(storage.earnings) != beforeCount+1 {
			t.Errorf("expected %d earnings, got %d", beforeCount+1, len(storage.earnings))
		}
	})

	t.Run("job not from scout is quiet no-op", func(t *testing.T) {
		unknownJobID := "job-unknown"
		beforeCount := len(storage.earnings)
		earning, err := store.RecordApply(ctx, unknownJobID, candidateID, appliedAt)
		if err != nil {
			t.Errorf("expected no error for non-scout job, got %v", err)
		}
		if earning != nil {
			t.Errorf("expected nil for non-scout job, got earning")
		}
		if len(storage.earnings) != beforeCount {
			t.Errorf("expected %d earnings (unchanged), got %d", beforeCount, len(storage.earnings))
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
		storage.submissions[sub3.ID] = sub3

		beforeCount := len(storage.earnings)
		earning, err := store.RecordApply(ctx, jobID3, "candidate-999", appliedAt)
		if err != nil {
			t.Errorf("expected no error for unapproved job, got %v", err)
		}
		if earning != nil {
			t.Errorf("expected nil for unapproved job, got earning")
		}
		if len(storage.earnings) != beforeCount {
			t.Errorf("expected %d earnings (unchanged), got %d", beforeCount, len(storage.earnings))
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
		storage.submissions[sub4.ID] = sub4

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
		storage.submissions[sub5.ID] = sub5

		candidateID4 := "candidate-retry"
		beforeCount := len(storage.earnings)

		// First call: simulate write failure
		storage.nextErr = errors.New("simulated network failure")
		earning1, err1 := store.RecordApply(ctx, jobID5, candidateID4, appliedAt)
		if err1 == nil {
			t.Fatal("expected error on first call with simulated failure")
		}
		if earning1 != nil {
			t.Error("expected nil earning on error")
		}
		if len(storage.earnings) != beforeCount {
			t.Errorf("earning should not be saved after failure, got %d earnings", len(storage.earnings))
		}

		// Second call: should succeed and create exactly one earning
		earning2, err2 := store.RecordApply(ctx, jobID5, candidateID4, appliedAt)
		if err2 != nil {
			t.Fatalf("expected success on retry, got error: %v", err2)
		}
		if earning2 == nil {
			t.Fatal("expected earning on retry")
		}
		if len(storage.earnings) != beforeCount+1 {
			t.Errorf("expected %d earnings after retry, got %d", beforeCount+1, len(storage.earnings))
		}

		// Third call: idempotent, should not create another earning
		earning3, err3 := store.RecordApply(ctx, jobID5, candidateID4, appliedAt)
		if err3 != nil {
			t.Fatalf("expected success on third call, got error: %v", err3)
		}
		if earning3 != nil {
			t.Error("expected nil on duplicate (idempotent)")
		}
		if len(storage.earnings) != beforeCount+1 {
			t.Errorf("expected %d earnings (no change on third call), got %d", beforeCount+1, len(storage.earnings))
		}

		// Verify exactly one earning for this (job, candidate) pair
		count := 0
		for _, e := range storage.earnings {
			if e.JobID == jobID5 && e.CandidateID == candidateID4 {
				count++
			}
		}
		if count != 1 {
			t.Errorf("expected exactly 1 earning for (job, candidate) pair, got %d", count)
		}
	})
}

func seedApplySubmission(storage *fakeStorage, jobID, scoutUserID, status string, submittedAt time.Time) Submission {
	sub := Submission{
		ObjectID:    bson.NewObjectIDFromTimestamp(submittedAt),
		ScoutUserID: scoutUserID,
		JobID:       jobID,
		Title:       "Software Engineer",
		CompanyName: "Acme Inc",
		Status:      status,
		SubmittedAt: submittedAt,
	}
	sub.fill()
	storage.submissions[sub.ID] = sub
	return sub
}

func TestRecordApplyCreditsApprovedAmongStaleRows(t *testing.T) {
	ctx := context.Background()
	storage := newFakeStorage()
	store := newTestStore(storage)
	jobID := "job-mixed-status"
	scoutUserID := "scout-approved"
	older := time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC)
	newer := time.Date(2026, 6, 1, 0, 0, 0, 0, time.UTC)
	newest := time.Date(2026, 9, 1, 0, 0, 0, 0, time.UTC)

	seedApplySubmission(storage, jobID, "scout-rejected", StatusRejected, newest)
	seedApplySubmission(storage, jobID, "scout-review", StatusNeedsReview, newer)
	approved := seedApplySubmission(storage, jobID, scoutUserID, StatusApproved, older)

	earning, err := store.RecordApply(ctx, jobID, "candidate-mixed", store.now())
	if err != nil {
		t.Fatalf("RecordApply: %v", err)
	}
	if earning == nil {
		t.Fatal("expected earning from the approved submission")
	}
	if earning.SubmissionID != approved.ID {
		t.Errorf("earning.SubmissionID = %q, want approved %q", earning.SubmissionID, approved.ID)
	}
	if earning.ScoutUserID != scoutUserID {
		t.Errorf("earning.ScoutUserID = %q, want %q", earning.ScoutUserID, scoutUserID)
	}
}

func TestRecordApplyCreditsNewestApproved(t *testing.T) {
	ctx := context.Background()
	storage := newFakeStorage()
	store := newTestStore(storage)
	jobID := "job-two-approved"
	older := time.Date(2026, 2, 1, 0, 0, 0, 0, time.UTC)
	newer := time.Date(2026, 8, 1, 0, 0, 0, 0, time.UTC)

	seedApplySubmission(storage, jobID, "scout-old", StatusApproved, older)
	newest := seedApplySubmission(storage, jobID, "scout-new", StatusApproved, newer)

	earning, err := store.RecordApply(ctx, jobID, "candidate-newest", store.now())
	if err != nil {
		t.Fatalf("RecordApply: %v", err)
	}
	if earning == nil {
		t.Fatal("expected earning from the newest approved submission")
	}
	if earning.SubmissionID != newest.ID {
		t.Errorf("earning.SubmissionID = %q, want newest %q", earning.SubmissionID, newest.ID)
	}
	if earning.ScoutUserID != "scout-new" {
		t.Errorf("earning.ScoutUserID = %q, want %q", earning.ScoutUserID, "scout-new")
	}

	t.Run("same submittedAt uses higher id", func(t *testing.T) {
		storage := newFakeStorage()
		store := newTestStore(storage)
		jobID := "job-id-tie"
		same := time.Date(2026, 4, 1, 0, 0, 0, 0, time.UTC)
		first := seedApplySubmission(storage, jobID, "scout-a", StatusApproved, same)
		second := seedApplySubmission(storage, jobID, "scout-b", StatusApproved, same)
		want := first
		if second.ObjectID.Hex() > first.ObjectID.Hex() {
			want = second
		}

		earning, err := store.RecordApply(ctx, jobID, "candidate-tie", store.now())
		if err != nil {
			t.Fatalf("RecordApply: %v", err)
		}
		if earning == nil {
			t.Fatal("expected earning from the higher _id approved submission")
		}
		if earning.SubmissionID != want.ID {
			t.Errorf("earning.SubmissionID = %q, want _id-desc %q", earning.SubmissionID, want.ID)
		}
	})
}

func TestApplyCreditLookupQuery(t *testing.T) {
	filter := applyCreditSubmissionFilter("job-query")
	if len(filter) != 2 || filter[0].Key != "jobId" || filter[0].Value != "job-query" {
		t.Fatalf("filter jobId = %#v, want job-query", filter)
	}
	if filter[1].Key != "status" || filter[1].Value != StatusApproved {
		t.Fatalf("filter status = %#v, want %q", filter[1], StatusApproved)
	}

	sort := applyCreditSubmissionSort()
	if len(sort) != 2 || sort[0].Key != "submittedAt" || sort[0].Value != -1 {
		t.Fatalf("sort[0] = %#v, want submittedAt:-1", sort)
	}
	if sort[1].Key != "_id" || sort[1].Value != -1 {
		t.Fatalf("sort[1] = %#v, want _id:-1", sort)
	}
}

func TestApplyCreditSubmissionIndexMatchesSort(t *testing.T) {
	index := applyCreditSubmissionIndex()
	if len(index) != 4 {
		t.Fatalf("index = %#v, want jobId,status,submittedAt,_id", index)
	}
	if index[0].Key != "jobId" || index[0].Value != 1 {
		t.Fatalf("index[0] = %#v, want jobId:1", index[0])
	}
	if index[1].Key != "status" || index[1].Value != 1 {
		t.Fatalf("index[1] = %#v, want status:1", index[1])
	}
	if index[2].Key != "submittedAt" || index[2].Value != -1 {
		t.Fatalf("index[2] = %#v, want submittedAt:-1", index[2])
	}
	if index[3].Key != "_id" || index[3].Value != -1 {
		t.Fatalf("index[3] = %#v, want _id:-1", index[3])
	}
}

func TestApplyCreditSortKeyExistsOnSubmission(t *testing.T) {
	sort := applyCreditSubmissionSort()
	if len(sort) == 0 {
		t.Fatal("empty apply credit sort")
	}
	sub := Submission{SubmittedAt: time.Date(2026, 5, 1, 12, 0, 0, 0, time.UTC)}
	raw, err := bson.Marshal(sub)
	if err != nil {
		t.Fatalf("marshal submission: %v", err)
	}
	var doc bson.M
	if err := bson.Unmarshal(raw, &doc); err != nil {
		t.Fatalf("unmarshal submission: %v", err)
	}
	if _, ok := doc[sort[0].Key]; !ok {
		t.Fatalf("sort key %q is not a bson field on Submission; document keys %v", sort[0].Key, doc)
	}
}

func TestRecordApplyNoEarningWhenOnlyNonApproved(t *testing.T) {
	ctx := context.Background()
	storage := newFakeStorage()
	store := newTestStore(storage)
	jobID := "job-none-approved"
	at := time.Date(2026, 3, 1, 0, 0, 0, 0, time.UTC)

	seedApplySubmission(storage, jobID, "scout-rejected", StatusRejected, at)
	seedApplySubmission(storage, jobID, "scout-review", StatusNeedsReview, at.Add(time.Hour))

	earning, err := store.RecordApply(ctx, jobID, "candidate-none", store.now())
	if err != nil {
		t.Errorf("expected no error when no approved submission, got %v", err)
	}
	if earning != nil {
		t.Errorf("expected no earning when no approved submission, got %+v", earning)
	}
	if len(storage.earnings) != 0 {
		t.Errorf("expected 0 earnings, got %d", len(storage.earnings))
	}
}
