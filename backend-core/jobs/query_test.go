package jobs

import "testing"

func TestParseListQuery(t *testing.T) {
	query := ParseListQuery("3", "500", "  devops  ")
	if query.Page != 3 {
		t.Fatalf("page = %d", query.Page)
	}
	if query.PageSize != 500 {
		t.Fatalf("pageSize = %d", query.PageSize)
	}
	if capped := ParseListQuery("1", "5000", ""); capped.PageSize != MaxPageSize {
		t.Fatalf("capped pageSize = %d", capped.PageSize)
	}
	if query.Q != "devops" {
		t.Fatalf("q = %q", query.Q)
	}

	fallback := ParseListQuery("nope", "0", "")
	if fallback.Page != 1 || fallback.PageSize != DefaultPageSize {
		t.Fatalf("fallback = %+v", fallback)
	}
}

func TestSearchPatternQuotesMeta(t *testing.T) {
	if got := searchPattern("c++"); got != `c\+\+` {
		t.Fatalf("pattern = %q", got)
	}
	if got := searchPattern("   "); got != "" {
		t.Fatalf("blank pattern = %q", got)
	}
}
