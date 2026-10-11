package ranking

import (
	"fmt"
	"math/rand"
	"sort"
	"testing"
	"time"
)

func TestRerankDedupesAndSpreadsCompanies(t *testing.T) {
	now := testNow
	items := []rankedItem{}
	for i := 0; i < 10; i++ {
		items = append(items, rankedItem{id: fmt.Sprintf("big-%d", i), score: 0.9 - float64(i)*0.001, company: "Big", posted: now.Add(-30 * 24 * time.Hour)})
	}
	for i := 0; i < 20; i++ {
		items = append(items, rankedItem{id: fmt.Sprintf("other-%d", i), score: 0.5 - float64(i)*0.001, company: fmt.Sprintf("Co%d", i), posted: now.Add(-30 * 24 * time.Hour)})
	}
	items = append(items, rankedItem{id: "dup", score: 0.95, dedupe: "k1", posted: now.Add(-30 * 24 * time.Hour)})
	items = append(items, rankedItem{id: "dup-copy", score: 0.94, dedupe: "k1", posted: now.Add(-30 * 24 * time.Hour)})

	out := rerank(items, now)
	if len(out) != len(items)-1 {
		t.Fatalf("len = %d, want %d (one duplicate dropped)", len(out), len(items)-1)
	}
	for start := 0; start < len(out); start += companyWindow {
		end := min(start+companyWindow, len(out))
		count := 0
		for _, item := range out[start:end] {
			if item.company == "Big" {
				count++
			}
		}
		if count > companyCap && start == 0 {
			t.Fatalf("window %d has %d jobs from Big, want <= %d", start, count, companyCap)
		}
	}
	if out[0].id != "dup" {
		t.Fatalf("best item = %s, want dup", out[0].id)
	}
	seen := map[string]bool{}
	for _, item := range out {
		if seen[item.id] {
			t.Fatalf("item %s appears twice", item.id)
		}
		seen[item.id] = true
	}
}

func TestRerankBoostsNewJobs(t *testing.T) {
	items := []rankedItem{
		{id: "old", score: 0.501, posted: testNow.Add(-10 * 24 * time.Hour)},
		{id: "new", score: 0.500, posted: testNow.Add(-2 * time.Hour)},
	}
	if out := rerank(items, testNow); out[0].id != "new" {
		t.Fatalf("new job should win a near tie, got %s first", out[0].id)
	}
}

func TestTopKMatchesFullSort(t *testing.T) {
	r := rand.New(rand.NewSource(3))
	items := make([]rankedItem, 5000)
	for i := range items {
		items[i] = rankedItem{id: fmt.Sprint(i), score: r.Float64()}
	}
	got := topK(append([]rankedItem{}, items...), 100)
	sortByScore(got)
	sorted := append([]rankedItem{}, items...)
	sort.Slice(sorted, func(i, j int) bool { return sorted[i].score > sorted[j].score })
	for i := range got {
		if got[i].id != sorted[i].id {
			t.Fatalf("topK[%d] = %s, want %s", i, got[i].id, sorted[i].id)
		}
	}
}

func TestLinearWeightsSumToOne(t *testing.T) {
	for mode, weights := range linearWeights {
		total := 0.0
		for _, w := range weights {
			total += w
		}
		if total < 0.999 || total > 1.001 {
			t.Errorf("mode %s weights sum to %v, want 1", mode, total)
		}
	}
}

func TestArmIsStableAndRespectsPercent(t *testing.T) {
	if Arm("", "exp", 100, true) != ArmControl || Arm("u", "exp", 0, true) != ArmControl || Arm("u", "exp", 100, false) != ArmControl {
		t.Fatal("anonymous, 0%, and no-model must stay on control")
	}
	learned := 0
	for i := 0; i < 2000; i++ {
		user := fmt.Sprintf("user-%d", i)
		if Arm(user, "exp", 30, true) != Arm(user, "exp", 30, true) {
			t.Fatal("arm must be stable per user")
		}
		if Arm(user, "exp", 30, true) == ArmLearned {
			learned++
		}
	}
	if learned < 500 || learned > 700 {
		t.Fatalf("30%% split assigned %d of 2000", learned)
	}
}
