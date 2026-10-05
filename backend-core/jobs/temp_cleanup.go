package jobs

import (
	"context"
	"fmt"

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

// dropTempJob deletes a temp job that was published. It waits while Copy swaps
// temp_jobs, so the delete reaches the collection that stays.
func (s *Store) dropTempJob(ctx context.Context, id bson.ObjectID) error {
	s.tempWriteMu.RLock()
	defer s.tempWriteMu.RUnlock()
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
	s.tempWriteMu.RLock()
	defer s.tempWriteMu.RUnlock()
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
