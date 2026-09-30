package jobs

import (
	"context"
	"strings"

	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo"
)

// backfillDescription restores the original job description on a record saved before
// the description was required, so editing it does not trip saveSearchJob. The text
// comes back from the temp listing the record was analyzed from; a scout job with no
// temp listing falls back to the summary the scout wrote. A record with nothing to
// restore is left alone and fails the save.
func (s *Store) backfillDescription(ctx context.Context, doc *storedSearchJob) {
	if strings.TrimSpace(doc.Job.Description) != "" {
		return
	}
	if id, err := bson.ObjectIDFromHex(doc.TempJobID); err == nil {
		for _, coll := range []*mongo.Collection{s.dest(), s.scoutTemp()} {
			var temp tempListing
			if err := coll.FindOne(ctx, bson.D{{Key: "_id", Value: id}}).Decode(&temp); err == nil {
				if text := originalDescription(temp.Description); text != "" {
					doc.Job.Description = text
					return
				}
			}
		}
	}
	if doc.Source == ScoutedSource {
		doc.Job.Description = originalDescription(doc.Job.Summary)
	}
}
