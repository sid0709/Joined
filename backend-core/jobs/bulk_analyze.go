package jobs

import (
	"context"
	"errors"
	"time"

	"github.com/sid0709/OpenSeat/backend-core/openai"
	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo/options"
)

// AnalyzeScope picks the temp jobs a bulk analysis works through.
type AnalyzeScope struct {
	// IDs are the temp jobs to analyze, analyzed before or not. Empty means every temp job.
	IDs []string
	// Redo analyzes jobs that already have a search record again.
	Redo bool
}

// AnalyzeTempJobs turns temp jobs into public search records, workers at a time. Jobs
// are read in batches while earlier ones are with the model. A job that fails is
// reported and the run goes on; a missing API key stops it.
func (s *Store) AnalyzeTempJobs(ctx context.Context, reader ModelReader, scope AnalyzeScope, workers int, progress Progress) error {
	if reader == nil {
		return openai.ErrMissingAPIKey
	}
	progress = orNoProgress(progress)
	ids, err := s.tempJobsToAnalyze(ctx, scope, progress)
	if err != nil {
		return err
	}
	progress.Total(int64(len(ids)))

	load := func(ctx context.Context, batch []bson.ObjectID) ([]tempListing, error) {
		listings, err := findAll[tempListing](ctx, s.dest(), bson.D{{Key: "_id", Value: bson.D{{Key: "$in", Value: batch}}}})
		if err != nil {
			return nil, err
		}
		if missing := len(batch) - len(listings); missing > 0 {
			// Deleted since the run started, or never a temp job.
			progress.Skip(int64(missing))
		}
		return listings, nil
	}
	work := func(ctx context.Context, listing tempListing) error {
		_, err := s.writeAnalysis(ctx, reader, listing, time.Now())
		switch {
		case err == nil:
			progress.Done(1)
		case errors.Is(err, ErrMissingDescription):
			progress.Skip(1)
		case IsMissingAPIKey(err), ctx.Err() != nil:
			return err
		default:
			progress.Fail(listing.ID.Hex(), err)
		}
		return nil
	}
	return runBulk(ctx, ids, workers, load, work)
}

// tempJobsToAnalyze lists the scope's temp job ids, newest first, without the ones
// already analyzed unless the scope redoes them or names them.
func (s *Store) tempJobsToAnalyze(ctx context.Context, scope AnalyzeScope, progress Progress) ([]bson.ObjectID, error) {
	var ids []bson.ObjectID
	if len(scope.IDs) > 0 {
		for _, hex := range scope.IDs {
			id, err := bson.ObjectIDFromHex(hex)
			if err != nil {
				progress.Fail(hex, ErrInvalidID)
				continue
			}
			ids = append(ids, id)
		}
	} else {
		rows, err := findAll[struct {
			ID bson.ObjectID `bson:"_id"`
		}](ctx, s.dest(), bson.D{}, options.Find().
			SetProjection(bson.D{{Key: "_id", Value: 1}}).
			SetSort(bson.D{{Key: "postedAt", Value: -1}, {Key: "_id", Value: -1}}))
		if err != nil {
			return nil, err
		}
		ids = make([]bson.ObjectID, len(rows))
		for i, row := range rows {
			ids[i] = row.ID
		}
	}
	if scope.Redo || len(scope.IDs) > 0 {
		return ids, nil
	}
	analyzed, err := s.analyzedObjectIDs(ctx)
	if err != nil {
		return nil, err
	}
	done := make(map[bson.ObjectID]struct{}, len(analyzed))
	for _, id := range analyzed {
		done[id] = struct{}{}
	}
	pending := ids[:0]
	for _, id := range ids {
		if _, ok := done[id]; !ok {
			pending = append(pending, id)
		}
	}
	return pending, nil
}
