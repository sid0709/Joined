package jobscam

import (
	"context"
	"os"
	"testing"
	"time"

	"go.mongodb.org/mongo-driver/v2/mongo"
	"go.mongodb.org/mongo-driver/v2/mongo/options"
)

func TestMongoHoldRoundTrip(t *testing.T) {
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
	dbName := "test_jobscam"
	t.Cleanup(func() {
		_ = client.Database(dbName).Drop(context.Background())
	})
	store := NewStore(client, dbName)
	if err := store.EnsureIndexes(ctx); err != nil {
		t.Fatalf("indexes: %v", err)
	}
	listings := NewMemory()
	svc := NewService(store, listings, Config{HoldThreshold: DefaultHoldThreshold})
	now := time.Date(2026, 10, 5, 16, 0, 0, 0, time.UTC)
	if _, err := svc.Inspect(ctx, Input{
		JobID:       "job-mongo",
		Title:       "Clerk",
		Company:     "Quick Hire",
		Description: "Pay to apply with a $40 registration fee.",
		ApplyURL:    "https://quick.example/jobs/1",
		CompanyURL:  "https://quick.example",
	}, now); err != nil {
		t.Fatalf("inspect: %v", err)
	}
	list, err := svc.List(ctx, ListQuery{Status: StatusHeld})
	if err != nil {
		t.Fatalf("list: %v", err)
	}
	if list.Total != 1 || list.Jobs[0].ID != "job-mongo" {
		t.Fatalf("list = %+v", list)
	}
	hold, err := svc.Review(ctx, "job-mongo", "roosebelt", Review{Decision: DecisionApprove, Reason: "checked"}, now)
	if err != nil {
		t.Fatalf("review: %v", err)
	}
	if hold.Status != StatusApproved || listings.ListingStatus("job-mongo") != ListingActive {
		t.Fatalf("hold = %+v listing = %q", hold, listings.ListingStatus("job-mongo"))
	}
}
