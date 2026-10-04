package jobs

import (
	"net/url"
	"testing"
)

func TestParseStagedCompanyQuery(t *testing.T) {
	query := ParseStagedCompanyQuery(url.Values{
		"page":     {"2"},
		"pageSize": {"50"},
		"q":        {"  g2i "},
		"hide":     {"notFound"},
	})
	if query.Page != 2 || query.PageSize != 50 || query.Q != "g2i" || !query.HideNotFound {
		t.Fatalf("query = %+v", query)
	}
	open := ParseStagedCompanyQuery(url.Values{"hide": {"analyzed"}})
	if open.HideNotFound || open.Page != 1 || open.PageSize != DefaultPageSize {
		t.Fatalf("open query = %+v", open)
	}
}

func TestStagedCompanyFilter(t *testing.T) {
	if got := stagedCompanyFilter(StagedCompanyQuery{}); len(got) != 0 {
		t.Fatalf("empty query filter = %v", got)
	}

	hidden := stagedCompanyFilter(StagedCompanyQuery{HideNotFound: true})
	if len(hidden) != 1 || hidden[0].Key != researchFoundField {
		t.Fatalf("hide filter = %v", hidden)
	}

	searched := stagedCompanyFilter(StagedCompanyQuery{ListQuery: ListQuery{Q: "acme"}})
	if len(searched) != 1 || searched[0].Key != "$or" {
		t.Fatalf("search filter = %v", searched)
	}
	both := stagedCompanyFilter(StagedCompanyQuery{ListQuery: ListQuery{Q: "acme"}, HideNotFound: true})
	if len(both) != 2 || both[0].Key != "$or" || both[1].Key != researchFoundField {
		t.Fatalf("search and hide filter = %v", both)
	}
}

func TestSelectedCompanyIDsDropsBlanksAndDuplicates(t *testing.T) {
	got := selectedCompanyIDs([]string{" a ", "", "a", "b", "  b "})
	if len(got) != 2 || got[0] != "a" || got[1] != "b" {
		t.Fatalf("selected = %v", got)
	}
	if len(selectedCompanyIDs(nil)) != 0 {
		t.Fatal("no selection should be empty")
	}
}

func TestStagedStatus(t *testing.T) {
	no := false
	yes := true
	if stagedStatus(nil) != StagedWaiting {
		t.Fatal("a company research has not tried should be waiting")
	}
	if stagedStatus(&yes) != StagedWaiting {
		t.Fatal("a company research found should stay waiting until it leaves staging")
	}
	if stagedStatus(&no) != StagedNotFound {
		t.Fatal("a company research missed should be not found")
	}
}
