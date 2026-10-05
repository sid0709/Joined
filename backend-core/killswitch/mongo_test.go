package killswitch

import (
	"context"
	"os"
	"testing"
	"time"

	"go.mongodb.org/mongo-driver/v2/mongo"
	"go.mongodb.org/mongo-driver/v2/mongo/options"
)

func TestMongoOverrideRoundTrip(t *testing.T) {
	uri := os.Getenv("MONGODB_TEST_URI")
	if uri == "" {
		t.Skip("Skipping MongoDB integration test: MONGODB_TEST_URI not set")
	}
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
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
	dbName := "test_killswitch"
	t.Cleanup(func() {
		_ = client.Database(dbName).Drop(context.Background())
	})
	store := NewStore(client, dbName, Defaults{Signup: true})
	if !store.Enabled(ctx, Signup) {
		t.Fatal("env default should be on")
	}
	now := time.Date(2026, 10, 5, 15, 0, 0, 0, time.UTC)
	result, err := store.Set(ctx, Signup, false, "roosebelt", "pause sign-up", now)
	if err != nil {
		t.Fatalf("set: %v", err)
	}
	if result.AuditID == "" || result.State.Enabled {
		t.Fatalf("result = %+v", result)
	}
	if store.Enabled(ctx, Signup) {
		t.Fatal("override should disable signup")
	}
}
