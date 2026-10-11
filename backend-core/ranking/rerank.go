package ranking

import (
	"container/heap"
	"sort"
	"time"
)

// Re-ranking rules.
const (
	// companyWindow and companyCap: at most companyCap jobs from one company in any
	// block of companyWindow results, so one big employer cannot fill a page.
	companyWindow = 20
	companyCap    = 3
	// newJobBoost lifts jobs posted within newJobAge just enough to break near-ties.
	newJobBoost = 0.02
	newJobAge   = 48 * time.Hour
)

// rankedItem is one candidate after scoring.
type rankedItem struct {
	id       string
	score    float64
	features Features
	company  string
	dedupe   string
	posted   time.Time
}

// rerank applies the freshness boost, drops duplicate postings, and spreads
// companies out. It returns a new slice, best first.
func rerank(items []rankedItem, now time.Time) []rankedItem {
	for i := range items {
		if !items[i].posted.IsZero() && now.Sub(items[i].posted) < newJobAge {
			items[i].score += newJobBoost
		}
	}
	sortByScore(items)

	seen := make(map[string]struct{}, len(items))
	unique := items[:0:0]
	for _, item := range items {
		if item.dedupe != "" {
			if _, dup := seen[item.dedupe]; dup {
				continue
			}
			seen[item.dedupe] = struct{}{}
		}
		unique = append(unique, item)
	}
	return spreadCompanies(unique)
}

// spreadCompanies keeps the order but moves a company's extra jobs past the
// window they would crowd. A deferred job takes the first slot it is allowed in.
func spreadCompanies(items []rankedItem) []rankedItem {
	out := make([]rankedItem, 0, len(items))
	counts := map[string]int{}
	deferred := []rankedItem{}
	place := func(item rankedItem) {
		out = append(out, item)
		if item.company != "" {
			counts[item.company]++
		}
		if len(out)%companyWindow == 0 {
			counts = map[string]int{}
		}
	}
	allowed := func(item rankedItem) bool {
		return item.company == "" || counts[item.company] < companyCap
	}
	for _, item := range items {
		for i := 0; i < len(deferred); {
			if allowed(deferred[i]) {
				place(deferred[i])
				deferred = append(deferred[:i], deferred[i+1:]...)
				continue
			}
			i++
		}
		if allowed(item) {
			place(item)
		} else {
			deferred = append(deferred, item)
		}
	}
	// Whatever is left goes at the end in order, applying the cap as windows roll.
	for len(deferred) > 0 {
		progressed := false
		for i := 0; i < len(deferred); {
			if allowed(deferred[i]) {
				place(deferred[i])
				deferred = append(deferred[:i], deferred[i+1:]...)
				progressed = true
				continue
			}
			i++
		}
		if !progressed {
			// Only one company is left; the cap cannot be met, so keep its order.
			place(deferred[0])
			deferred = deferred[1:]
		}
	}
	return out
}

func sortByScore(items []rankedItem) {
	sort.SliceStable(items, func(i, j int) bool {
		if items[i].score != items[j].score {
			return items[i].score > items[j].score
		}
		return items[i].id < items[j].id
	})
}

// topK keeps the k best items by score without sorting the rest: O(n log k).
func topK(items []rankedItem, k int) []rankedItem {
	if k <= 0 || len(items) <= k {
		return items
	}
	h := make(itemHeap, 0, k)
	for _, item := range items {
		if len(h) < k {
			heap.Push(&h, item)
		} else if item.score > h[0].score {
			h[0] = item
			heap.Fix(&h, 0)
		}
	}
	return []rankedItem(h)
}

// itemHeap is a min-heap on score; the root is the weakest kept item.
type itemHeap []rankedItem

func (h itemHeap) Len() int           { return len(h) }
func (h itemHeap) Less(i, j int) bool { return h[i].score < h[j].score }
func (h itemHeap) Swap(i, j int)      { h[i], h[j] = h[j], h[i] }
func (h *itemHeap) Push(v any)        { *h = append(*h, v.(rankedItem)) }
func (h *itemHeap) Pop() any {
	old := *h
	v := old[len(old)-1]
	*h = old[:len(old)-1]
	return v
}
