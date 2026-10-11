package ranking

import (
	"fmt"
	"math/rand"
	"sort"
	"testing"
	"time"
)

var testNow = time.Date(2026, 10, 11, 12, 0, 0, 0, time.UTC)

var (
	testLocations = []string{"San Francisco, CA", "Remote (US)", "New York, NY", "London, UK", "Berlin, Germany", "Austin, TX", "Remote — Worldwide", "Santa Monica, CA"}
	testCompanies = []string{"Acme Corp", "Globex", "Initech", "Acme Labs", "Umbrella Health"}
	testSources   = []string{"aggregated", "direct", "scouted"}
)

func randomJob(r *rand.Rand, i int) JobFeatures {
	location := testLocations[r.Intn(len(testLocations))]
	job := JobFeatures{
		JobID:      fmt.Sprintf("job-%d", i),
		Title:      "Engineer",
		Company:    testCompanies[r.Intn(len(testCompanies))],
		Location:   location,
		Workplace:  Workplace(r.Intn(4)),
		Region:     DetectRegion(location),
		Seniority:  Level(r.Intn(6)),
		Employment: Employment(r.Intn(4)),
		Source:     testSources[r.Intn(len(testSources))],
		Hidden:     r.Intn(5) == 0,
		PostedAt:   testNow.Add(-time.Duration(r.Intn(30*24)) * time.Hour),
	}
	if r.Intn(2) == 0 {
		job.Visa = VisaYes
	}
	if r.Intn(4) != 0 {
		low := int32(40_000 + r.Intn(200_000))
		job.PayMinUSD, job.PayMaxUSD, job.PayKnown = low, low+int32(r.Intn(80_000)), true
	}
	return job
}

func randomFilter(r *rand.Rand) Filter {
	f := Filter{}
	if r.Intn(3) == 0 {
		f.Workplaces = []Workplace{Workplace(1 + r.Intn(3))}
	}
	if r.Intn(3) == 0 {
		f.Seniorities = []Level{Level(1 + r.Intn(5)), Level(1 + r.Intn(5))}
	}
	if r.Intn(4) == 0 {
		f.Employments = []Employment{Employment(1 + r.Intn(3))}
	}
	if r.Intn(5) == 0 {
		f.Sources = []string{testSources[r.Intn(len(testSources))]}
	}
	f.HiddenOnly = r.Intn(6) == 0
	f.VisaOnly = r.Intn(4) == 0
	if r.Intn(3) == 0 {
		f.PayMinUSD = int32(10_000 * (5 + r.Intn(20)))
	}
	if r.Intn(6) == 0 {
		f.PayMaxUSD = int32(10_000 * (8 + r.Intn(20)))
	}
	if r.Intn(3) == 0 {
		f.PostedAfter = testNow.Add(-time.Duration(1+r.Intn(14)) * 24 * time.Hour)
	}
	if r.Intn(4) == 0 {
		f.LocationTerms = [][]string{{"san"}, {"remote"}, {"new", "york"}, {"san", "fr"}, {"ca"}}[r.Intn(5)]
	}
	if r.Intn(5) == 0 {
		f.CompanyTerms = [][]string{{"acme"}, {"glo"}, {"umbrella", "health"}}[r.Intn(3)]
	}
	if r.Intn(5) == 0 {
		f.Regions = []Region{RegionUS}
	}
	if r.Intn(6) == 0 {
		f.Exclude = []string{"job-1", "job-2", "job-3"}
	}
	return f
}

func TestIndexMatchAgreesWithPredicate(t *testing.T) {
	r := rand.New(rand.NewSource(7))
	index := NewIndex()
	jobs := map[string]JobFeatures{}
	for i := 0; i < 3000; i++ {
		job := randomJob(r, i)
		index.Upsert(job)
		jobs[job.JobID] = job
	}
	// Replace and remove some, so stale bitmap bits would show up as mismatches.
	for i := 0; i < 400; i++ {
		job := randomJob(r, r.Intn(3000))
		index.Upsert(job)
		jobs[job.JobID] = job
	}
	for i := 0; i < 200; i++ {
		id := fmt.Sprintf("job-%d", r.Intn(3000))
		index.Remove(id)
		delete(jobs, id)
	}
	if index.Len() != len(jobs) {
		t.Fatalf("Len = %d, want %d", index.Len(), len(jobs))
	}
	for trial := 0; trial < 400; trial++ {
		f := randomFilter(r)
		got := index.IDs(index.Match(f))
		want := []string{}
		for id, job := range jobs {
			job := job
			if f.Matches(&job) {
				want = append(want, id)
			}
		}
		sort.Strings(got)
		sort.Strings(want)
		if fmt.Sprint(got) != fmt.Sprint(want) {
			t.Fatalf("filter %s: index has %d jobs, predicate %d", f, len(got), len(want))
		}
		if count := index.Count(f); count != uint64(len(want)) {
			t.Fatalf("Count = %d, want %d", count, len(want))
		}
	}
}

func TestIndexFacetsCountEachChipAgainstTheOtherFilters(t *testing.T) {
	r := rand.New(rand.NewSource(11))
	index := NewIndex()
	jobs := []JobFeatures{}
	for i := 0; i < 1500; i++ {
		job := randomJob(r, i)
		index.Upsert(job)
		jobs = append(jobs, job)
	}
	f := Filter{Workplaces: []Workplace{WorkplaceRemote}, VisaOnly: true}
	facets := index.Facets(f, testNow)
	count := func(filter Filter) uint64 {
		n := uint64(0)
		for i := range jobs {
			if filter.Matches(&jobs[i]) {
				n++
			}
		}
		return n
	}
	if facets.Total != count(f) {
		t.Fatalf("total = %d, want %d", facets.Total, count(f))
	}
	hybrid := Filter{Workplaces: []Workplace{WorkplaceHybrid}, VisaOnly: true}
	if facets.Workplace["hybrid"] != count(hybrid) {
		t.Fatalf("hybrid chip = %d, want %d (workplace filter replaced, visa kept)", facets.Workplace["hybrid"], count(hybrid))
	}
	if facets.Visa != count(Filter{Workplaces: []Workplace{WorkplaceRemote}, VisaOnly: true}) {
		t.Fatalf("visa chip = %d", facets.Visa)
	}
	week := Filter{Workplaces: []Workplace{WorkplaceRemote}, VisaOnly: true, PostedAfter: testNow.Add(-7 * 24 * time.Hour)}
	if facets.PostedDays["7"] != count(week) {
		t.Fatalf("7-day chip = %d, want %d", facets.PostedDays["7"], count(week))
	}
	pay := Filter{Workplaces: []Workplace{WorkplaceRemote}, VisaOnly: true, PayMinUSD: 150_000}
	if facets.PayAtLeast["150000"] != count(pay) {
		t.Fatalf("150k chip = %d, want %d", facets.PayAtLeast["150000"], count(pay))
	}
}

func TestIndexRecentAndLookup(t *testing.T) {
	index := NewIndex()
	for i := 0; i < 10; i++ {
		index.Upsert(JobFeatures{JobID: fmt.Sprintf("j%d", i), PostedAt: testNow.Add(-time.Duration(i) * 24 * time.Hour)})
	}
	got := index.Recent(index.Match(Filter{}), 3)
	if fmt.Sprint(got) != "[j0 j1 j2]" {
		t.Fatalf("Recent = %v", got)
	}
	found := index.Lookup([]string{"j4", "missing"})
	if len(found) != 1 || found["j4"].JobID != "j4" {
		t.Fatalf("Lookup = %v", found)
	}
	location, _ := index.Expansions(Filter{LocationTerms: []string{"x"}})
	if len(location) != 0 {
		t.Fatalf("unknown prefix expanded to %v", location)
	}
}

func TestFilterKeyIgnoresOrder(t *testing.T) {
	a := Filter{Workplaces: []Workplace{WorkplaceRemote, WorkplaceHybrid}, Sources: []string{"direct", "aggregated"}}
	b := Filter{Workplaces: []Workplace{WorkplaceHybrid, WorkplaceRemote}, Sources: []string{"aggregated", "direct"}}
	if a.Key() != b.Key() {
		t.Fatal("filter key should not depend on value order")
	}
	if a.Key() == (Filter{}).Key() {
		t.Fatal("different filters should have different keys")
	}
}

func BenchmarkIndexMatch(b *testing.B) {
	r := rand.New(rand.NewSource(1))
	index := NewIndex()
	for i := 0; i < 200_000; i++ {
		index.Upsert(randomJob(r, i))
	}
	f := Filter{Workplaces: []Workplace{WorkplaceRemote}, PayMinUSD: 150_000, PostedAfter: testNow.Add(-7 * 24 * time.Hour)}
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		index.Count(f)
	}
}
