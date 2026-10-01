package candidate

import (
	"context"
	"time"

	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo/options"
)

func (s *Store) SavedJobIDs(ctx context.Context, userID string) ([]string, error) {
	saved, err := s.listSaved(ctx, userID)
	if err != nil {
		return nil, err
	}
	ids := make([]string, 0, len(saved))
	for _, item := range saved {
		ids = append(ids, item.JobID)
	}
	return ids, nil
}

func (s *Store) SaveJob(ctx context.Context, userID, jobID string, now time.Time) error {
	if s.catalog == nil {
		return ErrInvalidInput
	}
	listing, err := s.catalog.Lookup(ctx, jobID)
	if err != nil {
		return err
	}
	id, err := newPublicID()
	if err != nil {
		return err
	}
	_, err = s.collection(savedJobsCollection).UpdateOne(ctx, bson.D{
		{Key: "userId", Value: userID},
		{Key: "jobId", Value: listing.ID},
	}, bson.D{{Key: "$setOnInsert", Value: SavedJob{
		ID:        id,
		UserID:    userID,
		JobID:     listing.ID,
		Title:     listing.Title,
		Company:   listing.Company,
		CompanyID: listing.CompanyID,
		Location:  listing.Location,
		Salary:    listing.Salary,
		Source:    applicationSource(listing.Source),
		SavedAt:   now.UTC(),
	}}}, options.UpdateOne().SetUpsert(true))
	return err
}

func (s *Store) UnsaveJob(ctx context.Context, userID, jobID string) error {
	_, err := s.collection(savedJobsCollection).DeleteOne(ctx, bson.D{
		{Key: "userId", Value: userID},
		{Key: "jobId", Value: jobID},
	})
	return err
}

func (s *Store) listSaved(ctx context.Context, userID string) ([]SavedJob, error) {
	cursor, err := s.collection(savedJobsCollection).Find(ctx, bson.D{{Key: "userId", Value: userID}}, options.Find().SetSort(bson.D{{Key: "savedAt", Value: -1}}))
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)
	items := []SavedJob{}
	if err := cursor.All(ctx, &items); err != nil {
		return nil, err
	}
	return items, nil
}

func (s *Store) listing(ctx context.Context, jobID string) (Listing, error) {
	if s.catalog == nil {
		return Listing{}, ErrInvalidInput
	}
	listing, err := s.catalog.Lookup(ctx, jobID)
	if err != nil {
		return Listing{}, err
	}
	if listing.Source != SourceDirect {
		listing.Source = SourceScouted
	}
	return listing, nil
}
