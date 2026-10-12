package jobs

import (
	"testing"
	"time"
)

func TestHydrationCacheServesFreshEntries(t *testing.T) {
	var c hydrationCache
	now := time.Date(2026, 10, 1, 12, 0, 0, 0, time.UTC)
	job := catalogJob{SearchJob: SearchJob{ID: "job-1", Title: "Data Engineer"}}
	c.put("a", job, now.Add(-2*time.Hour), now)

	found, missing := c.get([]string{"a", "b"}, now.Add(hydrationTTL/2))
	if len(missing) != 1 || missing[0] != "b" {
		t.Fatalf("missing = %v, want [b]", missing)
	}
	if got := found["a"]; got.Title != "Data Engineer" || got.PostedHoursAgo != 2 {
		t.Fatalf("cached job = %+v, want the title and a posted age recomputed at read time", got)
	}

	if _, missing := c.get([]string{"a"}, now.Add(hydrationTTL+time.Second)); len(missing) != 1 {
		t.Fatal("an expired entry should be loaded again")
	}
}
