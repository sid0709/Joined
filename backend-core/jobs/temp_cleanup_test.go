package jobs

import (
	"context"
	"errors"
	"testing"
	"time"

	"go.mongodb.org/mongo-driver/v2/bson"
)

var publishablePayload = []byte(`{
	"location": "Remote",
	"workplace": "remote",
	"pay": {"min": 120000, "max": 150000, "currency": "USD", "period": "year"},
	"seniority": "Senior",
	"employment": "Full-time",
	"skills": ["Go"],
	"summary": "Build the platform.",
	"responsibilities": ["Ship services"],
	"requirements": ["Go experience"],
	"benefits": []
}`)

func TestAnalyzeTempJobsDropsPublishedTempJob(t *testing.T) {
	store := crawlerTestStore(t)
	ctx, cancel := context.WithTimeout(context.Background(), 20*time.Second)
	defer cancel()

	tempID, companyID := bson.NewObjectID(), bson.NewObjectID()
	if _, err := store.dest().InsertOne(ctx, bson.D{
		{Key: "_id", Value: tempID},
		{Key: "title", Value: "Senior Engineer"},
		{Key: "companyName", Value: "Acme"},
		{Key: "companyId", Value: companyID},
		{Key: "description", Value: "Build the platform in Go."},
		{Key: "applyLink", Value: "https://acme.com/apply/1"},
		{Key: "postedAt", Value: time.Now().UTC()},
	}); err != nil {
		t.Fatalf("seed temp job: %v", err)
	}

	if err := store.AnalyzeTempJobs(ctx, stubReader{payload: publishablePayload}, AnalyzeScope{WebSearch: true}, 1, nil); err != nil {
		t.Fatalf("analyze: %v", err)
	}
	if left, err := store.dest().CountDocuments(ctx, bson.D{}); err != nil || left != 0 {
		t.Fatalf("temp jobs left = %d, err = %v", left, err)
	}
	var published storedSearchJob
	if err := store.structured().FindOne(ctx, bson.D{{Key: "_id", Value: tempID}}).Decode(&published); err != nil {
		t.Fatalf("published job: %v", err)
	}
	if published.SourceCompanyID != companyID.Hex() {
		t.Fatalf("source company = %q, want %q", published.SourceCompanyID, companyID.Hex())
	}
}

func TestPurgePublishedTempDropsJobsAndCompanies(t *testing.T) {
	store := crawlerTestStore(t)
	ctx, cancel := context.WithTimeout(context.Background(), 20*time.Second)
	defer cancel()

	publishedJob, waitingJob := bson.NewObjectID(), bson.NewObjectID()
	if _, err := store.dest().InsertMany(ctx, []any{
		bson.D{{Key: "_id", Value: publishedJob}},
		bson.D{{Key: "_id", Value: waitingJob}},
	}); err != nil {
		t.Fatalf("seed temp jobs: %v", err)
	}
	if _, err := store.structured().InsertOne(ctx, bson.D{
		{Key: "_id", Value: bson.NewObjectID()}, {Key: "tempJobId", Value: publishedJob.Hex()},
	}); err != nil {
		t.Fatalf("seed published job: %v", err)
	}
	if _, err := store.stagedCompanies().InsertMany(ctx, []any{
		bson.D{{Key: "id", Value: "published-co"}, {Key: "sourceId", Value: "src-1"}},
		bson.D{{Key: "id", Value: "waiting-co"}, {Key: "sourceId", Value: "src-2"}},
	}); err != nil {
		t.Fatalf("seed staged companies: %v", err)
	}
	if _, err := store.companies().InsertOne(ctx, bson.D{
		{Key: "id", Value: "published-co"}, {Key: "sourceId", Value: "src-1"},
	}); err != nil {
		t.Fatalf("seed company: %v", err)
	}

	purged, err := store.PurgePublishedTemp(ctx)
	if err != nil {
		t.Fatalf("purge: %v", err)
	}
	if purged != (TempPurge{Jobs: 1, Companies: 1}) {
		t.Fatalf("purged = %+v", purged)
	}
	if n, _ := store.dest().CountDocuments(ctx, bson.D{}); n != 1 {
		t.Fatalf("temp jobs left = %d", n)
	}
	if n, _ := store.stagedCompanies().CountDocuments(ctx, bson.D{{Key: "id", Value: "waiting-co"}}); n != 1 {
		t.Fatal("waiting company was dropped")
	}
}

func TestRemovalObjectIDsValidatesSelection(t *testing.T) {
	id := bson.NewObjectID().Hex()
	ids, err := removalObjectIDs([]string{" " + id + " ", id, ""})
	if err != nil || len(ids) != 1 {
		t.Fatalf("ids = %v, err = %v", ids, err)
	}
	if _, err := removalObjectIDs([]string{"", " "}); !errors.Is(err, ErrNoRemoval) {
		t.Fatalf("empty selection err = %v", err)
	}
	if _, err := removalObjectIDs([]string{"nope"}); !errors.Is(err, ErrInvalidID) {
		t.Fatalf("bad id err = %v", err)
	}
	many := make([]string, 0, maxRemoveIDs+1)
	for range maxRemoveIDs + 1 {
		many = append(many, bson.NewObjectID().Hex())
	}
	if _, err := removalObjectIDs(many); !errors.Is(err, ErrTooManyRemove) {
		t.Fatalf("oversize err = %v", err)
	}
}

func TestRemoveTempJobsDeletesOnlySelected(t *testing.T) {
	store := crawlerTestStore(t)
	ctx, cancel := context.WithTimeout(context.Background(), 20*time.Second)
	defer cancel()

	removed, kept := bson.NewObjectID(), bson.NewObjectID()
	if _, err := store.dest().InsertMany(ctx, []any{
		bson.D{{Key: "_id", Value: removed}},
		bson.D{{Key: "_id", Value: kept}},
	}); err != nil {
		t.Fatalf("seed temp jobs: %v", err)
	}
	count, err := store.RemoveTempJobs(ctx, []string{removed.Hex(), bson.NewObjectID().Hex()})
	if err != nil || count != 1 {
		t.Fatalf("removed = %d, err = %v", count, err)
	}
	if n, _ := store.dest().CountDocuments(ctx, bson.D{{Key: "_id", Value: kept}}); n != 1 {
		t.Fatal("unselected temp job was removed")
	}
}
