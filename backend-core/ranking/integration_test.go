package ranking

import (
	"context"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"os"
	"strconv"
	"testing"
	"time"

	"github.com/sid0709/Joined/backend-core/candidate"
	"github.com/sid0709/Joined/backend-core/config"
	"github.com/sid0709/Joined/backend-core/jobs"
)

// Integration tests run against real services when these are set, e.g.
//
//	RANKING_TEST_QDRANT_URL=http://127.0.0.1:6333 \
//	RANKING_TEST_EMBEDDER_URL=http://127.0.0.1:8090 \
//	RANKING_TEST_REDIS_URL=redis://127.0.0.1:6379/15 go test ./ranking/
//
// Without an embedder URL a deterministic hashing embedder stands in, which
// tests the Qdrant mechanics but not semantic quality.
const (
	envTestQdrant   = "RANKING_TEST_QDRANT_URL"
	envTestEmbedder = "RANKING_TEST_EMBEDDER_URL"
	envTestRedis    = "RANKING_TEST_REDIS_URL"
)

func integrationService(t *testing.T) (*Service, *fakeSource, func()) {
	t.Helper()
	qdrantURL := os.Getenv(envTestQdrant)
	if qdrantURL == "" {
		t.Skip(envTestQdrant + " is not set")
	}
	cfg := config.LoadRanking()
	cfg.QdrantURL = qdrantURL
	cfg.EmbedderURL = os.Getenv(envTestEmbedder)
	cfg.EmbedderAPI = config.EmbedderTEI
	cfg.RedisURL = os.Getenv(envTestRedis)
	cfg.ModelPath = ""
	cfg.Indexer = true
	cfg.RequestTimeout = 10 * time.Second
	cfg.CollectionVersion = "test" + strconv.FormatInt(time.Now().UnixNano(), 36)
	cfg.JobsCollection = "itjobs" + cfg.CollectionVersion
	cfg.UsersCollection = "itusers" + cfg.CollectionVersion
	s, err := NewService(Options{
		Config:   cfg,
		Profiles: &fakeProfiles{profiles: map[string]candidate.Profile{"u1": mlProfile()}},
		Logger:   slog.New(slog.NewTextHandler(io.Discard, nil)),
	})
	if err != nil {
		t.Fatal(err)
	}
	if cfg.EmbedderURL == "" {
		s.embedder = HashEmbedder{Dims: cfg.EmbedderDimensions}
		s.users.embedder = s.embedder
	}
	source := &fakeSource{}
	for i := 0; i < 160; i++ {
		spec := catalogTitles[i%len(catalogTitles)]
		source.docs = append(source.docs, jobs.RankingDoc{
			JobID: fmt.Sprintf("job-%03d", i), ObjectID: fmt.Sprintf("%024x", i+1), Title: spec.title, Company: fmt.Sprintf("Company %d", i%23),
			CompanyID: fmt.Sprintf("c%d", i%23), Location: spec.location, Workplace: spec.workplace,
			Seniority: []string{"Junior", "Middle", "Senior"}[i%3], Employment: "full-time",
			Pay:  jobs.Pay{Min: spec.pay - 20_000, Max: spec.pay, Currency: "USD", Period: "year"},
			Visa: i%2 == 0, Skills: spec.skills, Source: "aggregated",
			PostedAt: testNow.Add(-time.Duration(i) * 6 * time.Hour), AnalyzedAt: testNow.Add(-time.Duration(160-i) * time.Minute),
		})
	}
	ctx := context.Background()
	// Load the index without the background mirror, then mirror synchronously.
	if _, err := s.reconcileWith(ctx, source, false); err != nil {
		t.Fatal(err)
	}
	all := []JobFeatures{}
	for _, doc := range source.docs {
		all = append(all, NormalizeJob(doc, s.tax))
	}
	s.mirrorAll(ctx, all)
	if !s.vectorsOn() {
		t.Fatal("vectors should be on after mirroring")
	}
	cleanup := func() {
		for _, alias := range []string{cfg.JobsCollection, cfg.UsersCollection} {
			_ = s.qdrant.DeleteCollection(ctx, alias+"_"+cfg.CollectionVersion)
		}
	}
	return s, source, cleanup
}

func TestIntegrationQdrantMirrorAndFilters(t *testing.T) {
	s, source, cleanup := integrationService(t)
	defer cleanup()
	ctx := context.Background()
	count, err := s.qdrant.Count(ctx, s.cfg.JobsCollection)
	if err != nil || count != len(source.docs) {
		t.Fatalf("qdrant holds %d points (err %v), want %d", count, err, len(source.docs))
	}
	// A second mirror finds every revision current and writes nothing.
	all := []JobFeatures{}
	for _, doc := range source.docs {
		all = append(all, NormalizeJob(doc, s.tax))
	}
	stored := map[string]StoredRevisions{}
	_ = s.qdrant.ScrollRevisions(ctx, s.cfg.JobsCollection, func(id string, rev StoredRevisions) { stored[id] = rev })
	for _, job := range all {
		if stored[job.JobID].Dense != jobRevision(job) || stored[job.JobID].Data != jobDataRevision(job) {
			t.Fatalf("revisions for %s are stale after mirroring", job.JobID)
		}
	}
	// A payload-only change (a new tokenizer, a status edit) refreshes in place.
	changed := all[0]
	changed.Location = "Lisbon, Portugal"
	if jobRevision(changed) != jobRevision(all[0]) || jobDataRevision(changed) == jobDataRevision(all[0]) {
		t.Fatal("a location edit should change only the data revision")
	}
	if upserted, complete := s.mirrorInto(ctx, s.cfg.JobsCollection, append([]JobFeatures{changed}, all[1:]...)); upserted != 0 || !complete {
		t.Fatalf("a payload edit re-embedded %d jobs", upserted)
	}
	refreshed := map[string]StoredRevisions{}
	_ = s.qdrant.ScrollRevisions(ctx, s.cfg.JobsCollection, func(id string, rev StoredRevisions) { refreshed[id] = rev })
	if refreshed[changed.JobID].Data != jobDataRevision(changed) {
		t.Fatal("the payload refresh did not land")
	}

	filters := []Filter{
		{Workplaces: []Workplace{WorkplaceRemote}},
		{PayMinUSD: 150_000, VisaOnly: true},
		{LocationTerms: []string{"new", "yo"}},
		{Seniorities: []Level{ParseLevel("Senior")}, PostedAfter: testNow.Add(-7 * 24 * time.Hour)},
		{CompanyTerms: []string{"company", "1"}, Exclude: []string{"job-001"}},
		{PayMaxUSD: 140_000},
	}
	for _, f := range filters {
		location, company := s.Index().Expansions(f)
		hits, err := s.qdrant.QueryBatch(ctx, s.cfg.JobsCollection, []Query{{Using: vectorLexical, Sparse: QuerySparse("engineer manager scientist nurse executive"), Filter: f.Qdrant(location, company), Limit: 500}})
		if err != nil {
			t.Fatal(err)
		}
		for _, hit := range hits[0] {
			job, ok := s.Index().Get(hit.JobID)
			if !ok || !f.Matches(&job) {
				t.Fatalf("filter %s: qdrant returned %s, which the index rejects", f, hit.JobID)
			}
		}
	}
}

func TestIntegrationTypedQueryRanksRelevantJobs(t *testing.T) {
	s, _, cleanup := integrationService(t)
	defer cleanup()
	res, err := s.Search(context.Background(), Request{Query: "machine learning engineer", PageSize: 10, Now: testNow})
	if err != nil {
		t.Fatal(err)
	}
	if res.Mode != ModeQuery || len(res.IDs) == 0 || res.Exact {
		t.Fatalf("mode=%s ids=%d exact=%v", res.Mode, len(res.IDs), res.Exact)
	}
	if top := titlesOf(t, s, res.IDs[:1])[0]; top != "Senior Machine Learning Engineer" && top != "AI Engineer" {
		t.Fatalf("top result for 'machine learning engineer' = %q", top)
	}
	remote, err := s.Search(context.Background(), Request{Query: "remote senior engineer", Filter: Filter{Workplaces: []Workplace{WorkplaceRemote}}, PageSize: 50, Now: testNow})
	if err != nil {
		t.Fatal(err)
	}
	for id, job := range s.Index().Lookup(remote.IDs) {
		if job.Workplace != WorkplaceRemote {
			t.Fatalf("job %s is not remote", id)
		}
	}
	for _, sugg := range remote.Suggestions {
		if sugg.Kind == SuggestWorkplace {
			t.Fatal("a chip for an applied filter should not be suggested")
		}
	}
}

// failingEmbedder stands in for an embedder that is down or too busy to answer.
type failingEmbedder struct{ Embedder }

func (failingEmbedder) Embed(context.Context, []string, bool) ([][]float32, error) {
	return nil, errors.New("embedder unavailable")
}

func TestIntegrationTypedQueryWithoutEmbedderUsesKeywords(t *testing.T) {
	s, _, cleanup := integrationService(t)
	defer cleanup()
	s.embedder = failingEmbedder{s.embedder}
	res, err := s.Search(context.Background(), Request{Query: "registered nurse", PageSize: 10, Now: testNow, NoCache: true})
	if err != nil {
		t.Fatalf("a typed query should degrade to keywords, got %v", err)
	}
	if len(res.IDs) == 0 {
		t.Fatal("keyword retrieval returned nothing")
	}
	for _, title := range titlesOf(t, s, res.IDs) {
		if title != "Registered Nurse" {
			t.Fatalf("keyword-only result %q does not carry the query terms", title)
		}
	}
}

func TestIntegrationProfileFeedAndFanOut(t *testing.T) {
	s, source, cleanup := integrationService(t)
	defer cleanup()
	ctx := context.Background()
	res, err := s.Search(ctx, Request{UserID: "u1", Sort: SortRecommended, PageSize: 5, Now: testNow})
	if err != nil {
		t.Fatal(err)
	}
	if res.Mode != ModeProfile {
		t.Fatalf("mode = %s", res.Mode)
	}
	for _, title := range titlesOf(t, s, res.IDs) {
		if title == "Registered Nurse" || title == "Account Executive" {
			t.Fatalf("an ML profile's first page includes %q", title)
		}
	}
	user, err := s.users.load(ctx, "u1", time.Now())
	if err != nil || user.Vectors == nil {
		t.Fatalf("user vectors not stored: %v", err)
	}
	if err := s.RebuildFeed(ctx, "u1"); err != nil {
		t.Fatal(err)
	}
	if _, ok, _ := s.cache.Feed(ctx, feedKey(user), 10); !ok {
		t.Fatal("feed should exist after a rebuild")
	}
	// A new ML job arrives: the fan-out finds u1 and slots it into the feed.
	late := jobs.RankingDoc{JobID: "job-new", ObjectID: fmt.Sprintf("%024x", 999), Title: "Machine Learning Engineer", Company: "Fresh AI", Location: "Remote (US)",
		Workplace: "remote", Seniority: "Senior", Skills: []string{"python", "pytorch"}, Source: "aggregated",
		Pay: jobs.Pay{Min: 180_000, Max: 220_000, Currency: "USD", Period: "year"}, PostedAt: time.Now(), AnalyzedAt: testNow.Add(time.Hour)}
	source.docs = append(source.docs, late)
	if _, err := s.poll(ctx, source, fmt.Sprintf("%024x", 160)); err != nil {
		t.Fatal(err)
	}
	items, _, _ := s.cache.Feed(ctx, feedKey(user), s.cfg.FeedSize)
	found := false
	for _, item := range items {
		found = found || item.ID == "job-new"
	}
	if !found {
		t.Fatal("the fan-out should add the new matching job to the feed")
	}
}

func TestIntegrationRedisCache(t *testing.T) {
	url := os.Getenv(envTestRedis)
	if url == "" {
		t.Skip(envTestRedis + " is not set")
	}
	cache, err := NewCache(url)
	if err != nil {
		t.Fatal(err)
	}
	testCacheContract(t, cache)
}

func TestMemoryCacheContract(t *testing.T) {
	testCacheContract(t, NewMemoryCache(100))
}

func testCacheContract(t *testing.T, cache Cache) {
	ctx := context.Background()
	user := "cache-test-" + strconv.FormatInt(time.Now().UnixNano(), 36)
	key := RankedKey(user, "profile", "", "f", "recommended", "h")
	list := RankedList{IDs: []string{"a", "b"}, Scores: []float32{0.9, 0.8}, Total: 2, Exact: true}
	if err := cache.SetRanked(ctx, user, key, list, time.Minute); err != nil {
		t.Fatal(err)
	}
	got, ok, err := cache.GetRanked(ctx, key)
	if err != nil || !ok || len(got.IDs) != 2 || got.IDs[1] != "b" {
		t.Fatalf("GetRanked = %+v %v %v", got, ok, err)
	}
	if err := cache.DropUser(ctx, user); err != nil {
		t.Fatal(err)
	}
	if _, ok, _ := cache.GetRanked(ctx, key); ok {
		t.Fatal("DropUser should remove the user's lists")
	}
	if err := cache.SetVector(ctx, VectorKey("ml"), []float32{0.1, 0.2}, time.Minute); err != nil {
		t.Fatal(err)
	}
	if v, ok, _ := cache.GetVector(ctx, VectorKey("ML")); !ok || len(v) != 2 {
		t.Fatal("vectors are keyed by the folded query")
	}
	feed := user + ":h"
	if err := cache.AddToFeed(ctx, feed, []Scored{{ID: "x", Score: 1}}, 3); err != nil {
		t.Fatal(err)
	}
	if _, ok, _ := cache.Feed(ctx, feed, 10); ok {
		t.Fatal("AddToFeed must not create a feed")
	}
	_ = cache.ReplaceFeed(ctx, feed, []Scored{{ID: "a", Score: 0.5}, {ID: "b", Score: 0.9}, {ID: "c", Score: 0.1}})
	_ = cache.AddToFeed(ctx, feed, []Scored{{ID: "d", Score: 0.7}}, 3)
	items, ok, _ := cache.Feed(ctx, feed, 10)
	if !ok || len(items) != 3 || items[0].ID != "b" || items[1].ID != "d" || items[2].ID != "a" {
		t.Fatalf("feed = %+v, want b, d, a (c trimmed)", items)
	}
}

func TestIntegrationReindexSwapsAliasWhenComplete(t *testing.T) {
	s, source, cleanup := integrationService(t)
	defer cleanup()
	ctx := context.Background()
	before, err := s.qdrant.AliasTarget(ctx, s.cfg.JobsCollection)
	if err != nil || before == "" {
		t.Fatalf("alias target = %q, %v", before, err)
	}
	next := s.cfg.CollectionVersion + "b"
	if err := s.Reindex(ctx, source, next, true); err != nil {
		t.Fatal(err)
	}
	defer func() { _ = s.qdrant.DeleteCollection(ctx, s.cfg.JobsCollection+"_"+next) }()
	after, _ := s.qdrant.AliasTarget(ctx, s.cfg.JobsCollection)
	if after != s.cfg.JobsCollection+"_"+next {
		t.Fatalf("alias points at %q after reindex", after)
	}
	if count, _ := s.qdrant.Count(ctx, s.cfg.JobsCollection); count != len(source.docs) {
		t.Fatalf("reindexed collection holds %d, want %d", count, len(source.docs))
	}
	if err := s.Reindex(ctx, source, next, false); err == nil {
		t.Fatal("reindexing into the live version should be refused")
	}
}
