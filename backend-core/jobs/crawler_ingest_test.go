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
	return CrawledJob{
		CreatedBy:           "joined-scrapper",
		Source:              "jobright",
		ApplyLink:           applyLink,
		Title:               "Senior Engineer",
		Description:         "Build things.",
		PostedAgo:           "3 hours ago",
		DuplicateWindowDays: 30,
		CompanyLink:         "https://acme.com/",
		Tags:                []string{"Early applicant"},
		Skills:              []string{"Go"},
		Details:             map[string]string{"location": " Remote ", "remote": "remote", "bad.key": "dropped"},
		Company: CrawledCompany{
			Name: "Acme",
			Logo: "https://cdn.example/logo.png",
			Tags: []string{"SaaS", " "},
			Metadata: map[string]any{
				"website": "https://acme.com/",
				"size":    "51-200",
				"hq":      "Austin",
			},
		},
		CrawledAt: "2026-10-12T18:00:00.000Z",
		Metadata: map[string]any{
			"workMode":     "remote",
			"industryTags": []string{"SaaS"},
			"bad.key":      "dropped",
		},
	}
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
	batch, err := ParseCrawlerBatch([]byte(`{"createdBy":"joined-scrapper","jobs":[{"title":"A","company":{"name":"B"}}]}`))
	if err != nil || batch.CreatedBy != "joined-scrapper" || batch.Jobs[0].Company.Name != "B" {
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
	raw, err := bson.Marshal(crawledTempDocument(id, crawledJob("https://acme.com/apply/1?utm_source=x"), "joined-scrapper", now))
	if err != nil {
		t.Fatal(err)
	}
	var listing tempListing
	if err := bson.Unmarshal(raw, &listing); err != nil {
		t.Fatal(err)
	}
	if listing.ID != id || listing.Title != "Senior Engineer" || listing.CompanyName != "Acme" ||
		listing.Description != "Build things." || listing.Source != "jobright" ||
		listing.CreatedBy != "joined-scrapper" || listing.Metadata.Details.Location != "Remote" ||
		!listing.PostedAt.Equal(now.Add(-3*time.Hour)) {
		t.Fatalf("listing = %+v", listing)
	}
	var doc struct {
		ApplyLinkKey string `bson:"applyLinkKey"`
		IngestedVia  string `bson:"ingestedVia"`
		Metadata     struct {
			Details   map[string]string `bson:"details"`
			PostedAgo string            `bson:"postedAgo"`
			CrawledAt string            `bson:"crawledAt"`
			Company   map[string]any    `bson:"company"`
			Extra     map[string]any    `bson:"extra"`
		} `bson:"metadata"`
	}
	if err := bson.Unmarshal(raw, &doc); err != nil {
		t.Fatal(err)
	}
	if doc.IngestedVia != CrawlerIngest || doc.ApplyLinkKey != CanonicalApplyURL("https://acme.com/apply/1") {
		t.Fatalf("doc = %+v", doc)
	}
	if _, ok := doc.Metadata.Details["bad.key"]; ok || doc.Metadata.Details["remote"] != "remote" {
		t.Fatalf("details = %+v", doc.Metadata.Details)
	}
	if doc.Metadata.Extra["workMode"] != "remote" {
		t.Fatalf("extra = %+v", doc.Metadata.Extra)
	}
	if doc.Metadata.PostedAgo != "3 hours ago" || doc.Metadata.CrawledAt != "2026-10-12T18:00:00Z" {
		t.Fatalf("metadata stamps = %+v", doc.Metadata)
	}
	if doc.Metadata.Company["website"] != "https://acme.com/" ||
		doc.Metadata.Company["size"] != "51-200" ||
		doc.Metadata.Company["hq"] != "Austin" {
		t.Fatalf("metadata.company = %+v", doc.Metadata.Company)
	}
	if _, ok := doc.Metadata.Extra["crawledAt"]; ok {
		t.Fatalf("crawledAt leaked into extra: %+v", doc.Metadata.Extra)
	}
	if _, ok := doc.Metadata.Extra["bad.key"]; ok {
		t.Fatalf("unsanitized extra key: %+v", doc.Metadata.Extra)
	}

	unnamed := crawledJob("https://acme.com/apply/2")
	unnamed.Source = ""
	raw, _ = bson.Marshal(crawledTempDocument(id, unnamed, "", now))
	_ = bson.Unmarshal(raw, &listing)
	if listing.Source != crawlerFallbackSource {
		t.Fatalf("fallback source = %q", listing.Source)
	}
}

func TestCrawledTempDocumentStoresCompanyProfileAndSocials(t *testing.T) {
	now := time.Date(2026, 10, 12, 18, 0, 0, 0, time.UTC)
	job := crawledJob("https://north.example/apply/1")
	job.Company.Name = "North"
	job.CompanyLink = "https://builtin.com/company/north"
	job.Company.Metadata = map[string]any{
		"website":    "https://north.example/",
		"profileUrl": "https://builtin.com/company/north",
		"socials": map[string]any{
			"linkedin": "https://linkedin.com/company/north",
			"x":        "https://x.com/north",
		},
	}
	raw, err := bson.Marshal(crawledTempDocument(bson.NewObjectID(), job, "joined-scrapper", now))
	if err != nil {
		t.Fatal(err)
	}
	var doc struct {
		CompanyLink string `bson:"companyLink"`
		Metadata    struct {
			Company struct {
				Website    string            `bson:"website"`
				ProfileURL string            `bson:"profileUrl"`
				Socials    map[string]string `bson:"socials"`
			} `bson:"company"`
		} `bson:"metadata"`
	}
	if err := bson.Unmarshal(raw, &doc); err != nil {
		t.Fatal(err)
	}
	if doc.CompanyLink != "https://north.example/" ||
		doc.Metadata.Company.Website != "https://north.example/" ||
		doc.Metadata.Company.ProfileURL != "https://builtin.com/company/north" ||
		doc.Metadata.Company.Socials["linkedin"] != "https://linkedin.com/company/north" ||
		doc.Metadata.Company.Socials["x"] != "https://x.com/north" {
		t.Fatalf("doc = %+v", doc)
	}
}

// crawlerTestStore connects to MONGODB_TEST_URI and returns a store on throwaway
// databases that are dropped when the test ends.
func crawlerTestStore(t *testing.T) *Store {
	t.Helper()
	uri := os.Getenv("MONGODB_TEST_URI")
	if uri == "" {
		t.Skip("Skipping MongoDB integration test: MONGODB_TEST_URI not set")
	}
	client, err := mongo.Connect(options.Client().ApplyURI(uri).SetServerSelectionTimeout(2 * time.Second))
	if err != nil {
		t.Fatalf("mongo connect: %v", err)
	}
	destDB := "test_crawler_" + bson.NewObjectID().Hex()
	t.Cleanup(func() {
		ctx := context.Background()
		_ = client.Database(destDB).Drop(ctx)
		_ = client.Disconnect(ctx)
	})
	return NewStore(client, destDB, "temp_jobs", "jobs", "companies", "temp_companies")
}

func TestIngestCrawledJobsStagesAndSkipsDuplicates(t *testing.T) {
	store := crawlerTestStore(t)
	ctx, cancel := context.WithTimeout(context.Background(), 20*time.Second)
	defer cancel()
	now := time.Now().UTC()

	invalid := crawledJob("not-a-url")
	batch := CrawlerBatch{CreatedBy: "joined-scrapper", Jobs: []CrawledJob{
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
		"companyLink":"https://north.example/",
		"company":{"name":"North","logo":"https://cdn.example/north.png","employees":"51-200","profileUrl":"https://builtin.com/company/north"}
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
	if doc.CompanyName != "North" || doc.CompanyLink != "https://north.example/" ||
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
	if doc.Metadata["size"] != "51-200" || doc.Metadata["hq"] != "Austin" || doc.Metadata["website"] != "https://acme.com/" {
		t.Fatalf("company extras = %+v", doc.Metadata)
	}
}

func TestJobExtraKeepsNestedNameLogoAndDropsDeepNesting(t *testing.T) {
	job := crawledJob("https://acme.com/apply/1")
	job.Metadata["boardCompany"] = map[string]any{
		"name": "Nested Co",
		"logo": "https://cdn.example/nested.png",
		"rank": float64(3),
	}
	deep := map[string]any{"leaf": "ok"}
	for i := 0; i < maxMetadataDepth+2; i++ {
		deep = map[string]any{"n": deep}
	}
	job.Metadata["deep"] = deep

	extra := mapToBSON(job.Metadata)
	nested := bsonMap(lookupD(extra, "boardCompany"))
	if nested["name"] != "Nested Co" || nested["logo"] != "https://cdn.example/nested.png" {
		t.Fatalf("nested extra = %+v", nested)
	}
	if metadataDepth(mapToBSON(map[string]any{"deep": deep})) > maxMetadataDepth {
		t.Fatalf("sanitized depth exceeded %d", maxMetadataDepth)
	}
}

func lookupD(doc bson.D, key string) any {
	for _, item := range doc {
		if item.Key == key {
			return item.Value
		}
	}
	return nil
}

func bsonMap(value any) bson.M {
	switch typed := value.(type) {
	case bson.M:
		return typed
	case bson.D:
		out := bson.M{}
		for _, item := range typed {
			out[item.Key] = item.Value
		}
		return out
	default:
		return bson.M{}
	}
}

func metadataDepth(value any) int {
	switch typed := value.(type) {
	case bson.D:
		max := 1
		for _, item := range typed {
			if child := metadataDepth(item.Value); child+1 > max {
				max = child + 1
			}
		}
		return max
	case bson.A:
		max := 1
		for _, item := range typed {
			if child := metadataDepth(item); child+1 > max {
				max = child + 1
			}
		}
		return max
	default:
		return 1
	}
}

func TestIngestCrawledCompanySkipsExistingAndIncomplete(t *testing.T) {
	store := crawlerTestStore(t)
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
	incomplete.Company.Metadata = map[string]any{"website": "https://plain.example/"}
	incomplete.Metadata["companyLogo"] = ""
	saved, err := store.IngestCrawledJobs(ctx, CrawlerBatch{Jobs: []CrawledJob{incomplete}}, time.Now())
	if err != nil || !saved.Results[0].Created {
		t.Fatalf("incomplete company job = %+v, err = %v", saved, err)
	}
	if n, err := store.stagedCompanies().CountDocuments(ctx, bson.D{{Key: "companyKey", Value: "plain-co"}}); err != nil || n != 0 {
		t.Fatalf("staged a company without a logo: %d, err = %v", n, err)
	}
}

func TestIngestStoresCompanyMetadataWhenCompanyAlreadyExists(t *testing.T) {
	store := crawlerTestStore(t)
	ctx, cancel := context.WithTimeout(context.Background(), 20*time.Second)
	defer cancel()

	if _, err := store.companies().InsertOne(ctx, bson.D{
		{Key: "id", Value: "already-published"},
		{Key: "sourceId", Value: "source-north"},
		{Key: "companyName", Value: "North"},
		{Key: "companyKey", Value: "north"},
		{Key: "companyUrl", Value: "https://north.example"},
	}); err != nil {
		t.Fatalf("seed company: %v", err)
	}

	job := crawledJob("https://north.example/apply/known")
	job.Company.Name = "North"
	job.CompanyLink = "https://north.example/"
	job.Company.Metadata = map[string]any{
		"website":    "https://north.example/",
		"profileUrl": "https://builtin.com/company/north",
		"socials": map[string]any{
			"linkedin": "https://linkedin.com/company/north",
			"x":        "https://x.com/north",
		},
	}
	job.CrawledAt = "2026-10-12T18:00:00Z"

	result, err := store.IngestCrawledJobs(ctx, CrawlerBatch{Jobs: []CrawledJob{job}}, time.Now())
	if err != nil || !result.Results[0].Created {
		t.Fatalf("ingest = %+v, err = %v", result, err)
	}
	if n, err := store.stagedCompanies().CountDocuments(ctx, bson.D{}); err != nil || n != 0 {
		t.Fatalf("staged an existing company: %d, err = %v", n, err)
	}

	var stored struct {
		Metadata struct {
			CrawledAt string `bson:"crawledAt"`
			Company   struct {
				Website    string            `bson:"website"`
				ProfileURL string            `bson:"profileUrl"`
				Socials    map[string]string `bson:"socials"`
			} `bson:"company"`
		} `bson:"metadata"`
	}
	if err := store.dest().FindOne(ctx, bson.D{}).Decode(&stored); err != nil {
		t.Fatalf("load temp job: %v", err)
	}
	if stored.Metadata.CrawledAt != "2026-10-12T18:00:00Z" ||
		stored.Metadata.Company.Website != "https://north.example/" ||
		stored.Metadata.Company.ProfileURL != "https://builtin.com/company/north" ||
		stored.Metadata.Company.Socials["linkedin"] != "https://linkedin.com/company/north" ||
		stored.Metadata.Company.Socials["x"] != "https://x.com/north" {
		t.Fatalf("temp job company metadata = %+v", stored.Metadata)
	}
}
