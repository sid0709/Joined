package jobs

import (
	"context"
	"errors"
	"os"
	"strings"
	"testing"
	"time"

	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo"
	"go.mongodb.org/mongo-driver/v2/mongo/options"
)

func crawledJob(applyLink string) CrawledJob {
	job := CrawledJob{
		CreatedBy:           "avalon-scrapper",
		Source:              "jobright",
		ApplyLink:           applyLink,
		Title:               "Senior Engineer",
		Description:         "Build things.",
		PostedAgo:           "3 hours ago",
		DuplicateWindowDays: 30,
		Tags:                []string{"Early applicant", " "},
		Skills:              []string{"Go"},
		Details:             map[string]string{"location": " Remote ", "bad.key": "dropped"},
	}
	job.CompanyLink = "https://acme.com/"
	job.Company.Name = "Acme"
	job.Company.Logo = "https://cdn.example/logo.png"
	job.Company.Tags = []string{"SaaS", " "}
	job.Applicants.Count = 25
	return job
}

func TestParseCrawlerBatch(t *testing.T) {
	if _, err := ParseCrawlerBatch([]byte(`{`)); !errors.Is(err, ErrInvalidInput) {
		t.Fatalf("bad json: %v", err)
	}
	if _, err := ParseCrawlerBatch([]byte(`{"jobs":[]}`)); !errors.Is(err, ErrInvalidInput) {
		t.Fatalf("empty: %v", err)
	}
	tooMany := `{"jobs":[` + strings.TrimSuffix(strings.Repeat(`{},`, MaxCrawlerBatch+1), ",") + `]}`
	if _, err := ParseCrawlerBatch([]byte(tooMany)); !errors.Is(err, ErrInvalidInput) {
		t.Fatalf("too many: %v", err)
	}
	batch, err := ParseCrawlerBatch([]byte(`{"createdBy":"avalon-scrapper","jobs":[{"title":"A","company":{"name":"B"}}]}`))
	if err != nil || batch.CreatedBy != "avalon-scrapper" || batch.Jobs[0].Company.Name != "B" {
		t.Fatalf("batch = %+v, err = %v", batch, err)
	}
}

func TestCrawledJobProblem(t *testing.T) {
	valid := crawledJob("https://acme.com/apply/1")
	if problem := crawledJobProblem(valid); problem != "" {
		t.Fatalf("valid job: %q", problem)
	}
	cases := map[string]func(*CrawledJob){
		"title is required":                func(j *CrawledJob) { j.Title = " " },
		"company name is required":         func(j *CrawledJob) { j.Company.Name = "" },
		"description is required":          func(j *CrawledJob) { j.Description = "" },
		"applyLink must be an http(s) URL": func(j *CrawledJob) { j.ApplyLink = "javascript:alert(1)" },
	}
	for want, change := range cases {
		job := valid
		change(&job)
		if got := crawledJobProblem(job); got != want {
			t.Errorf("got %q, want %q", got, want)
		}
	}
}

func TestPostedAtFromAgo(t *testing.T) {
	now := time.Date(2026, 10, 5, 12, 0, 0, 0, time.UTC)
	cases := map[string]time.Duration{
		"3 hours ago":   3 * time.Hour,
		"1 day ago":     24 * time.Hour,
		"2 weeks ago":   14 * 24 * time.Hour,
		"45 mins ago":   45 * time.Minute,
		"1 month ago":   30 * 24 * time.Hour,
		"2 years ago":   2 * 365 * 24 * time.Hour,
		"Yesterday":     24 * time.Hour,
		"just now":      0,
		"":              0,
		"posted lately": 0,
	}
	for text, back := range cases {
		if got := PostedAtFromAgo(text, now); !got.Equal(now.Add(-back)) {
			t.Errorf("%q: got %s, want %s", text, got, now.Add(-back))
		}
	}
}

func TestCrawlerDuplicateWindow(t *testing.T) {
	day := 24 * time.Hour
	if got := crawlerDuplicateWindow(0); got != DefaultCrawlerDuplicateWindowDays*day {
		t.Fatalf("default: %s", got)
	}
	if got := crawlerDuplicateWindow(7); got != 7*day {
		t.Fatalf("seven: %s", got)
	}
	if got := crawlerDuplicateWindow(5000); got != maxCrawlerDuplicateWindowDays*day {
		t.Fatalf("clamped: %s", got)
	}
}

func TestCrawledTempDocumentHasTheAnalyzerFields(t *testing.T) {
	now := time.Date(2026, 10, 5, 12, 0, 0, 0, time.UTC)
	id := bson.NewObjectID()
	raw, err := bson.Marshal(crawledTempDocument(id, crawledJob("https://acme.com/apply/1?utm_source=x"), "avalon-scrapper", now))
	if err != nil {
		t.Fatal(err)
	}
	var listing tempListing
	if err := bson.Unmarshal(raw, &listing); err != nil {
		t.Fatal(err)
	}
	if listing.ID != id || listing.Title != "Senior Engineer" || listing.CompanyName != "Acme" ||
		listing.Description != "Build things." || listing.Source != "jobright" ||
		listing.CreatedBy != "avalon-scrapper" || listing.Metadata.Details.Location != "Remote" ||
		!listing.PostedAt.Equal(now.Add(-3*time.Hour)) {
		t.Fatalf("listing = %+v", listing)
	}
	var doc struct {
		ApplyLinkKey string `bson:"applyLinkKey"`
		IngestedVia  string `bson:"ingestedVia"`
		Metadata     struct {
			Details map[string]string `bson:"details"`
			Tags    []string          `bson:"tags"`
		} `bson:"metadata"`
	}
	if err := bson.Unmarshal(raw, &doc); err != nil {
		t.Fatal(err)
	}
	if doc.IngestedVia != CrawlerIngest || doc.ApplyLinkKey != CanonicalApplyURL("https://acme.com/apply/1") {
		t.Fatalf("doc = %+v", doc)
	}
	if _, ok := doc.Metadata.Details["bad.key"]; ok || len(doc.Metadata.Tags) != 1 {
		t.Fatalf("metadata = %+v", doc.Metadata)
	}

	unnamed := crawledJob("https://acme.com/apply/2")
	unnamed.Source = ""
	raw, _ = bson.Marshal(crawledTempDocument(id, unnamed, "", now))
	_ = bson.Unmarshal(raw, &listing)
	if listing.Source != crawlerFallbackSource {
		t.Fatalf("fallback source = %q", listing.Source)
	}
}

// crawlerTestStore connects to MONGODB_TEST_URI and returns a store on throwaway
// databases that are dropped when the test ends.
func crawlerTestStore(t *testing.T) (*Store, *mongo.Client, string, string) {
	t.Helper()
	uri := os.Getenv("MONGODB_TEST_URI")
	if uri == "" {
		t.Skip("Skipping MongoDB integration test: MONGODB_TEST_URI not set")
	}
	client, err := mongo.Connect(options.Client().ApplyURI(uri).SetServerSelectionTimeout(2 * time.Second))
	if err != nil {
		t.Fatalf("mongo connect: %v", err)
	}
	suffix := bson.NewObjectID().Hex()
	sourceDB, destDB := "test_crawler_src_"+suffix, "test_crawler_dest_"+suffix
	t.Cleanup(func() {
		ctx := context.Background()
		_ = client.Database(sourceDB).Drop(ctx)
		_ = client.Database(destDB).Drop(ctx)
		_ = client.Disconnect(ctx)
	})
	store := NewStore(client, sourceDB, "jobs", destDB, "temp_jobs", "jobs", "companies", "companies", "temp_companies")
	return store, client, sourceDB, destDB
}

func TestIngestCrawledJobsStagesAndSkipsDuplicates(t *testing.T) {
	store, _, _, _ := crawlerTestStore(t)
	ctx, cancel := context.WithTimeout(context.Background(), 20*time.Second)
	defer cancel()
	now := time.Now().UTC()

	invalid := crawledJob("not-a-url")
	batch := CrawlerBatch{CreatedBy: "avalon-scrapper", Jobs: []CrawledJob{
		crawledJob("https://acme.com/apply/1"),
		crawledJob("https://acme.com/apply/1?utm_source=board"),
		invalid,
	}}
	result, err := store.IngestCrawledJobs(ctx, batch, now)
	if err != nil {
		t.Fatalf("ingest: %v", err)
	}
	if result.Summary != (CrawlerIngestSummary{Created: 1, Duplicates: 1, Failed: 1}) {
		t.Fatalf("summary = %+v", result.Summary)
	}
	created, duplicate, failed := result.Results[0], result.Results[1], result.Results[2]
	if !created.Created || created.StatusCode != 201 || created.TempJobID == "" {
		t.Fatalf("created = %+v", created)
	}
	if !duplicate.Duplicate || duplicate.TempJobID != created.TempJobID || duplicate.Reason == "" {
		t.Fatalf("duplicate = %+v", duplicate)
	}
	if failed.Success || failed.StatusCode != 400 || failed.Index != 2 {
		t.Fatalf("failed = %+v", failed)
	}

	// The analyzer sees the staged job as unanalyzed.
	listing, err := store.listingFrom(ctx, store.dest(), created.TempJobID)
	if err != nil || listing.Title != "Senior Engineer" {
		t.Fatalf("listing = %+v, err = %v", listing, err)
	}

	company, err := stagedCrawledCompany(ctx, store, "Acme")
	if err != nil {
		t.Fatalf("staged company: %v", err)
	}
	if company.CompanyLink != "https://acme.com/" || company.CompanyURL != company.CompanyLink ||
		company.CompanyLogo != "https://cdn.example/logo.png" || company.Source != CrawlerIngest {
		t.Fatalf("company = %+v", company)
	}
	tags, _ := company.Metadata["tags"].(bson.A)
	if len(tags) != 1 || tags[0] != "SaaS" {
		t.Fatalf("metadata = %+v", company.Metadata)
	}

	// Outside the duplicate window the same link is staged again, without a second company.
	later, err := store.IngestCrawledJobs(ctx, CrawlerBatch{Jobs: []CrawledJob{crawledJob("https://acme.com/apply/1")}}, now.Add(31*24*time.Hour))
	if err != nil || !later.Results[0].Created {
		t.Fatalf("after window = %+v, err = %v", later, err)
	}
	if n, err := store.stagedCompanies().CountDocuments(ctx, bson.D{{Key: "companyKey", Value: "acme"}}); err != nil || n != 1 {
		t.Fatalf("companies after second job = %d, err = %v", n, err)
	}
}

func TestCopyKeepsCrawledJobs(t *testing.T) {
	store, client, sourceDB, _ := crawlerTestStore(t)
	ctx, cancel := context.WithTimeout(context.Background(), 20*time.Second)
	defer cancel()

	sourceID := bson.NewObjectID()
	if _, err := client.Database(sourceDB).Collection("jobs").InsertOne(ctx, bson.D{
		{Key: "_id", Value: sourceID}, {Key: "title", Value: "From source"},
	}); err != nil {
		t.Fatalf("seed source: %v", err)
	}
	ingested, err := store.IngestCrawledJobs(ctx, CrawlerBatch{Jobs: []CrawledJob{crawledJob("https://acme.com/apply/9")}}, time.Now())
	if err != nil {
		t.Fatalf("ingest: %v", err)
	}

	result, err := store.Copy(ctx, nil)
	if err != nil {
		t.Fatalf("copy: %v", err)
	}
	if result.Copied != 1 || result.Kept != 1 {
		t.Fatalf("copy result = %+v", result)
	}
	for _, id := range []string{sourceID.Hex(), ingested.Results[0].TempJobID} {
		if _, err := store.listingFrom(ctx, store.dest(), id); err != nil {
			t.Fatalf("temp job %s after copy: %v", id, err)
		}
	}

	// The duplicate check still works after Copy swapped temp_jobs.
	again, err := store.IngestCrawledJobs(ctx, CrawlerBatch{Jobs: []CrawledJob{crawledJob("https://acme.com/apply/9")}}, time.Now())
	if err != nil || !again.Results[0].Duplicate {
		t.Fatalf("after copy = %+v, err = %v", again, err)
	}
}

type stagedCrawledCompanyDoc struct {
	CompanyName string `bson:"companyName"`
	CompanyLink string `bson:"companyLink"`
	CompanyURL  string `bson:"companyUrl"`
	CompanyLogo string `bson:"companyLogo"`
	Source      string `bson:"source"`
	Metadata    bson.M `bson:"metadata"`
}

func stagedCrawledCompany(ctx context.Context, store *Store, name string) (stagedCrawledCompanyDoc, error) {
	var doc stagedCrawledCompanyDoc
	err := store.stagedCompanies().FindOne(ctx, bson.D{{Key: "companyName", Value: name}}).Decode(&doc)
	return doc, err
}

func TestCrawledCompanyDocumentPutsBoardFieldsInMetadata(t *testing.T) {
	body := []byte(`{"jobs":[{
		"title":"Eng",
		"description":"Build",
		"applyLink":"https://builtin.com/apply/1",
		"companyLink":"https://builtin.com/company/north",
		"company":{"name":"North","logo":"https://cdn.example/north.png","employees":"51-200"}
	}]}`)
	batch, err := ParseCrawlerBatch(body)
	if err != nil {
		t.Fatal(err)
	}
	now := time.Date(2026, 10, 5, 12, 0, 0, 0, time.UTC)
	raw, err := bson.Marshal(crawledCompanyDocument("pub-1", crawlerCompanySourcePrefix+"north", batch.Jobs[0], now))
	if err != nil {
		t.Fatal(err)
	}
	var doc stagedCrawledCompanyDoc
	if err := bson.Unmarshal(raw, &doc); err != nil {
		t.Fatal(err)
	}
	if doc.CompanyName != "North" || doc.CompanyLink != "https://builtin.com/company/north" ||
		doc.CompanyURL != doc.CompanyLink || doc.CompanyLogo != "https://cdn.example/north.png" {
		t.Fatalf("doc = %+v", doc)
	}
	if _, ok := doc.Metadata["tags"]; ok || doc.Metadata["employees"] != "51-200" {
		t.Fatalf("metadata = %+v", doc.Metadata)
	}
	if _, ok := doc.Metadata["name"]; ok || doc.Metadata["logo"] != nil {
		t.Fatalf("metadata kept identity fields: %+v", doc.Metadata)
	}

	withTags := crawledJob("https://acme.com/apply/1")
	raw, err = bson.Marshal(crawledCompanyDocument("pub-2", crawlerCompanySourcePrefix+"acme", withTags, now))
	if err != nil {
		t.Fatal(err)
	}
	doc = stagedCrawledCompanyDoc{}
	if err := bson.Unmarshal(raw, &doc); err != nil {
		t.Fatal(err)
	}
	tags, _ := doc.Metadata["tags"].(bson.A)
	if len(tags) != 1 || tags[0] != "SaaS" {
		t.Fatalf("tags metadata = %+v", doc.Metadata)
	}
}

func TestIngestCrawledCompanySkipsExistingAndIncomplete(t *testing.T) {
	store, _, _, _ := crawlerTestStore(t)
	ctx, cancel := context.WithTimeout(context.Background(), 20*time.Second)
	defer cancel()

	if _, err := store.companies().InsertOne(ctx, bson.D{
		{Key: "id", Value: "already-published"},
		{Key: "sourceId", Value: "source-acme"},
		{Key: "companyName", Value: "Acme"},
		{Key: "companyKey", Value: "acme"},
		{Key: "companyUrl", Value: "https://acme.com"},
	}); err != nil {
		t.Fatalf("seed company: %v", err)
	}

	known, err := store.IngestCrawledJobs(ctx, CrawlerBatch{Jobs: []CrawledJob{crawledJob("https://acme.com/apply/known")}}, time.Now())
	if err != nil || !known.Results[0].Created {
		t.Fatalf("known company job = %+v, err = %v", known, err)
	}
	if n, err := store.stagedCompanies().CountDocuments(ctx, bson.D{}); err != nil || n != 0 {
		t.Fatalf("staged an existing company: %d, err = %v", n, err)
	}

	incomplete := crawledJob("https://jobs.example/apply/plain")
	incomplete.Company.Name = "Plain Co"
	incomplete.Company.Logo = ""
	incomplete.CompanyLink = "https://plain.example/"
	saved, err := store.IngestCrawledJobs(ctx, CrawlerBatch{Jobs: []CrawledJob{incomplete}}, time.Now())
	if err != nil || !saved.Results[0].Created {
		t.Fatalf("incomplete company job = %+v, err = %v", saved, err)
	}
	if n, err := store.stagedCompanies().CountDocuments(ctx, bson.D{{Key: "companyKey", Value: "plain-co"}}); err != nil || n != 0 {
		t.Fatalf("staged a company without a logo: %d, err = %v", n, err)
	}
}
