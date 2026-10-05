package scout

import (
	"context"
	"errors"
	"fmt"
	"time"

	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo"
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

	// Find the submission that sourced this job.
	sub, err := s.submissionByJobID(ctx, jobID)
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

	if _, err := s.collection(earningsCollection).InsertOne(ctx, earning); err != nil {
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

// submissionByJobID finds the submission that produced the given jobID.
func (s *Store) submissionByJobID(ctx context.Context, jobID string) (Submission, error) {
	var sub Submission
	err := s.collection(submissionsCollection).FindOne(ctx, bson.D{
		{Key: "jobId", Value: jobID},
	}).Decode(&sub)
	if err == mongo.ErrNoDocuments {
		return Submission{}, ErrNotFound
	}
	if err != nil {
		return Submission{}, err
	}
	sub.fill()
	return sub, nil
}
