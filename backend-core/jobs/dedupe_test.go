package jobs

import (
	"context"
	"os"
	"testing"
	"time"

	"go.mongodb.org/mongo-driver/v2/mongo"
	"go.mongodb.org/mongo-driver/v2/mongo/options"
)

func TestNormalizeCollapsesCaseAndWhitespace(t *testing.T) {
	if got := NormalizeCompany("  Acme   Inc "); got != "acme inc" {
		t.Fatalf("company = %q", got)
	}
	if got := NormalizeTitle("\tSenior  Engineer\n"); got != "senior engineer" {
		t.Fatalf("title = %q", got)
	}
	if got := NormalizeLocation("San  Francisco, CA"); got != "san francisco, ca" {
		t.Fatalf("location = %q", got)
	}
}

func TestCanonicalApplyURLStripsTrackingAndNormalizes(t *testing.T) {
	got := CanonicalApplyURL(" HTTP://WWW.Jobs.Example.com/apply/42/?utm_source=board&fbclid=abc&gh_src=x&team=eng#section ")
	want := "https://jobs.example.com/apply/42?team=eng"
	if got != want {
		t.Fatalf("canonical = %q, want %q", got, want)
	}
	if CanonicalApplyURL("https://jobs.example.com/apply/42/?b=2&a=1") != "https://jobs.example.com/apply/42?a=1&b=2" {
		t.Fatalf("query order = %q", CanonicalApplyURL("https://jobs.example.com/apply/42/?b=2&a=1"))
	}
}

func TestDedupeKeyStableAcrossNormalizers(t *testing.T) {
	first := DedupeKey("Acme", "  Senior Engineer ", "San Francisco", "https://jobs.example.com/1?utm_source=x")
	second := DedupeKey("acme", "senior engineer", "san francisco", "https://JOBS.EXAMPLE.COM/1")
	if first == "" || first != second {
		t.Fatalf("keys differ: %q vs %q", first, second)
	}
	other := DedupeKey("Acme", "Staff Engineer", "San Francisco", "https://jobs.example.com/1")
	if other == first {
		t.Fatal("different titles should not share a key")
	}
}

func TestSourceRankPrefersDirectThenScouted(t *testing.T) {
	if SourceRank(DirectSource) <= SourceRank(ScoutedSource) {
		t.Fatal("direct should outrank scouted")
	}
	if SourceRank(scoutedJobType) <= SourceRank(aggregatedSource) {
		t.Fatal("scouted should outrank aggregated")
	}
	if SourceRank(ScoutedSource) != SourceRank(scoutedJobType) {
		t.Fatal("scoutwell and scouted should rank the same")
	}
	if PreferIncomingSource(aggregatedSource, DirectSource) {
		t.Fatal("aggregated must not replace direct")
	}
	if !PreferIncomingSource(DirectSource, aggregatedSource) {
		t.Fatal("direct should replace aggregated")
	}
	if PreferIncomingSource(DirectSource, DirectSource) {
		t.Fatal("equal rank keeps the existing listing")
	}
}

func TestDecideWriteKeepsHigherPrioritySource(t *testing.T) {
	existing := sampleRecord("a", aggregatedSource, time.Date(2026, 9, 1, 0, 0, 0, 0, time.UTC))
	incoming := sampleRecord("b", DirectSource, time.Date(2026, 9, 10, 0, 0, 0, 0, time.UTC))
	plan := DecideWrite(incoming, &existing)
	if plan.Action != dedupeActionReplace {
		t.Fatalf("action = %q, want replace", plan.Action)
	}
	if plan.Save.ID != existing.ID || plan.Save.JobID != existing.JobID {
		t.Fatalf("surviving ids = %+v", plan.Save)
	}
	if plan.Save.Source != DirectSource {
		t.Fatalf("kept source = %q, want direct", plan.Save.Source)
	}
	if !plan.Save.PostedAt.Equal(existing.PostedAt) {
		t.Fatalf("postedAt should stay on the surviving row: %v", plan.Save.PostedAt)
	}

	plan = DecideWrite(existing, &incoming)
	if plan.Action != dedupeActionSkip || plan.Save.Source != DirectSource {
		t.Fatalf("weaker incoming should skip: %+v", plan)
	}
}

func TestPlanDedupeWriteMergesTwoSourcesIntoOne(t *testing.T) {
	posted := time.Date(2026, 10, 1, 12, 0, 0, 0, time.UTC)
	aggregated := sampleRecord("agg", aggregatedSource, posted)
	direct := sampleRecord("dir", DirectSource, posted.Add(2*time.Hour))
	direct.ApplyURL = aggregated.ApplyURL + "?utm_campaign=board"
	pool := &memPool{records: []DedupeRecord{aggregated}}

	plan, err := PlanDedupeWrite(context.Background(), DefaultDedupeConfig(), pool, direct)
	if err != nil {
		t.Fatal(err)
	}
	if plan.Action != dedupeActionReplace || plan.Save.ID != aggregated.ID || plan.Save.Source != DirectSource {
		t.Fatalf("direct should replace aggregated: %+v", plan)
	}

	pool.records = []DedupeRecord{direct}
	plan, err = PlanDedupeWrite(context.Background(), DefaultDedupeConfig(), pool, aggregated)
	if err != nil {
		t.Fatal(err)
	}
	if plan.Action != dedupeActionSkip || plan.Save.ID != direct.ID || plan.Save.Source != DirectSource {
		t.Fatalf("aggregated should yield to direct: %+v", plan)
	}
}

func TestFuzzyMatchSameCompanyTitleLocationAndRecency(t *testing.T) {
	posted := time.Date(2026, 10, 1, 0, 0, 0, 0, time.UTC)
	base := DedupeRecord{
		ID:        "1",
		Company:   "Acme",
		CompanyID: "co-1",
		Title:     "Senior Platform Engineer",
		Location:  "Remote",
		ApplyURL:  "https://acme.example/jobs/a",
		Source:    aggregatedSource,
		PostedAt:  posted,
	}
	near := base
	near.ID = "2"
	near.Title = "Senior Platform Enginneer"
	near.ApplyURL = "https://boards.example/acme/senior-platform"
	near.Source = ScoutedSource
	near.PostedAt = posted.Add(10 * 24 * time.Hour)
	if !FuzzyMatch(near, base, DefaultDedupeConfig()) {
		t.Fatalf("similarity = %v, want fuzzy match", TitleSimilarity(near.Title, base.Title))
	}

	otherCompany := near
	otherCompany.CompanyID = "co-2"
	otherCompany.Company = "Other"
	if FuzzyMatch(otherCompany, base, DefaultDedupeConfig()) {
		t.Fatal("different company must not fuzzy-match")
	}

	stale := near
	stale.PostedAt = posted.Add(31 * 24 * time.Hour)
	if FuzzyMatch(stale, base, DefaultDedupeConfig()) {
		t.Fatal("postings more than 30 days apart must not fuzzy-match")
	}

	unlike := near
	unlike.Title = "Accountant"
	if FuzzyMatch(unlike, base, DefaultDedupeConfig()) {
		t.Fatal("low title similarity must not fuzzy-match")
	}
}

func TestDuplicateGroupsDryRunDoesNotNeedWrites(t *testing.T) {
	posted := time.Date(2026, 10, 1, 0, 0, 0, 0, time.UTC)
	a := sampleRecord("a", aggregatedSource, posted)
	b := sampleRecord("b", ScoutedSource, posted)
	b.ApplyURL = a.ApplyURL + "?utm_source=scout"
	groups := DuplicateGroups([]DedupeRecord{a, b}, DefaultDedupeConfig())
	if len(groups) != 1 || len(groups[0].Listings) != 2 || groups[0].Reason != duplicateReasonExact {
		t.Fatalf("groups = %#v", groups)
	}
}

func TestDedupeIndexModelIsUniquePartial(t *testing.T) {
	model := dedupeIndexModel()
	if model.Keys == nil {
		t.Fatal("missing keys")
	}
	if model.Options == nil {
		t.Fatal("missing unique partial index options")
	}
}

func TestEnsureDedupeIndexesIdempotent(t *testing.T) {
	uri := os.Getenv("MONGODB_TEST_URI")
	if uri == "" {
		t.Skip("Skipping MongoDB integration test: MONGODB_TEST_URI not set")
	}
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
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
	store := NewStore(client, "test_dedupe_src", "jobs", "test_dedupe_dest", "temp_jobs", "jobs", "companies", "companies", "temp_companies")
	if err := store.EnsureDedupeIndexes(ctx); err != nil {
		t.Fatalf("first ensure: %v", err)
	}
	if err := store.EnsureDedupeIndexes(ctx); err != nil {
		t.Fatalf("second ensure: %v", err)
	}
}

func sampleRecord(id, source string, posted time.Time) DedupeRecord {
	rec := DedupeRecord{
		ID:        id,
		JobID:     "job-" + id,
		Company:   "Acme",
		CompanyID: "co-acme",
		Title:     "Software Engineer",
		Location:  "New York, NY",
		ApplyURL:  "https://jobs.acme.example/software-engineer",
		Source:    source,
		PostedAt:  posted,
	}
	rec.DedupeKey = rec.Key()
	return rec
}

type memPool struct {
	records []DedupeRecord
}

func (m *memPool) FindActiveByKey(_ context.Context, key, exceptID string) (*DedupeRecord, error) {
	for _, rec := range m.records {
		if exceptID != "" && rec.ID == exceptID {
			continue
		}
		if !ListingPublic(rec.ListingStatus) {
			continue
		}
		if rec.Key() == key {
			copy := rec
			return &copy, nil
		}
	}
	return nil, nil
}

func (m *memPool) FindFuzzyCandidates(_ context.Context, _ DedupeRecord, exceptID string) ([]DedupeRecord, error) {
	out := make([]DedupeRecord, 0, len(m.records))
	for _, rec := range m.records {
		if exceptID != "" && rec.ID == exceptID {
			continue
		}
		if !ListingPublic(rec.ListingStatus) {
			continue
		}
		out = append(out, rec)
	}
	return out, nil
}
