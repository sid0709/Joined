package jobs

import (
	"context"
	"errors"
	"sync/atomic"
	"testing"
	"time"
)

func TestRunBulkLoadsInBatchesAndWorksConcurrently(t *testing.T) {
	ids := make([]int, bulkFetchBatch*2+5)
	for i := range ids {
		ids[i] = i
	}
	var loads, worked, current, peak atomic.Int32
	load := func(_ context.Context, batch []int) ([]int, error) {
		loads.Add(1)
		return batch, nil
	}
	work := func(context.Context, int) error {
		now := current.Add(1)
		for {
			old := peak.Load()
			if now <= old || peak.CompareAndSwap(old, now) {
				break
			}
		}
		time.Sleep(time.Millisecond)
		current.Add(-1)
		worked.Add(1)
		return nil
	}
	if err := runBulk(context.Background(), ids, 16, load, work); err != nil {
		t.Fatal(err)
	}
	if loads.Load() != 3 || int(worked.Load()) != len(ids) {
		t.Fatalf("loads = %d worked = %d", loads.Load(), worked.Load())
	}
	if peak.Load() < 2 {
		t.Fatalf("peak concurrency = %d", peak.Load())
	}
}

func TestRunBulkStopsOnWorkError(t *testing.T) {
	stop := errors.New("stop")
	ids := make([]int, bulkFetchBatch*5)
	var worked atomic.Int32
	load := func(_ context.Context, batch []int) ([]int, error) { return batch, nil }
	work := func(ctx context.Context, id int) error {
		worked.Add(1)
		if id == 0 {
			return stop
		}
		<-ctx.Done()
		return nil
	}
	if err := runBulk(context.Background(), ids, 4, load, work); !errors.Is(err, stop) {
		t.Fatalf("err = %v", err)
	}
	if int(worked.Load()) == len(ids) {
		t.Fatal("run kept going after the error")
	}
}

func TestResearchFillOnlyFillsBlanks(t *testing.T) {
	url := ""
	doc := storedCompany{
		CompanyName: "Acme",
		Overrides: companyOverrides{
			URL: &url,
			Profile: companyProfile{
				About:       "Written by staff",
				Specialties: []string{"Payments"},
			},
		},
	}
	found := CompanyWrite{
		URL:         "https://acme.example",
		About:       "Found on the web",
		Industry:    "Fintech",
		Founded:     2015,
		Specialties: []string{"Lending"},
	}
	set := researchFill(doc, found)
	got := map[string]any{}
	for _, field := range set {
		got[field.Key] = field.Value
	}
	if got["overrides.url"] != "https://acme.example" || got["overrides.profile.industry"] != "Fintech" || got["overrides.profile.founded"] != 2015 {
		t.Fatalf("set = %v", set)
	}
	for _, kept := range []string{"overrides.profile.about", "overrides.profile.specialties", "overrides.profile.mission"} {
		if _, ok := got[kept]; ok {
			t.Fatalf("%s should be left alone: %v", kept, set)
		}
	}
}
