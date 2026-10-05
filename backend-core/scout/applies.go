package scout

import (
	"context"
	"errors"
	"fmt"
	"time"

	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo"
	"go.mongodb.org/mongo-driver/v2/mongo/options"
)

// ErrNotScoutJob is returned when a job did not come from a scout submission.
var ErrNotScoutJob = errors.New("job not from scout submission")

// RecordApply credits the scout when a candidate applies to their job. It is
// idempotent: one candidate applying twice to the same job earns once.
// Returns the earning if one was created, or nil if already recorded.
// Returns (nil, nil) when the job did not come from a scout submission.
func (s *Store) RecordApply(ctx context.Context, jobID, candidateID string, appliedAt time.Time) (*Earning, error) {
	if jobID == "" || candidateID == "" {
		return nil, fmt.Errorf("jobID and candidateID are required")
	}

	// Find the submission that sourced this job (uses hook for testing).
	sub, err := s.findSubmissionByJobID(ctx, jobID)
	if errors.Is(err, ErrNotFound) {
		// Job not from a scout submission - quiet no-op
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("find submission: %w", err)
	}

	// Only credit for approved submissions that made it into the pool
	if sub.Status != StatusApproved {
		return nil, nil
	}

	now := s.now().UTC()
	reward := cents(s.config.ApplyRewardCents)

	// Create the earning with a dedupe key. Use a single write as the source of truth.
	// The unique partial index on (type=apply, submissionId, jobId, candidateId) ensures
	// exactly one earning per (job, candidate) apply.
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

	// Insert earning (uses hook for testing).
	if err := s.insertEarning(ctx, earning); err != nil {
		if mongo.IsDuplicateKeyError(err) {
			// Already credited - idempotent
			return nil, nil
		}
		return nil, fmt.Errorf("create earning: %w", err)
	}

	earning.fill()
	s.notifyReward(ctx, sub.ScoutUserID, earning)
	return &earning, nil
}

// insertEarningMongo is the production MongoDB insert.
func (s *Store) insertEarningMongo(ctx context.Context, earning Earning) error {
	_, err := s.collection(earningsCollection).InsertOne(ctx, earning)
	return err
}

// applyCreditSubmissionFilter is the lookup used by apply crediting.
func applyCreditSubmissionFilter(jobID string) bson.D {
	return bson.D{
		{Key: "jobId", Value: jobID},
		{Key: "status", Value: StatusApproved},
	}
}

// applyCreditSubmissionSort picks the newest approved row: submittedAt desc, then _id desc.
func applyCreditSubmissionSort() bson.D {
	return bson.D{
		{Key: "submittedAt", Value: -1},
		{Key: "_id", Value: -1},
	}
}

// applyCreditSubmissionIndex supports the approved + newest-submittedAt lookup.
func applyCreditSubmissionIndex() bson.D {
	return bson.D{
		{Key: "jobId", Value: 1},
		{Key: "status", Value: 1},
		{Key: "submittedAt", Value: -1},
		{Key: "_id", Value: -1},
	}
}

// newestApprovedSubmission is the in-memory form of submissionByJobID. Tests and
// fake storage hooks call this so crediting uses the same approved/newest rule
// without a live MongoDB.
func newestApprovedSubmission(jobID string, subs []Submission) (Submission, error) {
	var best Submission
	found := false
	for _, sub := range subs {
		if sub.JobID != jobID || sub.Status != StatusApproved {
			continue
		}
		if !found || submissionIsNewer(sub, best) {
			best = sub
			found = true
		}
	}
	if !found {
		return Submission{}, ErrNotFound
	}
	best.fill()
	return best, nil
}

func submissionIsNewer(a, b Submission) bool {
	aAt := submissionSubmittedAt(a)
	bAt := submissionSubmittedAt(b)
	if aAt.After(bAt) {
		return true
	}
	if aAt.Before(bAt) {
		return false
	}
	return a.ObjectID.Hex() > b.ObjectID.Hex()
}

func submissionSubmittedAt(s Submission) time.Time {
	if !s.SubmittedAt.IsZero() {
		return s.SubmittedAt
	}
	return s.ObjectID.Timestamp()
}

// submissionByJobID finds the newest approved submission that produced jobID.
func (s *Store) submissionByJobID(ctx context.Context, jobID string) (Submission, error) {
	var sub Submission
	err := s.collection(submissionsCollection).FindOne(
		ctx,
		applyCreditSubmissionFilter(jobID),
		options.FindOne().SetSort(applyCreditSubmissionSort()),
	).Decode(&sub)
	if err == mongo.ErrNoDocuments {
		return Submission{}, ErrNotFound
	}
	if err != nil {
		return Submission{}, err
	}
	sub.fill()
	return sub, nil
}
