package ranking

import (
	"testing"
	"time"
)

func TestFuseKeywordOnlyHitsNeedCoverage(t *testing.T) {
	s, _ := newTestService(t, nil)
	index := s.Index()
	byTitle := map[string]string{}
	index.ForEach(index.Match(Filter{}), func(job *JobFeatures) bool {
		if _, ok := byTitle[job.Title]; !ok {
			byTitle[job.Title] = job.JobID
		}
		return true
	})
	nurse, engineer, ml := byTitle["Registered Nurse"], byTitle["Frontend Engineer"], byTitle["Senior Machine Learning Engineer"]

	// Equal keyword scores: only the job whose title carries the terms survives.
	results := []channelResult{{name: chanQueryLex, hits: []Hit{{JobID: engineer, Score: 4}, {JobID: nurse, Score: 4}}}}
	got := fuse(results, ModeQuery, false, keywordCoverage(index, "registered nurse"))
	if len(got.ids) != 1 || got.ids[0] != nurse {
		t.Fatalf("keyword-only hits = %v, want only the nurse job %s", got.ids, nurse)
	}

	// A meaning hit above the floor needs no keyword coverage.
	results = append(results, channelResult{name: chanQueryTitle, hits: []Hit{{JobID: ml, Score: denseTitleFloor + 0.05}}})
	got = fuse(results, ModeQuery, false, keywordCoverage(index, "registered nurse"))
	if len(got.ids) != 2 {
		t.Fatalf("got %v, want the nurse job and the dense hit", got.ids)
	}

	// One term in three is enough coverage; none is not.
	if !keywordCoverage(index, "frontend platform architect")(engineer) {
		t.Error("one of three query terms in the title should count")
	}
	if keywordCoverage(index, "registered nurse")(engineer) {
		t.Error("a title with no query term should not count")
	}
	if keywordCoverage(index, "frontend engineer")("missing-job") {
		t.Error("a job missing from the index should not count")
	}
}

func TestDegradedListsAreCachedBriefly(t *testing.T) {
	s, _ := newTestService(t, nil)
	s.cfg.CacheTTL = 10 * time.Minute
	if got := s.listTTL(RankedList{Degraded: true}); got != degradedCacheTTL {
		t.Errorf("degraded TTL = %v, want %v", got, degradedCacheTTL)
	}
	if got := s.listTTL(RankedList{}); got != s.cfg.CacheTTL {
		t.Errorf("full TTL = %v, want %v", got, s.cfg.CacheTTL)
	}
}
