package ranking

import (
	"testing"
	"time"

	"github.com/sid0709/Joined/backend-core/jobs"
)

func TestFilterFromQuery(t *testing.T) {
	f := FilterFromQuery(jobs.SearchQuery{
		Workplace: "remote,hybrid,bogus", Remote: true, Seniority: "Senior,Leader", Employment: "contract",
		Source: "direct,aggregated", Location: "San Francisco", Company: "Acme", SalaryMin: 100_000,
		Currency: "EUR", PostedDays: 7, Visa: true, Region: "us,xx",
	}, testNow)
	if len(f.Workplaces) != 2 || len(f.Seniorities) != 2 || len(f.Employments) != 1 || len(f.Regions) != 1 {
		t.Fatalf("enums = %+v", f)
	}
	if f.PayMinUSD != 108_000 || !f.VisaOnly || !f.PostedAfter.Equal(testNow.Add(-7*24*time.Hour)) {
		t.Fatalf("pay/visa/posted = %d %v %v", f.PayMinUSD, f.VisaOnly, f.PostedAfter)
	}
	if len(f.Sources) != 2 || f.HiddenOnly || len(f.LocationTerms) != 2 || f.CompanyTerms[0] != "acme" {
		t.Fatalf("sources/terms = %+v", f)
	}
	hidden := FilterFromQuery(jobs.SearchQuery{Source: "hidden"}, testNow)
	if !hidden.HiddenOnly || len(hidden.Sources) != 0 {
		t.Fatalf("hidden = %+v", hidden)
	}
	if !FilterFromQuery(jobs.SearchQuery{}, testNow).Empty() {
		t.Fatal("no parameters should be an empty filter")
	}
}

func TestParseQuerySuggestions(t *testing.T) {
	p := ParseQuery("remote senior python contract $150k visa this week", DefaultTaxonomy())
	if p.Core != "python" {
		t.Errorf("core = %q, want only the non-filter word", p.Core)
	}
	kinds := map[string]string{}
	for _, s := range p.Suggestions {
		kinds[s.Kind] = s.Value
	}
	want := map[string]string{SuggestWorkplace: "remote", SuggestSeniority: "Senior", SuggestEmployment: "contract", SuggestVisa: "true", SuggestPosted: "7", SuggestPay: "150000"}
	for kind, value := range want {
		if kinds[kind] != value {
			t.Errorf("suggestion %s = %q, want %q (all: %+v)", kind, kinds[kind], value, p.Suggestions)
		}
	}
	if len(p.Skills) == 0 || p.Skills[0] != "python" {
		t.Fatalf("skills = %v", p.Skills)
	}
	left := Unapplied(p.Suggestions, Filter{Workplaces: []Workplace{WorkplaceRemote}, VisaOnly: true})
	for _, s := range left {
		if s.Kind == SuggestWorkplace || s.Kind == SuggestVisa {
			t.Fatalf("applied filters still suggested: %+v", left)
		}
	}
}
