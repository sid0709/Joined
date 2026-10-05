package scout

import (
	"context"
	"fmt"
	"time"

	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo"
)

// Apply tracks one candidate applying to one scout-submitted job. It ensures
// the scout earns once per unique (job, candidate) pair.
type Apply struct {
	ObjectID    bson.ObjectID `bson:"_id"`
	JobID       string        `bson:"jobId"`
	CandidateID string        `bson:"candidateId"`
	ScoutUserID string        `bson:"scoutUserId"`
	SubmissionID string       `bson:"submissionId"`
	Amount      Money         `bson:"amount"`
	AppliedAt   time.Time     `bson:"appliedAt"`
	RecordedAt  time.Time     `bson:"recordedAt"`
}

// RecordApply credits the scout when a candidate applies to their job. It is
// idempotent: one candidate applying twice to the same job earns once.
// Returns the earning if one was created, or nil if already recorded.
func (s *Store) RecordApply(ctx context.Context, jobID, candidateID string, appliedAt time.Time) (*Earning, error) {
	if jobID == "" || candidateID == "" {
		return nil, fmt.Errorf("jobID and candidateID are required")
	}

	// Find the submission that sourced this job.
	sub, err := s.submissionByJobID(ctx, jobID)
	if err != nil {
		return nil, fmt.Errorf("find submission: %w", err)
	}

	// Idempotency: check if already recorded.
	_, err = s.applyByJobCandidate(ctx, jobID, candidateID)
	if err == nil {
		// Already recorded, return nil (not an error).
		return nil, nil
	}
	if err != ErrNotFound {
		return nil, fmt.Errorf("check existing apply: %w", err)
	}

	now := s.now().UTC()
	reward := ApplyReward()

	// Record the apply.
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

	if _, err := s.collection(appliesCollection).InsertOne(ctx, apply); err != nil {
		if mongo.IsDuplicateKeyError(err) {
			// Race: another goroutine recorded it first.
			return nil, nil
		}
		return nil, fmt.Errorf("insert apply: %w", err)
	}

	// Create the earning.
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

	if _, err := s.collection(earningsCollection).InsertOne(ctx, earning); err != nil {
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

// applyByJobCandidate checks if an apply already exists.
func (s *Store) applyByJobCandidate(ctx context.Context, jobID, candidateID string) (Apply, error) {
	var apply Apply
	err := s.collection(appliesCollection).FindOne(ctx, bson.D{
		{Key: "jobId", Value: jobID},
		{Key: "candidateId", Value: candidateID},
	}).Decode(&apply)
	if err == mongo.ErrNoDocuments {
		return Apply{}, ErrNotFound
	}
	if err != nil {
		return Apply{}, err
	}
	return apply, nil
}
