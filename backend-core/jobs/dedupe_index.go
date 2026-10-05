package jobs

import (
	"context"
	"fmt"
	"strings"

	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo"
	"go.mongodb.org/mongo-driver/v2/mongo/options"
)

func dedupeIndexModel() mongo.IndexModel {
	return mongo.IndexModel{
		Keys: bson.D{{Key: "dedupeKey", Value: 1}},
		Options: options.Index().
			SetName(dedupeIndexName).
			SetUnique(true).
			SetPartialFilterExpression(bson.D{
				{Key: "dedupeKey", Value: bson.D{{Key: "$gt", Value: ""}}},
				{Key: "listingStatus", Value: bson.D{{Key: "$in", Value: bson.A{nil, "", ListingActive}}}},
			}),
	}
}

// EnsureDedupeIndexes creates the unique partial index on dedupeKey for active
// jobs. It is idempotent: a matching index name is left in place.
func (s *Store) EnsureDedupeIndexes(ctx context.Context) error {
	coll := s.structured()
	cursor, err := coll.Indexes().List(ctx)
	if err != nil {
		return fmt.Errorf("list job indexes: %w", err)
	}
	defer cursor.Close(ctx)
	for cursor.Next(ctx) {
		var idx bson.M
		if err := cursor.Decode(&idx); err != nil {
			return fmt.Errorf("decode job index: %w", err)
		}
		name, _ := idx["name"].(string)
		if name == dedupeIndexName {
			return nil
		}
	}
	if err := cursor.Err(); err != nil {
		return fmt.Errorf("list job indexes: %w", err)
	}
	if _, err := coll.Indexes().CreateOne(ctx, dedupeIndexModel()); err != nil {
		if indexAlreadyExists(err) {
			return nil
		}
		return fmt.Errorf("create dedupe index: %w", err)
	}
	return nil
}

func indexAlreadyExists(err error) bool {
	if err == nil {
		return false
	}
	if mongo.IsDuplicateKeyError(err) {
		return true
	}
	msg := err.Error()
	return strings.Contains(msg, "already exists") || strings.Contains(msg, "IndexOptionsConflict")
}
