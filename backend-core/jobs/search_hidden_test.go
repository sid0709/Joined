package jobs

import (
	"encoding/json"
	"sort"
	"testing"
	"time"

	"go.mongodb.org/mongo-driver/v2/bson"
)

type fakeSearchRow struct {
	id            string
	jobSource     string
	listingSource string
	listingStatus string
	analyzedAt    time.Time
}

func pageFakeSearch(rows []fakeSearchRow, query SearchQuery) []fakeSearchRow {
	matched := make([]fakeSearchRow, 0, len(rows))
	for _, row := range rows {
		if listingMatchesSearch(row.listingStatus, row.jobSource, row.listingSource, query) {
			matched = append(matched, row)
		}
	}
	sort.SliceStable(matched, func(i, j int) bool {
		if !matched[i].analyzedAt.Equal(matched[j].analyzedAt) {
			return matched[i].analyzedAt.After(matched[j].analyzedAt)
		}
		return matched[i].id > matched[j].id
	})
	limit := clampSearchLimit(query.Limit)
	if len(matched) > limit {
		return matched[:limit]
	}
	return matched
}

func TestHiddenSearchFilterUsesPublicListingAndScoutedSource(t *testing.T) {
	s := &Store{}
	filter := s.buildSearchFilter(SearchQuery{Source: SearchSourceHidden}, time.Now())
	if !hasListingStatusFilter(filter) {
		t.Fatalf("hidden filter must keep the public listingStatus clause: %+v", filter)
	}
	if !hasHiddenSourceFilter(filter) {
		t.Fatalf("hidden filter must match scouted job and listing sources: %+v", filter)
	}
}

func TestUnknownSearchSourceDoesNotFilterOrigin(t *testing.T) {
	s := &Store{}
	filter := s.buildSearchFilter(SearchQuery{Source: "aggregated"}, time.Now())
	if hasHiddenSourceFilter(filter) {
		t.Fatalf("unknown source should not add a hidden-jobs clause: %+v", filter)
	}
	if !hasListingStatusFilter(filter) {
		t.Fatalf("unknown source still uses the public listing filter: %+v", filter)
	}
}

func TestListingMatchesSearchHiddenVisibility(t *testing.T) {
	query := SearchQuery{Source: SearchSourceHidden}
	tests := []struct {
		name          string
		listingStatus string
		jobSource     string
		listingSource string
		want          bool
	}{
		{name: "active scouted job.source", listingStatus: ListingActive, jobSource: scoutedJobType, listingSource: ScoutedSource, want: true},
		{name: "legacy empty status analyzed scoutwell", listingStatus: "", jobSource: ScoutedSource, listingSource: ScoutedSource, want: true},
		{name: "scouted job.source with greenhouse listing leftover", listingStatus: ListingActive, jobSource: scoutedJobType, listingSource: "Greenhouse", want: true},
		{name: "document source scoutwell only", listingStatus: ListingActive, jobSource: aggregatedSource, listingSource: ScoutedSource, want: true},
		{name: "pending review scouted never listed", listingStatus: ListingPendingReview, jobSource: scoutedJobType, listingSource: ScoutedSource, want: false},
		{name: "removed scouted never listed", listingStatus: ListingRemoved, jobSource: scoutedJobType, listingSource: ScoutedSource, want: false},
		{name: "draft scouted never listed", listingStatus: ListingDraft, jobSource: scoutedJobType, listingSource: ScoutedSource, want: false},
		{name: "expired scouted never listed", listingStatus: ListingExpired, jobSource: scoutedJobType, listingSource: ScoutedSource, want: false},
		{name: "active aggregated excluded", listingStatus: ListingActive, jobSource: aggregatedSource, listingSource: "Greenhouse", want: false},
		{name: "active direct excluded", listingStatus: ListingActive, jobSource: directType, listingSource: DirectSource, want: false},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := listingMatchesSearch(tt.listingStatus, tt.jobSource, tt.listingSource, query)
			if got != tt.want {
				t.Fatalf("listingMatchesSearch() = %v, want %v", got, tt.want)
			}
		})
	}
}

func TestHiddenFeedPagesAndSortsNewest(t *testing.T) {
	now := time.Date(2026, 10, 5, 12, 0, 0, 0, time.UTC)
	rows := []fakeSearchRow{
		{id: "agg-new", jobSource: aggregatedSource, listingSource: "Greenhouse", listingStatus: ListingActive, analyzedAt: now.Add(3 * time.Hour)},
		{id: "scout-b", jobSource: scoutedJobType, listingSource: ScoutedSource, listingStatus: ListingActive, analyzedAt: now.Add(2 * time.Hour)},
		{id: "scout-pending", jobSource: scoutedJobType, listingSource: ScoutedSource, listingStatus: ListingPendingReview, analyzedAt: now.Add(4 * time.Hour)},
		{id: "scout-a", jobSource: ScoutedSource, listingSource: ScoutedSource, listingStatus: "", analyzedAt: now.Add(time.Hour)},
		{id: "scout-removed", jobSource: scoutedJobType, listingSource: ScoutedSource, listingStatus: ListingRemoved, analyzedAt: now.Add(5 * time.Hour)},
		{id: "scout-c", jobSource: scoutedJobType, listingSource: ScoutedSource, listingStatus: ListingActive, analyzedAt: now},
		{id: "direct", jobSource: directType, listingSource: DirectSource, listingStatus: ListingActive, analyzedAt: now.Add(6 * time.Hour)},
	}

	query := SearchQuery{Source: SearchSourceHidden, SortBy: "newest", Limit: 2}
	page := pageFakeSearch(rows, query)
	if len(page) != 2 {
		t.Fatalf("page len = %d, want 2", len(page))
	}
	if page[0].id != "scout-b" || page[1].id != "scout-a" {
		t.Fatalf("page = %s, %s; want scout-b, scout-a (newest active scouted)", page[0].id, page[1].id)
	}

	query.Limit = 100
	all := pageFakeSearch(rows, query)
	if len(all) != 3 {
		t.Fatalf("full hidden feed len = %d, want 3 active scouted jobs", len(all))
	}
	for _, row := range all {
		if !listingMatchesSearch(row.listingStatus, row.jobSource, row.listingSource, query) {
			t.Fatalf("feed included non-hidden or unpublished row %+v", row)
		}
	}
}

func TestHiddenFlagOnCatalogJob(t *testing.T) {
	hidden := CatalogJob(SearchRecord{
		Job:    SearchJob{ID: "scout-1", Source: scoutedJobType},
		Source: ScoutedSource,
	})
	if !hidden.Hidden {
		t.Fatal("scouted catalog job should set hidden")
	}
	analyzed := CatalogJob(SearchRecord{
		Job:    SearchJob{ID: "scout-2", Source: ScoutedSource},
		Source: ScoutedSource,
	})
	if !analyzed.Hidden {
		t.Fatal("analyzed scoutwell job should set hidden")
	}
	board := CatalogJob(SearchRecord{
		Job:    SearchJob{ID: "agg-1", Source: aggregatedSource},
		Source: "Greenhouse",
	})
	if board.Hidden {
		t.Fatal("aggregated catalog job should not set hidden")
	}
	direct := CatalogJob(SearchRecord{
		Job:    SearchJob{ID: "direct-1", Source: directType},
		Source: DirectSource,
	})
	if direct.Hidden {
		t.Fatal("direct catalog job should not set hidden")
	}
}

func TestSearchResultsJSONKeepsJobsAndAddsHidden(t *testing.T) {
	results := SearchResults{
		Jobs: []catalogJob{
			CatalogJob(SearchRecord{Job: SearchJob{ID: "scout-1", Title: "Engineer", Source: scoutedJobType}, Source: ScoutedSource}),
			CatalogJob(SearchRecord{Job: SearchJob{ID: "agg-1", Title: "Designer", Source: aggregatedSource}, Source: "Greenhouse"}),
		},
		Total:   2,
		HasMore: false,
	}
	raw, err := json.Marshal(results)
	if err != nil {
		t.Fatal(err)
	}
	var body map[string]any
	if err := json.Unmarshal(raw, &body); err != nil {
		t.Fatal(err)
	}
	for _, key := range []string{"jobs", "total", "hasMore"} {
		if _, ok := body[key]; !ok {
			t.Fatalf("response missing %s", key)
		}
	}
	jobs, ok := body["jobs"].([]any)
	if !ok || len(jobs) != 2 {
		t.Fatalf("jobs = %#v", body["jobs"])
	}
	first, _ := jobs[0].(map[string]any)
	second, _ := jobs[1].(map[string]any)
	if first["id"] != "scout-1" || first["hidden"] != true {
		t.Fatalf("first job = %#v", first)
	}
	if second["id"] != "agg-1" || second["hidden"] != false {
		t.Fatalf("second job = %#v", second)
	}
}

func TestSearchQueryHasCriteriaForHiddenSource(t *testing.T) {
	if (SearchQuery{}).HasCriteria() {
		t.Fatal("empty query should keep the catalog path")
	}
	if !(SearchQuery{Source: SearchSourceHidden}).HasCriteria() {
		t.Fatal("source=hidden alone should use paged search")
	}
	if !(SearchQuery{Source: "HIDDEN"}).HasCriteria() {
		t.Fatal("source filter should be case-insensitive")
	}
	if (SearchQuery{Source: "aggregated"}).HasCriteria() {
		t.Fatal("unknown source should not switch off the catalog path")
	}
}

func TestHiddenFeedUsesNewestSortWhenRequested(t *testing.T) {
	s := &Store{}
	sortDoc, err := s.buildSort(SearchQuery{Source: SearchSourceHidden, SortBy: "newest"}, bson.D{})
	if err != nil {
		t.Fatal(err)
	}
	if len(sortDoc) != 2 || sortDoc[0].Key != "analyzedAt" || sortDoc[0].Value != -1 || sortDoc[1].Key != "_id" {
		t.Fatalf("hidden feed sort = %+v, want analyzedAt/_id newest", sortDoc)
	}
}

func TestClampSearchLimitCapsPageSize(t *testing.T) {
	if got := clampSearchLimit(0); got != defaultPageSize {
		t.Fatalf("default limit = %d, want %d", got, defaultPageSize)
	}
	if got := clampSearchLimit(200); got != maxPageSize {
		t.Fatalf("capped limit = %d, want %d", got, maxPageSize)
	}
	if got := clampSearchLimit(20); got != 20 {
		t.Fatalf("explicit limit = %d, want 20", got)
	}
}

func hasListingStatusFilter(filter bson.D) bool {
	for _, cond := range filterConditions(filter) {
		if len(cond) > 0 && cond[0].Key == "listingStatus" {
			return true
		}
	}
	return false
}

func hasHiddenSourceFilter(filter bson.D) bool {
	for _, cond := range filterConditions(filter) {
		if len(cond) == 0 || cond[0].Key != "$or" {
			continue
		}
		branches, ok := cond[0].Value.(bson.A)
		if !ok {
			continue
		}
		var sawScouted, sawScoutwellJob, sawScoutwellDoc bool
		for _, branch := range branches {
			doc, ok := branch.(bson.D)
			if !ok || len(doc) == 0 {
				continue
			}
			switch doc[0].Key {
			case "job.source":
				if doc[0].Value == scoutedJobType {
					sawScouted = true
				}
				if doc[0].Value == ScoutedSource {
					sawScoutwellJob = true
				}
			case "source":
				if doc[0].Value == ScoutedSource {
					sawScoutwellDoc = true
				}
			}
		}
		if sawScouted && sawScoutwellJob && sawScoutwellDoc {
			return true
		}
	}
	return false
}

func filterConditions(filter bson.D) []bson.D {
	if len(filter) == 1 && filter[0].Key == "$and" {
		conditions, ok := filter[0].Value.([]bson.D)
		if ok {
			return conditions
		}
	}
	return []bson.D{filter}
}
