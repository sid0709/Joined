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
	// WebSearch lets the model look past the posting. Off, it reads the posting alone.
	WebSearch bool
}

// notPublishableField marks a temp job whose analysis did not say enough to publish it.
// A new copy replaces temp jobs, so those get another try with fresh source data.
const notPublishableField = "analysis.notPublishableAt"

// Why a temp job was not published, as the console shows it.
const (
	reasonNoDescription = "The post has no job description."
	reasonThinAnalysis  = "Analysis left out the title, company, summary, duties, or skills."
)

// AnalyzeTempJobs turns temp jobs into public search records, workers at a time, and
// publishes each one whose analysis says enough. Jobs are read in batches while
// earlier ones are with the model. A job that fails is reported and the run goes on;
// a missing API key stops it. Temp jobs already published are dropped first.
func (s *Store) AnalyzeTempJobs(ctx context.Context, reader ModelReader, scope AnalyzeScope, workers int, progress Progress) error {
	if reader == nil {
		return openai.ErrMissingAPIKey
	}
	progress = orNoProgress(progress)
	if _, err := s.purgePublishedTempJobs(ctx); err != nil {
		return err
	}
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
		published, err := s.publishAnalysis(ctx, reader, listing, time.Now(), scope.WebSearch)
		switch {
		case err == nil && published:
			progress.Done(1)
		case err == nil:
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

// publishAnalysis analyzes a temp job and publishes it when the analysis says enough,
// then drops the temp job. One it cannot publish is marked on the temp job instead; a
// job published before stays published.
func (s *Store) publishAnalysis(ctx context.Context, reader ModelReader, listing tempListing, now time.Time, webSearch bool) (bool, error) {
	record, err := s.analysisRecord(ctx, reader, listing, now, webSearch)
	reason := ""
	switch {
	case errors.Is(err, ErrMissingDescription):
		reason = reasonNoDescription
	case err != nil:
		return false, err
	case !publishable(record.Job):
		reason = reasonThinAnalysis
	}
	if reason != "" {
		return false, s.markNotPublishable(ctx, listing.ID, reader.Model(), reason, now)
	}
	if err := s.saveSearchJob(ctx, record); err != nil {
		return false, err
	}
	return true, s.dropTempJob(ctx, listing.ID)
}

func (s *Store) markNotPublishable(ctx context.Context, id bson.ObjectID, model, reason string, now time.Time) error {
	published, err := s.structured().CountDocuments(ctx, bson.D{{Key: "_id", Value: id}})
	if err != nil {
		return err
	}
	if published > 0 {
		return s.dropTempJob(ctx, id)
	}
	_, err = s.dest().UpdateOne(ctx, bson.D{{Key: "_id", Value: id}}, bson.D{{Key: "$set", Value: bson.D{
		{Key: notPublishableField, Value: now.UTC()},
		{Key: "analysis.model", Value: model},
		{Key: "analysis.reason", Value: reason},
	}}})
	return err
}

// tempJobsToAnalyze lists the scope's temp job ids, newest first, without the ones
// already analyzed or found not publishable, unless the scope redoes them or names them.
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
		filter := bson.D{}
		if !scope.Redo {
			filter = bson.D{{Key: notPublishableField, Value: bson.D{{Key: "$exists", Value: false}}}}
		}
		rows, err := findAll[struct {
			ID bson.ObjectID `bson:"_id"`
		}](ctx, s.dest(), filter, options.Find().
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
