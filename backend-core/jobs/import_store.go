package jobs

import (
	"context"
	"fmt"
	"sync"
	"time"

	"github.com/sid0709/OpenSeat/backend-core/config"
	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo"
	"go.mongodb.org/mongo-driver/v2/mongo/options"
)

// MemoryRunLog is the in-memory recent-run list tests use.
type MemoryRunLog struct {
	mu   sync.Mutex
	runs []ImportRun
}

func NewMemoryRunLog() *MemoryRunLog {
	return &MemoryRunLog{}
}

func (l *MemoryRunLog) Append(_ context.Context, run ImportRun) error {
	if l == nil {
		return nil
	}
	l.mu.Lock()
	defer l.mu.Unlock()
	l.runs = append([]ImportRun{run}, l.runs...)
	return nil
}

func (l *MemoryRunLog) Recent(_ context.Context, limit int) ([]ImportRun, error) {
	if l == nil {
		return []ImportRun{}, nil
	}
	if limit < 1 {
		limit = defaultImportRecentLimit
	}
	l.mu.Lock()
	defer l.mu.Unlock()
	if len(l.runs) < limit {
		return append([]ImportRun(nil), l.runs...), nil
	}
	return append([]ImportRun(nil), l.runs[:limit]...), nil
}

// MemorySink keeps staged feed items in memory for tests.
type MemorySink struct {
	mu     sync.Mutex
	Staged []ImportRecord
}

func (s *MemorySink) Stage(_ context.Context, rec ImportRecord) error {
	if s == nil {
		return nil
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	s.Staged = append(s.Staged, rec)
	return nil
}

func (s *MemorySink) Count() int {
	if s == nil {
		return 0
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	return len(s.Staged)
}

// StoreRunLog writes and lists import runs in Mongo.
type StoreRunLog struct {
	store      *Store
	collection string
}

func NewStoreRunLog(store *Store, collection string) *StoreRunLog {
	if collection == "" {
		collection = config.DefaultJobImportRunsCollection
	}
	return &StoreRunLog{store: store, collection: collection}
}

func (l *StoreRunLog) Append(ctx context.Context, run ImportRun) error {
	if l == nil || l.store == nil {
		return fmt.Errorf("import run log is not configured")
	}
	_, err := l.coll().InsertOne(ctx, run)
	if err != nil {
		return fmt.Errorf("insert import run: %w", err)
	}
	return nil
}

func (l *StoreRunLog) Recent(ctx context.Context, limit int) ([]ImportRun, error) {
	if l == nil || l.store == nil {
		return []ImportRun{}, nil
	}
	return listImportRuns(ctx, l.coll(), limit)
}

func (l *StoreRunLog) coll() *mongo.Collection {
	return l.store.client.Database(l.store.destDB).Collection(l.collection)
}

func (s *Store) RecentImportRuns(ctx context.Context, limit int) ([]ImportRun, error) {
	if s == nil || s.client == nil {
		return []ImportRun{}, nil
	}
	coll := s.client.Database(s.destDB).Collection(config.DefaultJobImportRunsCollection)
	return listImportRuns(ctx, coll, limit)
}

func listImportRuns(ctx context.Context, coll *mongo.Collection, limit int) ([]ImportRun, error) {
	if limit < 1 {
		limit = defaultImportRecentLimit
	}
	cursor, err := coll.Find(ctx, bson.D{}, options.Find().
		SetSort(bson.D{{Key: "startedAt", Value: -1}, {Key: "_id", Value: -1}}).
		SetLimit(int64(limit)))
	if err != nil {
		return nil, fmt.Errorf("list import runs: %w", err)
	}
	defer cursor.Close(ctx)
	runs := []ImportRun{}
	if err := cursor.All(ctx, &runs); err != nil {
		return nil, fmt.Errorf("decode import runs: %w", err)
	}
	return runs, nil
}

func (s *Store) EnsureImportIndexes(ctx context.Context, runsCollection string) error {
	if s == nil || s.client == nil {
		return nil
	}
	if runsCollection == "" {
		runsCollection = config.DefaultJobImportRunsCollection
	}
	coll := s.client.Database(s.destDB).Collection(runsCollection)
	_, err := coll.Indexes().CreateOne(ctx, mongo.IndexModel{
		Keys: bson.D{{Key: "startedAt", Value: -1}},
	})
	if err != nil {
		return fmt.Errorf("import run index: %w", err)
	}
	return nil
}

func (s *Store) Stage(ctx context.Context, rec ImportRecord) error {
	if s == nil {
		return fmt.Errorf("job store is not configured")
	}
	rec = rec.Normalize()
	if !rec.Valid() {
		return ErrInvalidInput
	}
	if rec.PostedAt.IsZero() {
		rec.PostedAt = time.Now().UTC()
	}
	filter := bson.D{
		{Key: "source", Value: rec.Source},
		{Key: "sourceRef", Value: rec.ExternalID},
	}
	update := bson.D{{Key: "$set", Value: bson.D{
		{Key: "title", Value: rec.Title},
		{Key: "companyName", Value: rec.Company},
		{Key: "description", Value: rec.Description},
		{Key: "applyLink", Value: rec.ApplyURL},
		{Key: "postedAt", Value: rec.PostedAt},
		{Key: "source", Value: rec.Source},
		{Key: "sourceRef", Value: rec.ExternalID},
		{Key: "dedupeKey", Value: rec.DedupeRecord().Key()},
		{Key: "importedAt", Value: time.Now().UTC()},
		{Key: "metadata.details.location", Value: rec.Location},
	}}}
	_, err := s.dest().UpdateOne(ctx, filter, update, options.UpdateOne().SetUpsert(true))
	if err != nil {
		return fmt.Errorf("stage imported job: %w", err)
	}
	return nil
}

func (s *Store) fetchAthensRecords(ctx context.Context) ([]ImportRecord, error) {
	listings, err := findAll[tempListing](ctx, s.source(), bson.D{})
	if err != nil {
		return nil, fmt.Errorf("read athens jobs: %w", err)
	}
	out := make([]ImportRecord, 0, len(listings))
	for _, listing := range listings {
		out = append(out, recordFromTemp(listing))
	}
	return out, nil
}
