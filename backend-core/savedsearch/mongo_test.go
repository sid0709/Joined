package savedsearch

import (
	"context"
	"os"
	"testing"
	"time"

	"go.mongodb.org/mongo-driver/v2/mongo"
	"go.mongodb.org/mongo-driver/v2/mongo/options"
)

func TestMongoStoreRoundTrip(t *testing.T) {
	store := testMongoStore(t)
	ctx := context.Background()
	svc := NewService(store)
	now := time.Date(2026, 10, 5, 15, 0, 0, 0, time.UTC)

	created, err := svc.Create(ctx, "user-a", Input{
		Name:           "Mongo search",
		Query:          "golang",
		Filters:        Filters{Location: "NYC", Remote: true},
		AlertFrequency: AlertDaily,
	}, now)
	if err != nil {
		t.Fatalf("create: %v", err)
	}

	got, err := svc.Get(ctx, "user-a", created.ID)
	if err != nil {
		t.Fatalf("get: %v", err)
	}
	if got.Query != "golang" || got.Filters.Location != "NYC" {
		t.Fatalf("got = %+v", got)
	}

	listed, err := svc.List(ctx, "user-a")
	if err != nil {
		t.Fatalf("list: %v", err)
	}
	if len(listed) != 1 {
		t.Fatalf("list len = %d", len(listed))
	}

	if _, err := svc.Get(ctx, "user-b", created.ID); err != ErrNotFound {
		t.Fatalf("cross-user get = %v", err)
	}

	due, err := svc.ListDue(ctx, now, 10)
	if err != nil {
		t.Fatalf("list due: %v", err)
	}
	if len(due) != 1 || due[0].ID != created.ID {
		t.Fatalf("due = %+v", due)
	}

	if err := svc.MarkAlerted(ctx, created.ID, now); err != nil {
		t.Fatalf("mark: %v", err)
	}
	after, err := svc.ListDue(ctx, now.Add(time.Hour), 10)
	if err != nil {
		t.Fatalf("list due after mark: %v", err)
	}
	if len(after) != 0 {
		t.Fatalf("due after mark = %+v", after)
	}

	weekly := AlertWeekly
	if _, err := svc.Update(ctx, "user-a", created.ID, Patch{AlertFrequency: &weekly}, now.Add(time.Minute)); err != nil {
		t.Fatalf("update: %v", err)
	}
	if err := svc.Delete(ctx, "user-a", created.ID); err != nil {
		t.Fatalf("delete: %v", err)
	}
}

func TestMongoStoreEnsureIndexesIdempotent(t *testing.T) {
	store := testMongoStore(t)
	ctx := context.Background()
	if err := store.EnsureIndexes(ctx); err != nil {
		t.Fatalf("second ensure: %v", err)
	}
}

func testMongoStore(t *testing.T) *MongoStore {
	t.Helper()
	uri := os.Getenv("MONGODB_TEST_URI")
	if uri == "" {
		t.Skip("Skipping MongoDB integration test: MONGODB_TEST_URI not set")
	}
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	t.Cleanup(cancel)
	client, err := mongo.Connect(options.Client().ApplyURI(uri).SetServerSelectionTimeout(2 * time.Second))
	if err != nil {
		t.Fatalf("mongo connect: %v", err)
	}
	t.Cleanup(func() {
		_ = client.Disconnect(context.Background())
	})
	if err := client.Ping(ctx, nil); err != nil {
		t.Fatalf("mongo ping: %v", err)
	}
	dbName := "test_saved_searches"
	t.Cleanup(func() {
		_ = client.Database(dbName).Drop(context.Background())
	})
	store := NewMongoStore(client, dbName)
	if err := store.EnsureIndexes(ctx); err != nil {
		t.Fatalf("ensure indexes: %v", err)
	}
	return store
}
