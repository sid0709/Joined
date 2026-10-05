package savedsearch

import (
	"context"
	"errors"
	"fmt"
	"time"

	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo"
	"go.mongodb.org/mongo-driver/v2/mongo/options"
)

// MongoStore persists saved searches in MongoDB.
type MongoStore struct {
	coll *mongo.Collection
}

// NewMongoStore writes to destDB.saved_searches.
func NewMongoStore(client *mongo.Client, db string) *MongoStore {
	return &MongoStore{coll: client.Database(db).Collection(CollectionName)}
}

// EnsureIndexes creates the user listing and alert-due indexes. Idempotent.
func (s *MongoStore) EnsureIndexes(ctx context.Context) error {
	indexes := []mongo.IndexModel{
		{
			Keys:    bson.D{{Key: "userId", Value: 1}, {Key: "updatedAt", Value: -1}},
			Options: options.Index().SetName("user_updated"),
		},
		{
			Keys:    bson.D{{Key: "alertFrequency", Value: 1}, {Key: "lastAlertedAt", Value: 1}},
			Options: options.Index().SetName("alert_due"),
		},
	}
	_, err := s.coll.Indexes().CreateMany(ctx, indexes)
	if err != nil {
		return fmt.Errorf("saved search indexes: %w", err)
	}
	return nil
}

func (s *MongoStore) Insert(ctx context.Context, search SavedSearch) error {
	_, err := s.coll.InsertOne(ctx, search)
	if err != nil {
		return fmt.Errorf("insert saved search: %w", err)
	}
	return nil
}

func (s *MongoStore) Get(ctx context.Context, userID, id string) (SavedSearch, error) {
	var search SavedSearch
	err := s.coll.FindOne(ctx, bson.D{
		{Key: "_id", Value: id},
		{Key: "userId", Value: userID},
	}).Decode(&search)
	if errors.Is(err, mongo.ErrNoDocuments) {
		return SavedSearch{}, ErrNotFound
	}
	if err != nil {
		return SavedSearch{}, fmt.Errorf("get saved search: %w", err)
	}
	return search, nil
}

func (s *MongoStore) ListByUser(ctx context.Context, userID string) ([]SavedSearch, error) {
	cursor, err := s.coll.Find(ctx, bson.D{{Key: "userId", Value: userID}}, options.Find().SetSort(bson.D{
		{Key: "updatedAt", Value: -1},
		{Key: "_id", Value: -1},
	}))
	if err != nil {
		return nil, fmt.Errorf("list saved searches: %w", err)
	}
	defer cursor.Close(ctx)
	items := []SavedSearch{}
	if err := cursor.All(ctx, &items); err != nil {
		return nil, fmt.Errorf("decode saved searches: %w", err)
	}
	return items, nil
}

func (s *MongoStore) Replace(ctx context.Context, search SavedSearch) error {
	result, err := s.coll.ReplaceOne(ctx, bson.D{
		{Key: "_id", Value: search.ID},
		{Key: "userId", Value: search.UserID},
	}, search)
	if err != nil {
		return fmt.Errorf("replace saved search: %w", err)
	}
	if result.MatchedCount == 0 {
		return ErrNotFound
	}
	return nil
}

func (s *MongoStore) Delete(ctx context.Context, userID, id string) error {
	result, err := s.coll.DeleteOne(ctx, bson.D{
		{Key: "_id", Value: id},
		{Key: "userId", Value: userID},
	})
	if err != nil {
		return fmt.Errorf("delete saved search: %w", err)
	}
	if result.DeletedCount == 0 {
		return ErrNotFound
	}
	return nil
}

func (s *MongoStore) CountByUser(ctx context.Context, userID string) (int, error) {
	count, err := s.coll.CountDocuments(ctx, bson.D{{Key: "userId", Value: userID}})
	if err != nil {
		return 0, fmt.Errorf("count saved searches: %w", err)
	}
	return int(count), nil
}

func (s *MongoStore) ListDue(ctx context.Context, now time.Time, limit int) ([]SavedSearch, error) {
	limit = clampAlertLimit(limit)
	now = now.UTC()
	filter := bson.D{{Key: "$or", Value: bson.A{
		dueFilter(AlertDaily, now.Add(-DailyInterval)),
		dueFilter(AlertWeekly, now.Add(-WeeklyInterval)),
	}}}
	cursor, err := s.coll.Find(ctx, filter, options.Find().
		SetLimit(int64(limit)).
		SetSort(bson.D{{Key: "lastAlertedAt", Value: 1}, {Key: "_id", Value: 1}}))
	if err != nil {
		return nil, fmt.Errorf("list due saved searches: %w", err)
	}
	defer cursor.Close(ctx)
	items := []SavedSearch{}
	if err := cursor.All(ctx, &items); err != nil {
		return nil, fmt.Errorf("decode due saved searches: %w", err)
	}
	return items, nil
}

func dueFilter(frequency AlertFrequency, cutoff time.Time) bson.D {
	return bson.D{
		{Key: "alertFrequency", Value: frequency},
		{Key: "$or", Value: bson.A{
			bson.D{{Key: "lastAlertedAt", Value: bson.D{{Key: "$exists", Value: false}}}},
			bson.D{{Key: "lastAlertedAt", Value: bson.D{{Key: "$lte", Value: cutoff}}}},
		}},
	}
}

func (s *MongoStore) MarkAlerted(ctx context.Context, id string, now time.Time) error {
	now = now.UTC()
	result, err := s.coll.UpdateOne(ctx, bson.D{{Key: "_id", Value: id}}, bson.D{{Key: "$set", Value: bson.D{
		{Key: "lastAlertedAt", Value: now},
		{Key: "updatedAt", Value: now},
	}}})
	if err != nil {
		return fmt.Errorf("mark saved search alerted: %w", err)
	}
	if result.MatchedCount == 0 {
		return ErrNotFound
	}
	return nil
}
