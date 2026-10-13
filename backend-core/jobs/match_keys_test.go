package jobs

import (
	"context"
	"strings"
	"testing"
	"time"

	"go.mongodb.org/mongo-driver/v2/bson"
)

func TestMatchKeySetNormalizes(t *testing.T) {
	got := matchKeySet("  ACME   Corp ", " Senior  Engineer", "https://WWW.acme.com/apply/1/?utm_source=x#top")
	want := bson.D{
		{Key: applyLinkKeyField, Value: "https://acme.com/apply/1"},
		{Key: companyKeyField, Value: "acme corp"},
		{Key: titleKeyField, Value: "senior engineer"},
	}
	if len(got) != len(want) {
		t.Fatalf("matchKeySet = %v", got)
	}
	for i := range want {
		if got[i] != want[i] {
			t.Fatalf("matchKeySet[%d] = %v, want %v", i, got[i], want[i])
		}
	}
}

func TestSameJobFilterNeedsBothCompanyAndTitle(t *testing.T) {
	if filter := sameJobFilter("", "", ""); filter != nil {
		t.Fatalf("empty keys = %v, want nil", filter)
	}
	branches := func(filter bson.D) int {
		return len(filter[0].Value.(bson.A))
	}
	if n := branches(sameJobFilter("https://a.com/1", "acme", "")); n != 1 {
		t.Fatalf("apply only = %d branches, want 1", n)
	}
	if n := branches(sameJobFilter("", "acme", "engineer")); n != 1 {
		t.Fatalf("company+title only = %d branches, want 1", n)
	}
	if n := branches(sameJobFilter("https://a.com/1", "acme", "engineer")); n != 2 {
		t.Fatalf("all keys = %d branches, want 2", n)
	}
}

func TestStoredSearchJobWithMatchKeys(t *testing.T) {
	doc := storedSearchJob{
		ApplyLink: "https://acme.com/apply/1?gh_src=board",
		Job:       SearchJob{Company: "Acme", Title: "Senior  Engineer"},
	}.withMatchKeys()
	if doc.ApplyLinkKey != "https://acme.com/apply/1" || doc.CompanyKey != "acme" || doc.TitleKey != "senior engineer" {
		t.Fatalf("keys = %q %q %q", doc.ApplyLinkKey, doc.CompanyKey, doc.TitleKey)
	}
}

func insertPublishedJob(t *testing.T, ctx context.Context, store *Store, applyLink, company, title string, postedAt time.Time) bson.ObjectID {
	t.Helper()
	doc := storedSearchJob{
		ID:        bson.NewObjectID(),
		ApplyLink: applyLink,
		PostedAt:  postedAt,
		Job:       SearchJob{Company: company, Title: title, Description: "Build things."},
	}.withMatchKeys()
	if _, err := store.structured().InsertOne(ctx, doc); err != nil {
		t.Fatalf("insert job: %v", err)
	}
	return doc.ID
}

func ingestOne(t *testing.T, ctx context.Context, store *Store, job CrawledJob, now time.Time) CrawlerJobResult {
	t.Helper()
	result, err := store.IngestCrawledJobs(ctx, CrawlerBatch{Jobs: []CrawledJob{job}}, now)
	if err != nil {
		t.Fatalf("ingest: %v", err)
	}
	return result.Results[0]
}

func TestIngestSkipsSameCompanyAndTitleInTempJobs(t *testing.T) {
	store := crawlerTestStore(t)
	ctx, cancel := context.WithTimeout(context.Background(), 20*time.Second)
	defer cancel()
	now := time.Now().UTC()

	first := ingestOne(t, ctx, store, crawledJob("https://acme.com/apply/1"), now)
	if !first.Created {
		t.Fatalf("first = %+v", first)
	}
	other := crawledJob("https://boards.example/acme/42")
	other.Title = "  senior   ENGINEER "
	other.Company.Name = "ACME"
	dup := ingestOne(t, ctx, store, other, now)
	if !dup.Duplicate || dup.TempJobID != first.TempJobID || !strings.Contains(dup.Reason, "same company and title") {
		t.Fatalf("company+title duplicate = %+v", dup)
	}

	differentTitle := crawledJob("https://boards.example/acme/43")
	differentTitle.Title = "Staff Engineer"
	if got := ingestOne(t, ctx, store, differentTitle, now); !got.Created {
		t.Fatalf("different title = %+v, want created", got)
	}
}

func TestIngestSkipsJobsAlreadyPublishedInWindow(t *testing.T) {
	store := crawlerTestStore(t)
	ctx, cancel := context.WithTimeout(context.Background(), 20*time.Second)
	defer cancel()
	now := time.Now().UTC()

	byLink := insertPublishedJob(t, ctx, store, "https://acme.com/apply/7", "Globex", "Analyst", now.Add(-24*time.Hour))
	linkJob := crawledJob("https://acme.com/apply/7?utm_campaign=board")
	linkJob.Title = "Totally Different"
	got := ingestOne(t, ctx, store, linkJob, now)
	if !got.Duplicate || got.JobID != byLink.Hex() || got.TempJobID != "" || !strings.Contains(got.Reason, "same apply link") {
		t.Fatalf("published by link = %+v", got)
	}

	byName := insertPublishedJob(t, ctx, store, "https://elsewhere.example/9", "Acme", "Senior Engineer", now.Add(-2*24*time.Hour))
	got = ingestOne(t, ctx, store, crawledJob("https://acme.com/apply/8"), now)
	if !got.Duplicate || got.JobID != byName.Hex() || !strings.Contains(got.Reason, "Already in jobs") {
		t.Fatalf("published by company+title = %+v", got)
	}
}

func TestIngestIgnoresPublishedJobsOutsideWindowOrWithoutPostedAt(t *testing.T) {
	store := crawlerTestStore(t)
	ctx, cancel := context.WithTimeout(context.Background(), 20*time.Second)
	defer cancel()
	now := time.Now().UTC()

	insertPublishedJob(t, ctx, store, "https://acme.com/apply/1", "Acme", "Senior Engineer", now.Add(-31*24*time.Hour))
	insertPublishedJob(t, ctx, store, "https://acme.com/apply/1", "Acme", "Senior Engineer", time.Time{})
	if got := ingestOne(t, ctx, store, crawledJob("https://acme.com/apply/1"), now); !got.Created {
		t.Fatalf("outside window = %+v, want created", got)
	}
}

func TestBackfillMatchKeysStampsOldRows(t *testing.T) {
	store := crawlerTestStore(t)
	ctx, cancel := context.WithTimeout(context.Background(), 20*time.Second)
	defer cancel()
	now := time.Now().UTC()

	tempID := bson.NewObjectID()
	if _, err := store.dest().InsertOne(ctx, bson.D{
		{Key: "_id", Value: tempID},
		{Key: "title", Value: "Senior Engineer"},
		{Key: "companyName", Value: "Acme"},
		{Key: "applyLink", Value: "https://legacy.example/1"},
		{Key: "createdAt", Value: now},
	}); err != nil {
		t.Fatalf("insert legacy temp: %v", err)
	}
	jobID := bson.NewObjectID()
	if _, err := store.structured().InsertOne(ctx, bson.D{
		{Key: "_id", Value: jobID},
		{Key: "applyLink", Value: "https://legacy.example/2?utm_source=x"},
		{Key: "postedAt", Value: now},
		{Key: "job", Value: bson.D{{Key: "company", Value: "Globex"}, {Key: "title", Value: "Analyst"}}},
	}); err != nil {
		t.Fatalf("insert legacy job: %v", err)
	}

	updated, err := store.BackfillMatchKeys(ctx)
	if err != nil || updated != 2 {
		t.Fatalf("backfill = %d, err = %v", updated, err)
	}
	if again, err := store.BackfillMatchKeys(ctx); err != nil || again != 0 {
		t.Fatalf("second backfill = %d, err = %v", again, err)
	}

	// The backfilled published row now blocks a re-crawl by its canonical link.
	job := crawledJob("https://legacy.example/2")
	job.Title = "Something Else"
	if got := ingestOne(t, ctx, store, job, now); !got.Duplicate || got.JobID != jobID.Hex() {
		t.Fatalf("after backfill = %+v", got)
	}
	// And the backfilled temp row blocks the same company and title.
	if got := ingestOne(t, ctx, store, crawledJob("https://acme.com/apply/1"), now); !got.Duplicate || got.TempJobID != tempID.Hex() {
		t.Fatalf("temp after backfill = %+v", got)
	}
}
