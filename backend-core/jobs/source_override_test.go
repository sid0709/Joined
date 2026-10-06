package jobs

import (
	"testing"
	"time"

	"go.mongodb.org/mongo-driver/v2/bson"
)

func TestDisabledAthensSourceDropsOutOfSearch(t *testing.T) {
	ResetSourceOverrides()
	t.Cleanup(ResetSourceOverrides)
	source := NewAthensSource(&Store{}, true)
	if !source.Enabled() {
		t.Fatal("athens starts enabled when the store is set")
	}
	if err := SetSourceEnabled(AthensSourceID, false, "bad feed"); err != nil {
		t.Fatal(err)
	}
	if source.Enabled() {
		t.Fatal("killed athens source still enabled")
	}
	filter := (*Store)(nil).buildSearchFilter(SearchQuery{}, time.Now())
	if !containsNin(filter, AthensSourceID) {
		t.Fatalf("search filter = %#v", filter)
	}
	if err := SetSourceEnabled("other", false, "no"); err == nil {
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
