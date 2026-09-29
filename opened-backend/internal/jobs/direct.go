package jobs

import (
	"context"
	"errors"
	"time"

	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo"
)

const (
	// DirectSource marks a job a company published from the hiring workspace.
	DirectSource = "direct"
	directModel  = "employer"
	directType   = "direct"
)

// UpsertDirectJob publishes a company job into search so candidates can apply.
// The public id is stable across pause and resume. The returned listing status
// is active for a verified company and pending_review otherwise. A staff or
// suspension takedown is kept until staff restore it.
func (s *Store) UpsertDirectJob(ctx context.Context, job SearchJob, createdBy string, now time.Time) (string, error) {
	if job.ID == "" || job.CompanyID == "" || job.Title == "" {
		return "", ErrInvalidInput
	}
	job.Source = directType
	if job.Skills == nil {
		job.Skills = []string{}
	}
	if job.Responsibilities == nil {
		job.Responsibilities = []string{}
	}
	if job.Requirements == nil {
		job.Requirements = []string{}
	}
	if job.Benefits == nil {
		job.Benefits = []string{}
	}

	var existing storedSearchJob
	err := s.structured().FindOne(ctx, bson.D{{Key: "job.id", Value: job.ID}}).Decode(&existing)
	found := err == nil
	id := bson.NewObjectID()
	posted := now.UTC()
	if found {
		id = existing.ID
		if !existing.PostedAt.IsZero() {
			posted = existing.PostedAt
		}
	} else if !errors.Is(err, mongo.ErrNoDocuments) {
		return "", err
	}
	trust, err := s.companyTrustStatus(ctx, job.CompanyID)
	if err != nil {
		return "", err
	}
	doc := storedSearchJob{
		ID:            id,
		PostedAt:      posted,
		AnalyzedAt:    now.UTC(),
		Model:         directModel,
		CreatedBy:     createdBy,
		Source:        DirectSource,
		ListingStatus: ListingStatusForTrust(trust),
		Job:           job,
	}
	if found && heldDown(existing) {
		doc.ListingStatus = ListingRemoved
		doc.PreviousListingStatus = existing.PreviousListingStatus
		doc.TakedownCause = existing.TakedownCause
		doc.ReviewNote = existing.ReviewNote
		doc.ReviewedBy = existing.ReviewedBy
		doc.ReviewedAt = existing.ReviewedAt
	}
	if err := s.saveSearchJob(ctx, doc); err != nil {
		return "", err
	}
	return doc.ListingStatus, nil
}

// RenameDirectTeam updates the team name on this company's published jobs.
func (s *Store) RenameDirectTeam(ctx context.Context, companyID, from, to string) error {
	if companyID == "" || from == "" || to == "" {
		return nil
	}
	_, err := s.structured().UpdateMany(ctx, bson.D{
		{Key: "job.companyId", Value: companyID},
		{Key: "job.team", Value: from},
		{Key: "source", Value: DirectSource},
	}, bson.D{{Key: "$set", Value: bson.D{{Key: "job.team", Value: to}}}})
	return err
}

// RemoveDirectJob hides a company job from search. The hiring record stays.
func (s *Store) RemoveDirectJob(ctx context.Context, publicID string) error {
	if publicID == "" {
		return nil
	}
	_, err := s.structured().DeleteOne(ctx, bson.D{
		{Key: "job.id", Value: publicID},
		{Key: "source", Value: DirectSource},
	})
	return err
}
