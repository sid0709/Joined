package jobs

import (
	"testing"
	"time"

	"go.mongodb.org/mongo-driver/v2/bson"
)

func TestDisabledSourceDropsOutOfSearch(t *testing.T) {
	ResetSourceOverrides()
	t.Cleanup(ResetSourceOverrides)
	known := []SourceStatus{{ID: FakeSourceID, Enabled: true}}
	if err := SetSourceEnabled(known, FakeSourceID, false, "bad feed"); err != nil {
		t.Fatal(err)
	}
	rows := MergeSourceStatus(known)
	if len(rows) != 1 || rows[0].Enabled {
		t.Fatalf("merged status = %#v", rows)
	}
	filter := (*Store)(nil).buildSearchFilter(SearchQuery{}, time.Now())
	if !containsNin(filter, FakeSourceID) {
		t.Fatalf("search filter = %#v", filter)
	}
	if err := SetSourceEnabled(known, "other", false, "no"); err == nil {
		t.Fatal("unknown source was accepted")
	}
}

func containsNin(value any, id string) bool {
	switch item := value.(type) {
	case bson.D:
		for _, el := range item {
			if el.Key == "$nin" {
				ids, _ := el.Value.([]string)
				for _, candidate := range ids {
					if candidate == id {
						return true
					}
				}
			}
			if containsNin(el.Value, id) {
				return true
			}
		}
	case []bson.D:
		for _, child := range item {
			if containsNin(child, id) {
				return true
			}
		}
	default:
		return false
	}
	return false
}
