package jobs

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"testing"
	"time"

	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo"
	"go.mongodb.org/mongo-driver/v2/mongo/options"
)

func TestStagedCompanyTempJobFilterMatchesPublicAndSourceIDs(t *testing.T) {
	source := bson.NewObjectID()
	filter := stagedCompanyTempJobFilter("public-co-1", source.Hex())
	if len(filter) != 1 || filter[0].Key != "$or" {
		t.Fatalf("filter = %+v", filter)
	}
	or, ok := filter[0].Value.(bson.A)
	if !ok || len(or) != 2 {
		t.Fatalf("or = %+v", filter[0].Value)
	}
}

func TestStructuredJobsForStagedCompanyFilterIncludesTempIDs(t *testing.T) {
	tempID := bson.NewObjectID()
	filter := structuredJobsForStagedCompanyFilter("public-co-1", []bson.ObjectID{tempID})
	if len(filter) != 1 || filter[0].Key != "$or" {
		t.Fatalf("filter = %+v", filter)
	}
	or, ok := filter[0].Value.(bson.A)
	if !ok || len(or) != 2 {
		t.Fatalf("or = %+v", filter[0].Value)
	}
}

func TestDeleteStagedCompanyForAnalyzerNotFound(t *testing.T) {
	store := analyzerDeleteTestStore(t)
	ctx := context.Background()
	_, err := store.DeleteStagedCompanyForAnalyzer(ctx, "missing-company-id")
	if err != ErrNotFound {
		t.Fatalf("err = %v", err)
	}
}

func TestDeleteStagedCompanyForAnalyzerRemovesCompanyAndJobs(t *testing.T) {
	store := analyzerDeleteTestStore(t)
	ctx := context.Background()

	publicID := "9c0e1a55-2b7d-4f3a-9d11-6a4c8e2b7d30"
	sourceID := bson.NewObjectID()
	tempJobID := bson.NewObjectID()
	otherCompany := bson.NewObjectID()

	if _, err := store.stagedCompanies().InsertOne(ctx, bson.M{
		"id":          publicID,
		"sourceId":    sourceID.Hex(),
		"companyName": "Acme",
	}); err != nil {
		t.Fatal(err)
	}
	if _, err := store.dest().InsertOne(ctx, bson.M{
		"_id":             tempJobID,
		"title":           "Engineer",
		"companyName":     "Acme",
		"companyId":       sourceID,
		"postedAt":        time.Now().UTC(),
	}); err != nil {
		t.Fatal(err)
	}
	if _, err := store.dest().InsertOne(ctx, bson.M{
		"_id":             bson.NewObjectID(),
		"title":           "Other role",
		"companyName":     "Other",
		"companyId":       otherCompany,
		"postedAt":        time.Now().UTC(),
	}); err != nil {
		t.Fatal(err)
	}
	if _, err := store.structured().InsertOne(ctx, bson.M{
		"_id":       tempJobID,
		"tempJobId": tempJobID.Hex(),
		"job": bson.M{
			"id":        "job-public-1",
			"companyId": publicID,
			"title":     "Engineer",
		},
	}); err != nil {
		t.Fatal(err)
	}
	if _, err := store.structured().InsertOne(ctx, bson.M{
		"_id":       bson.NewObjectID(),
		"tempJobId": "other",
		"job": bson.M{
			"id":        "job-public-2",
			"companyId": "other-company",
			"title":     "Other",
		},
	}); err != nil {
		t.Fatal(err)
	}

	result, err := store.DeleteStagedCompanyForAnalyzer(ctx, publicID)
	if err != nil {
		t.Fatal(err)
	}
	if result.CompanyID != publicID || !result.Removed.Company {
		t.Fatalf("result = %+v", result)
	}
	if len(result.Removed.TempJobs) != 1 || result.Removed.TempJobs[0] != tempJobID.Hex() {
		t.Fatalf("temp jobs = %+v", result.Removed.TempJobs)
	}
	if len(result.Removed.SearchJobs) != 1 || result.Removed.SearchJobs[0] != "job-public-1" {
		t.Fatalf("search jobs = %+v", result.Removed.SearchJobs)
	}

	if count, err := store.stagedCompanies().CountDocuments(ctx, bson.D{{Key: "id", Value: publicID}}); err != nil || count != 0 {
		t.Fatalf("staged company count = %d err = %v", count, err)
	}
	if count, err := store.dest().CountDocuments(ctx, bson.D{{Key: "_id", Value: tempJobID}}); err != nil || count != 0 {
		t.Fatalf("temp job count = %d err = %v", count, err)
	}
	if count, err := store.structured().CountDocuments(ctx, bson.D{{Key: "job.id", Value: "job-public-1"}}); err != nil || count != 0 {
		t.Fatalf("search job count = %d err = %v", count, err)
	}
	if count, err := store.dest().CountDocuments(ctx, bson.D{{Key: "companyId", Value: otherCompany}}); err != nil || count != 1 {
		t.Fatalf("unrelated temp job count = %d err = %v", count, err)
	}
}

func analyzerDeleteTestStore(t *testing.T) *Store {
	t.Helper()
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()
	client, err := mongo.Connect(options.Client().ApplyURI("mongodb://127.0.0.1:27017"))
	if err != nil {
		t.Skip("mongo unavailable:", err)
	}
	if err := client.Ping(ctx, nil); err != nil {
		t.Skip("mongo unavailable:", err)
	}
	suffix := make([]byte, 6)
	if _, err := rand.Read(suffix); err != nil {
		t.Fatal(err)
	}
	dbName := "joined_analyzer_del_" + hex.EncodeToString(suffix)
	store := NewStore(client, "src", "jobs", dbName, "temp_jobs", "jobs", "companies", "companies", "temp_companies")
	t.Cleanup(func() {
		_ = client.Database(dbName).Drop(context.Background())
	})
	return store
}
