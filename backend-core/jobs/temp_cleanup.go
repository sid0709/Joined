package jobs

import (
	"context"
	"errors"
	"fmt"
	"strings"

	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo"
)

// A temp job or staged company leaves staging for good once it lands in jobs or
// companies, so temp_jobs and temp_companies only hold work still waiting.

// purgeBatch is how many published ids one staging delete names.
const purgeBatch = 1000

// TempPurge counts staged rows dropped because they were already published.
type TempPurge struct {
	Jobs      int64 `json:"jobs"`
	Companies int64 `json:"companies"`
}

// dropTempJob deletes a temp job that was published.
func (s *Store) dropTempJob(ctx context.Context, id bson.ObjectID) error {
	if _, err := s.dest().DeleteOne(ctx, bson.D{{Key: "_id", Value: id}}); err != nil {
		return fmt.Errorf("clear published job from temp jobs: %w", err)
	}
	return nil
}

// PurgePublishedTemp drops temp jobs and staged companies that are already published,
// left from before publishing removed them or by a publish interrupted in between.
func (s *Store) PurgePublishedTemp(ctx context.Context) (TempPurge, error) {
	jobs, err := s.purgePublishedTempJobs(ctx)
	if err != nil {
		return TempPurge{}, err
	}
	_, published, err := s.companyIDsBySource(ctx)
	if err != nil {
		return TempPurge{Jobs: jobs}, err
	}
	companies, err := s.dropPublishedFromStaging(ctx, published)
	return TempPurge{Jobs: jobs, Companies: companies}, err
}

func (s *Store) purgePublishedTempJobs(ctx context.Context) (int64, error) {
	return s.deletePublishedJobs(ctx, s.dest())
}

// deletePublishedJobs deletes the rows of coll that already have a public record.
func (s *Store) deletePublishedJobs(ctx context.Context, coll *mongo.Collection) (int64, error) {
	ids, err := s.analyzedObjectIDs(ctx)
	if err != nil {
		return 0, fmt.Errorf("list published jobs: %w", err)
	}
	var deleted int64
	for start := 0; start < len(ids); start += purgeBatch {
		chunk := ids[start:min(start+purgeBatch, len(ids))]
		result, err := coll.DeleteMany(ctx, bson.D{{Key: "_id", Value: bson.D{{Key: "$in", Value: chunk}}}})
		if err != nil {
			return deleted, fmt.Errorf("clear published jobs from %s: %w", coll.Name(), err)
		}
		deleted += result.DeletedCount
	}
	return deleted, nil
}

// maxRemoveIDs caps how many temp jobs one admin removal may name. It matches the
// largest selection the temp jobs page offers.
const maxRemoveIDs = 1_000

var (
	ErrNoRemoval     = errors.New("select at least one temp job to remove")
	ErrTooManyRemove = errors.New("select at most 1000 temp jobs to remove")
)

// RemoveTempJobs deletes the named temp jobs for good and returns how many existed.
// Ids that are already gone are skipped, so repeating a removal is safe.
func (s *Store) RemoveTempJobs(ctx context.Context, idHexes []string) (int64, error) {
	ids, err := removalObjectIDs(idHexes)
	if err != nil {
		return 0, err
	}
	var deleted int64
	for start := 0; start < len(ids); start += purgeBatch {
		chunk := ids[start:min(start+purgeBatch, len(ids))]
		result, err := s.dest().DeleteMany(ctx, bson.D{{Key: "_id", Value: bson.D{{Key: "$in", Value: chunk}}}})
		if err != nil {
			return deleted, fmt.Errorf("remove temp jobs: %w", err)
		}
		deleted += result.DeletedCount
	}
	return deleted, nil
}

// removalObjectIDs trims, dedupes and parses a removal selection.
func removalObjectIDs(idHexes []string) ([]bson.ObjectID, error) {
	seen := make(map[bson.ObjectID]struct{}, len(idHexes))
	ids := make([]bson.ObjectID, 0, len(idHexes))
	for _, idHex := range idHexes {
		idHex = strings.TrimSpace(idHex)
		if idHex == "" {
			continue
		}
		id, err := bson.ObjectIDFromHex(idHex)
		if err != nil {
			return nil, ErrInvalidID
		}
		if _, ok := seen[id]; ok {
			continue
		}
		seen[id] = struct{}{}
		ids = append(ids, id)
	}
	if len(ids) == 0 {
		return nil, ErrNoRemoval
	}
	if len(ids) > maxRemoveIDs {
		return nil, ErrTooManyRemove
	}
	return ids, nil
}
