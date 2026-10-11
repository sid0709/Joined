package ranking

import (
	"context"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"sync"
	"testing"
	"time"

	"github.com/sid0709/OpenSeat/backend-core/candidate"
	"github.com/sid0709/OpenSeat/backend-core/config"
	"github.com/sid0709/OpenSeat/backend-core/jobs"
)

type fakeSource struct {
	docs []jobs.RankingDoc
}

func (f *fakeSource) ScanRankingDocs(_ context.Context, afterID string, fn func(jobs.RankingDoc) error) error {
	for _, doc := range f.docs {
		if afterID != "" && doc.ObjectID <= afterID {
			continue
		}
		if err := fn(doc); err != nil {
			return err
		}
	}
	return nil
}

func (f *fakeSource) CompanySignals(context.Context) (map[string]float32, error) {
	return map[string]float32{}, nil
}

type fakeProfiles struct {
	mu       sync.Mutex
	profiles map[string]candidate.Profile
}

func (f *fakeProfiles) GetProfile(_ context.Context, userID string, _ time.Time) (candidate.Profile, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	return f.profiles[userID], nil
}

type recordingEvents struct {
	mu     sync.Mutex
	events []Event
}

func (r *recordingEvents) Log(e Event) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.events = append(r.events, e)
}

var catalogTitles = []struct {
	title, workplace, location string
	skills                     []string
	pay                        int
}{
	{"Senior Machine Learning Engineer", "remote", "Remote (US)", []string{"python", "pytorch"}, 210_000},
	{"AI Engineer", "remote", "Remote (US)", []string{"python", "llm"}, 190_000},
	{"Data Scientist", "hybrid", "New York, NY", []string{"python", "statistics"}, 160_000},
	{"Marketing Manager", "onsite", "Austin, TX", []string{"seo", "content marketing"}, 120_000},
	{"Senior Product Marketing Manager", "remote", "Remote (US)", []string{"go-to-market"}, 150_000},
	{"Registered Nurse", "onsite", "Chicago, IL", []string{"patient care"}, 90_000},
	{"Frontend Engineer", "hybrid", "San Francisco, CA", []string{"react", "typescript"}, 170_000},
	{"Account Executive", "remote", "Remote (US)", []string{"sales"}, 130_000},
}

func newTestService(t *testing.T, profiles map[string]candidate.Profile) (*Service, *recordingEvents) {
	t.Helper()
	docs := []jobs.RankingDoc{}
	for i := 0; i < 160; i++ {
		spec := catalogTitles[i%len(catalogTitles)]
		docs = append(docs, jobs.RankingDoc{
			JobID:      fmt.Sprintf("job-%03d", i),
			ObjectID:   fmt.Sprintf("%024x", i+1),
			Title:      spec.title,
			Company:    fmt.Sprintf("Company %d", i%23),
			CompanyID:  fmt.Sprintf("c%d", i%23),
			Location:   spec.location,
			Workplace:  spec.workplace,
			Seniority:  []string{"Junior", "Middle", "Senior"}[i%3],
			Employment: "full-time",
			Pay:        jobs.Pay{Min: spec.pay - 20_000, Max: spec.pay, Currency: "USD", Period: "year"},
			Visa:       i%2 == 0,
			Skills:     spec.skills,
			Source:     "aggregated",
			PostedAt:   testNow.Add(-time.Duration(i) * 6 * time.Hour),
			AnalyzedAt: testNow.Add(-time.Duration(160-i) * time.Minute),
		})
	}
	events := &recordingEvents{}
	cfg := config.LoadRanking()
	cfg.QdrantURL, cfg.EmbedderURL, cfg.RedisURL, cfg.ModelPath, cfg.Indexer = "", "", "", "", false
	cfg.RequestTimeout = 5 * time.Second
	s, err := NewService(Options{
		Config:   cfg,
		Profiles: &fakeProfiles{profiles: profiles},
		Events:   events,
		Logger:   slog.New(slog.NewTextHandler(io.Discard, nil)),
	})
	if err != nil {
		t.Fatal(err)
	}
	if _, err := s.reconcile(context.Background(), &fakeSource{docs: docs}); err != nil {
		t.Fatal(err)
	}
	return s, events
}

func mlProfile() candidate.Profile {
	return candidate.Profile{
		TargetRoles: []string{"Machine Learning Engineer"},
		Skills:      []string{"Python", "PyTorch"},
		Locations:   []string{"Remote"},
		SalaryFloor: 150_000,
		Currency:    "USD",
		Experience:  []candidate.ExperienceItem{{Role: "Senior ML Engineer", DateRange: candidate.DateRange{StartYear: 2019, Current: true}}},
	}
}

func titlesOf(t *testing.T, s *Service, ids []string) []string {
	t.Helper()
	out := make([]string, len(ids))
	jobs := s.Index().Lookup(ids)
	for i, id := range ids {
		out[i] = jobs[id].Title
	}
	return out
}

func TestSearchPersonalizesBlankQuery(t *testing.T) {
	s, events := newTestService(t, map[string]candidate.Profile{"u1": mlProfile()})
	res, err := s.Search(context.Background(), Request{UserID: "u1", Sort: SortRecommended, Now: testNow})
	if err != nil {
		t.Fatal(err)
	}
	if res.Mode != ModeProfile || res.Total != 160 || !res.Exact {
		t.Fatalf("mode/total/exact = %s/%d/%v", res.Mode, res.Total, res.Exact)
	}
	top := titlesOf(t, s, res.IDs[:6])
	for _, title := range top {
		if title != "Senior Machine Learning Engineer" && title != "AI Engineer" && title != "Data Scientist" {
			t.Fatalf("top results for an ML profile = %v", top)
		}
	}
	if len(res.Fits) != len(res.IDs) || res.Fits[res.IDs[0]].Score < GoodFit {
		t.Fatalf("fits missing or weak for the top job: %+v", res.Fits[res.IDs[0]])
	}
	if res.Facets == nil || res.Facets.Workplace["remote"] == 0 {
		t.Fatal("blank-query searches should carry facet counts")
	}
	if len(events.events) != 1 || events.events[0].Type != EventImpression || len(events.events[0].Items) != len(res.IDs) {
		t.Fatalf("impression not logged: %+v", events.events)
	}
	if len(events.events[0].Items[0].Features) != FeatureCount {
		t.Fatal("impressions should carry feature vectors")
	}
}

func TestSearchFiltersAreExact(t *testing.T) {
	s, _ := newTestService(t, map[string]candidate.Profile{"u1": mlProfile()})
	f := Filter{Workplaces: []Workplace{WorkplaceRemote}, PayMinUSD: 150_000, VisaOnly: true}
	res, err := s.Search(context.Background(), Request{UserID: "u1", Sort: SortRecommended, Filter: f, PageSize: 100, Now: testNow})
	if err != nil {
		t.Fatal(err)
	}
	if res.Total != int(s.Index().Count(f)) || !res.Exact {
		t.Fatalf("total = %d exact=%v, want the filter count %d", res.Total, res.Exact, s.Index().Count(f))
	}
	for id, job := range s.Index().Lookup(res.IDs) {
		if !f.Matches(job) {
			t.Fatalf("job %s (%s) does not pass the filter", id, job.Title)
		}
	}
}

func TestSearchForYouKeepsStrongFitsOnly(t *testing.T) {
	s, _ := newTestService(t, map[string]candidate.Profile{"u1": mlProfile()})
	res, err := s.Search(context.Background(), Request{UserID: "u1", Sort: SortRecommended, List: ListForYou, PageSize: 100, Now: testNow})
	if err != nil {
		t.Fatal(err)
	}
	if len(res.IDs) == 0 {
		t.Fatal("an ML profile should have strong fits")
	}
	for _, id := range res.IDs {
		if fit := res.Fits[id]; fit.Score < GoodFit {
			t.Fatalf("job %s in For you has fit %d", id, fit.Score)
		}
	}
}

func TestSearchFieldSortsAndPaging(t *testing.T) {
	s, _ := newTestService(t, nil)
	res, err := s.Search(context.Background(), Request{Sort: SortPay, PageSize: 20, Now: testNow})
	if err != nil {
		t.Fatal(err)
	}
	jobs := s.Index().Lookup(res.IDs)
	for i := 1; i < len(res.IDs); i++ {
		if jobs[res.IDs[i-1]].PayMaxUSD < jobs[res.IDs[i]].PayMaxUSD {
			t.Fatal("pay sort is not descending")
		}
	}
	page2, err := s.Search(context.Background(), Request{Sort: SortPay, PageSize: 20, Page: 2, Now: testNow})
	if err != nil {
		t.Fatal(err)
	}
	seen := map[string]bool{}
	for _, id := range append(res.IDs, page2.IDs...) {
		if seen[id] {
			t.Fatalf("job %s appears on two pages", id)
		}
		seen[id] = true
	}
	if !page2.CacheHit {
		t.Fatal("page 2 should be a slice of the cached list")
	}
	newest, _ := s.Search(context.Background(), Request{Sort: SortNewest, PageSize: 5, Now: testNow})
	if newest.IDs[0] != "job-000" {
		t.Fatalf("newest first = %s", newest.IDs[0])
	}
}

func TestSearchTypedQueryFallsBackWithoutVectors(t *testing.T) {
	s, _ := newTestService(t, nil)
	_, err := s.Search(context.Background(), Request{Query: "machine learning", Now: testNow})
	if !errors.Is(err, ErrFallback) {
		t.Fatalf("typed query without vectors: err = %v, want ErrFallback", err)
	}
}

func TestSearchAnonymousIsFreshnessLed(t *testing.T) {
	s, events := newTestService(t, nil)
	res, err := s.Search(context.Background(), Request{Sort: SortRelevance, PageSize: 10, Now: testNow})
	if err != nil {
		t.Fatal(err)
	}
	if res.Mode != ModeAnonymous || res.Fits != nil {
		t.Fatalf("mode = %s fits = %v", res.Mode, res.Fits)
	}
	if res.IDs[0] != "job-000" {
		t.Fatalf("anonymous blank search should lead with the newest job, got %s", res.IDs[0])
	}
	if len(events.events) != 0 {
		t.Fatal("signed-out searches are not logged")
	}
}

func TestProfileChangeRefreshesResults(t *testing.T) {
	profiles := map[string]candidate.Profile{"u1": mlProfile()}
	s, _ := newTestService(t, profiles)
	first, _ := s.Search(context.Background(), Request{UserID: "u1", Sort: SortRecommended, PageSize: 5, Now: testNow})
	nurse := candidate.Profile{TargetRoles: []string{"Registered Nurse"}, Skills: []string{"patient care"}, Locations: []string{"Chicago, IL"}}
	s.users.source.(*fakeProfiles).mu.Lock()
	s.users.source.(*fakeProfiles).profiles["u1"] = nurse
	s.users.source.(*fakeProfiles).mu.Unlock()
	s.ProfileChanged("u1")
	second, _ := s.Search(context.Background(), Request{UserID: "u1", Sort: SortRecommended, PageSize: 5, Now: testNow})
	if second.CacheHit {
		t.Fatal("a profile edit must not serve the old cached list")
	}
	if titlesOf(t, s, second.IDs[:1])[0] != "Registered Nurse" || first.IDs[0] == second.IDs[0] {
		t.Fatalf("after the edit the top job is %v", titlesOf(t, s, second.IDs[:1]))
	}
}

func TestSearchNotReadyFallsBack(t *testing.T) {
	cfg := config.LoadRanking()
	cfg.QdrantURL, cfg.EmbedderURL, cfg.RedisURL = "", "", ""
	s, err := NewService(Options{Config: cfg})
	if err != nil {
		t.Fatal(err)
	}
	if _, err := s.Search(context.Background(), Request{}); !errors.Is(err, ErrFallback) {
		t.Fatalf("err = %v, want ErrFallback before the first load", err)
	}
}

func TestPollAppliesNewJobs(t *testing.T) {
	s, _ := newTestService(t, nil)
	source := &fakeSource{docs: []jobs.RankingDoc{{JobID: "late", ObjectID: fmt.Sprintf("%024x", 999), Title: "AI Engineer", PostedAt: testNow}}}
	if _, err := s.poll(context.Background(), source, fmt.Sprintf("%024x", 160)); err != nil {
		t.Fatal(err)
	}
	if _, ok := s.Index().Get("late"); !ok || s.Index().Len() != 161 {
		t.Fatal("poll should add jobs inserted after the watermark")
	}
	if got := s.Index().ObjectIDs([]string{"late", "missing"}); got[0] != fmt.Sprintf("%024x", 999) || got[1] != "" {
		t.Fatalf("ObjectIDs = %v", got)
	}
}

// BenchmarkSearchMillion ranks blank and filtered searches over one million
// synthetic jobs with every in-process stage live (filters, facets, recency and
// family channels, features, scoring, re-ranking). The cache is bypassed by
// varying the user, so each iteration is a full miss.
func BenchmarkSearchMillion(b *testing.B) {
	if testing.Short() {
		b.Skip("one-million-job benchmark")
	}
	cfg := config.LoadRanking()
	cfg.QdrantURL, cfg.EmbedderURL, cfg.RedisURL, cfg.ModelPath = "", "", "", ""
	cfg.RequestTimeout = 10 * time.Second
	// With vectors on, a filter is scanned in full only when it keeps at most
	// CandidateLimit jobs; mirror that here, where the vector channels are off.
	cfg.ScanLimit = cfg.CandidateLimit
	profiles := map[string]candidate.Profile{}
	for i := 0; i < 64; i++ {
		profiles[fmt.Sprintf("u%d", i)] = mlProfile()
	}
	s, err := NewService(Options{Config: cfg, Profiles: &fakeProfiles{profiles: profiles}, Logger: slog.New(slog.NewTextHandler(io.Discard, nil))})
	if err != nil {
		b.Fatal(err)
	}
	if err := s.Load(context.Background(), SyntheticSource{N: 1_000_000, Seed: 1, Now: testNow}); err != nil {
		b.Fatal(err)
	}
	filters := []Filter{{}, {Workplaces: []Workplace{WorkplaceRemote}, PayMinUSD: 150_000}, {Seniorities: []Level{ParseLevel("Senior")}, PostedAfter: testNow.Add(-7 * 24 * time.Hour)}}
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		req := Request{UserID: fmt.Sprintf("u%d", i%64), Sort: SortRecommended, Filter: filters[i%len(filters)], Now: testNow, NoCache: true}
		if _, err := s.Search(context.Background(), req); err != nil {
			b.Fatal(err)
		}
	}
}

// BenchmarkLoadMillion is a full reconcile of one million jobs: normalize and index.
func BenchmarkLoadMillion(b *testing.B) {
	if testing.Short() {
		b.Skip("one-million-job benchmark")
	}
	for i := 0; i < b.N; i++ {
		s, err := NewService(Options{Logger: slog.New(slog.NewTextHandler(io.Discard, nil))})
		if err != nil {
			b.Fatal(err)
		}
		if err := s.Load(context.Background(), SyntheticSource{N: 1_000_000, Seed: 1, Now: testNow}); err != nil {
			b.Fatal(err)
		}
	}
}
