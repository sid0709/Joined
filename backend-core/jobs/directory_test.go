package jobs

import (
	"net/url"
	"testing"
)

func TestPublishableNeedsARealWriteUp(t *testing.T) {
	full := SearchJob{
		Title:            "Engineer",
		Company:          "Acme",
		Summary:          "Builds payments.",
		Responsibilities: []string{"Ship features"},
		Skills:           []string{"Go"},
	}
	if !publishable(full) {
		t.Fatal("a full analysis should publish")
	}
	for name, change := range map[string]func(*SearchJob){
		"placeholder title":   func(j *SearchJob) { j.Title = untitledJob },
		"placeholder company": func(j *SearchJob) { j.Company = unknownCompany },
		"no summary":          func(j *SearchJob) { j.Summary = "" },
		"no duties":           func(j *SearchJob) { j.Responsibilities = nil },
		"no skills":           func(j *SearchJob) { j.Skills = nil },
	} {
		job := full
		change(&job)
		if publishable(job) {
			t.Errorf("%s: should not publish", name)
		}
	}
	requirementsOnly := full
	requirementsOnly.Responsibilities, requirementsOnly.Requirements = nil, []string{"5 years of Go"}
	if !publishable(requirementsOnly) {
		t.Error("requirements alone describe the job well enough")
	}
}

func TestDirectoryQueriesFallBackToSafeDefaults(t *testing.T) {
	company := ParseCompanyQuery(url.Values{"sort": {"drop table"}, "minCompletion": {"150"}, "logo": {"maybe"}, "dir": {"desc"}})
	if company.Sort != CompanySortName || company.MinCompletion != 0 || company.HasLogo != "" || !company.Desc {
		t.Fatalf("company query = %+v", company)
	}
	job := ParseJobQuery(url.Values{"maxCompletion": {"40"}, "pay": {FilterYes}})
	if job.Sort != JobSortAnalyzed || !job.Desc || job.MaxCompletion != 40 || job.HasPay != FilterYes {
		t.Fatalf("job query = %+v", job)
	}
	sorted := ParseJobQuery(url.Values{"sort": {JobSortTitle}})
	if sorted.Sort != JobSortTitle || sorted.Desc {
		t.Fatalf("sorted job query = %+v", sorted)
	}
}
