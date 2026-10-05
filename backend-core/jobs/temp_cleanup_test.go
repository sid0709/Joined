package jobs

import (
	"context"
	"testing"
	"time"

	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo"
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
	store, _, _, _ := crawlerTestStore(t)
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

func TestCopyLeavesOutPublishedJobs(t *testing.T) {
	store, client, sourceDB, _ := crawlerTestStore(t)
	ctx, cancel := context.WithTimeout(context.Background(), 20*time.Second)
	defer cancel()

	publishedID, waitingID := bson.NewObjectID(), bson.NewObjectID()
	if _, err := client.Database(sourceDB).Collection("jobs").InsertMany(ctx, []any{
		bson.D{{Key: "_id", Value: publishedID}, {Key: "title", Value: "Published"}},
		bson.D{{Key: "_id", Value: waitingID}, {Key: "title", Value: "Waiting"}},
	}); err != nil {
		t.Fatalf("seed source: %v", err)
	}
	if _, err := store.structured().InsertOne(ctx, bson.D{
		{Key: "_id", Value: publishedID}, {Key: "tempJobId", Value: publishedID.Hex()},
	}); err != nil {
		t.Fatalf("seed published job: %v", err)
	}

	result, err := store.Copy(ctx, nil)
	if err != nil {
		t.Fatalf("copy: %v", err)
	}
	if result.Copied != 2 || result.Published != 1 {
		t.Fatalf("copy result = %+v", result)
	}
	if n, _ := store.dest().CountDocuments(ctx, bson.D{{Key: "_id", Value: publishedID}}); n != 0 {
		t.Fatal("published job is back in temp jobs")
	}
	if n, _ := store.dest().CountDocuments(ctx, bson.D{{Key: "_id", Value: waitingID}}); n != 1 {
		t.Fatal("waiting job missing from temp jobs")
	}
}

func TestPurgePublishedTempDropsJobsAndCompanies(t *testing.T) {
	store, _, _, _ := crawlerTestStore(t)
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

func TestLinkModelsUsesStoredSourceCompany(t *testing.T) {
	store, _, _, _ := crawlerTestStore(t)
	ctx, cancel := context.WithTimeout(context.Background(), 20*time.Second)
	defer cancel()

	source := bson.NewObjectID().Hex()
	docs := []storedSearchJob{{ID: bson.NewObjectID(), TempJobID: bson.NewObjectID().Hex(), SourceCompanyID: source}}
	models, err := store.linkModels(ctx, docs, map[string]string{source: "public-co"})
	if err != nil {
		t.Fatalf("link: %v", err)
	}
	update := models[0].(*mongo.UpdateOneModel).Update.(bson.D)
	set := update[0].Value.(bson.D)
	if got := stringField(set, "job.companyId"); got != "public-co" {
		t.Fatalf("company id = %q, want public-co", got)
	}
}
