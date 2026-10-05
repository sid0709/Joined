package jobs

import (
	"context"
	"fmt"
	"time"

	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo/options"
)

func dueExpiryFilter(now time.Time, cfg ExpiryConfig) bson.D {
	cfg = cfg.withDefaults()
	dailyCutoff := now.Add(-cfg.ScoutedInterval)
	if cfg.AggregatedInterval < cfg.ScoutedInterval {
		dailyCutoff = now.Add(-cfg.AggregatedInterval)
	}
	weeklyCutoff := now.Add(-cfg.DirectInterval)
	neverChecked := bson.D{{Key: "$or", Value: bson.A{
		bson.D{{Key: "lastLinkCheckedAt", Value: bson.D{{Key: "$exists", Value: false}}}},
		bson.D{{Key: "lastLinkCheckedAt", Value: time.Time{}}},
		bson.D{{Key: "lastLinkCheckedAt", Value: nil}},
	}}}
	notDirect := bson.D{{Key: "$and", Value: bson.A{
		bson.D{{Key: "source", Value: bson.D{{Key: "$nin", Value: bson.A{DirectSource}}}}},
		bson.D{{Key: "job.source", Value: bson.D{{Key: "$nin", Value: bson.A{directType, DirectSource}}}}},
	}}}
	dailyDue := bson.D{{Key: "$and", Value: bson.A{
		bson.D{{Key: "lastLinkCheckedAt", Value: bson.D{{Key: "$lte", Value: dailyCutoff}}}},
		notDirect,
	}}}
	weeklyDue := bson.D{{Key: "lastLinkCheckedAt", Value: bson.D{{Key: "$lte", Value: weeklyCutoff}}}}
	return bson.D{{Key: "$and", Value: bson.A{
		publicListingFilter(),
		bson.D{{Key: "applyLink", Value: bson.D{{Key: "$gt", Value: ""}}}},
		bson.D{{Key: "$or", Value: bson.A{neverChecked, dailyDue, weeklyDue}}},
	}}}
}

func (s *Store) ListDueExpiryJobs(ctx context.Context, now time.Time, cfg ExpiryConfig) ([]expiryJob, error) {
	cfg = cfg.withDefaults()
	opts := options.Find().
		SetLimit(int64(cfg.Batch)).
		SetSort(bson.D{{Key: "lastLinkCheckedAt", Value: 1}, {Key: "_id", Value: 1}})
	cursor, err := s.structured().Find(ctx, dueExpiryFilter(now, cfg), opts)
	if err != nil {
		return nil, fmt.Errorf("find due expiry jobs: %w", err)
	}
	defer cursor.Close(ctx)

	var docs []storedSearchJob
	if err := cursor.All(ctx, &docs); err != nil {
		return nil, fmt.Errorf("decode due expiry jobs: %w", err)
	}
	out := make([]expiryJob, 0, len(docs))
	for _, doc := range docs {
		out = append(out, expiryJobFromStored(doc))
	}
	return out, nil
}

func (s *Store) SaveExpiryCheck(ctx context.Context, job expiryJob) error {
	id, err := bson.ObjectIDFromHex(job.ID)
	if err != nil {
		return ErrInvalidID
	}
	set := bson.D{
		{Key: "linkCheckFailures", Value: job.LinkCheckFailures},
		{Key: "lastLinkCheckedAt", Value: job.LastLinkCheckedAt},
		{Key: "linkCheckSignal", Value: job.LinkCheckSignal},
	}
	if !job.LastVerifiedOpenAt.IsZero() {
		set = append(set, bson.E{Key: "lastVerifiedOpenAt", Value: job.LastVerifiedOpenAt})
	}
	if job.ListingStatus == ListingExpired {
		set = append(set,
			bson.E{Key: "listingStatus", Value: ListingExpired},
			bson.E{Key: "previousListingStatus", Value: job.PreviousListingStatus},
			bson.E{Key: "takedownCause", Value: job.TakedownCause},
			bson.E{Key: "expiredAt", Value: job.ExpiredAt},
		)
	}
	result, err := s.structured().UpdateOne(ctx, bson.D{{Key: "_id", Value: id}}, bson.D{{Key: "$set", Value: set}})
	if err != nil {
		return fmt.Errorf("save expiry check: %w", err)
	}
	if result.MatchedCount == 0 {
		return ErrNotFound
	}
	return nil
}

func expiryJobFromStored(doc storedSearchJob) expiryJob {
	return expiryJob{
		ID:                    doc.ID.Hex(),
		ApplyLink:             doc.ApplyLink,
		JobSource:             doc.Job.Source,
		ListingSource:         listingSource(doc),
		ListingStatus:         doc.ListingStatus,
		PreviousListingStatus: doc.PreviousListingStatus,
		TakedownCause:         doc.TakedownCause,
		LinkCheckFailures:     doc.LinkCheckFailures,
		LastLinkCheckedAt:     doc.LastLinkCheckedAt,
		LastVerifiedOpenAt:    doc.LastVerifiedOpenAt,
		ExpiredAt:             doc.ExpiredAt,
		LinkCheckSignal:       doc.LinkCheckSignal,
	}
}

var _ expirySource = (*Store)(nil)
