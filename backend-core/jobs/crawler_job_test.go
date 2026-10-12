package jobs

import (
	"encoding/json"
	"strings"
	"testing"
	"time"
)

func TestParseCrawlerBatchKeepsApplyLinkAndCompanyName(t *testing.T) {
	body := []byte(`{"jobs":[{"title":"A","description":"B","applyLink":"https://x.example/a","company":{"name":"B"}}]}`)
	batch, err := ParseCrawlerBatch(body)
	if err != nil || batch.Jobs[0].ApplyLink != "https://x.example/a" || batch.Jobs[0].Company.Name != "B" {
		t.Fatalf("batch = %+v, err = %v", batch, err)
	}
}

func TestParseCrawlerBatchAcceptsAliasesAndUnknownMetadata(t *testing.T) {
	body := []byte(`{
		"createdBy":"joined-scrapper",
		"jobs":[{
			"applyUrl":"https://jobs.example/apply/9",
			"title":"ML Engineer",
			"description":"Train models.",
			"companyName":"North",
			"workMode":"remote",
			"seniority":"Senior",
			"employmentType":"full-time",
			"salary":"$150K",
			"location":"Remote",
			"metadata":{"boardSpecific":{"rank":3},"bad.key":"drop"},
			"extraTop":"also kept"
		}]
	}`)
	batch, err := ParseCrawlerBatch(body)
	if err != nil {
		t.Fatal(err)
	}
	job := batch.Jobs[0]
	if job.ApplyLink != "https://jobs.example/apply/9" || job.Company.Name != "North" {
		t.Fatalf("core = %+v", job)
	}
	if job.Details["remote"] != "remote" || job.Details["seniority"] != "Senior" ||
		job.Details["time"] != "full-time" || job.Details["salary"] != "$150K" ||
		job.Details["location"] != "Remote" {
		t.Fatalf("details = %+v", job.Details)
	}
	if job.Metadata["extraTop"] != "also kept" {
		t.Fatalf("unknown top-level dropped: %+v", job.Metadata)
	}
	nested, _ := job.Metadata["boardSpecific"].(map[string]any)
	if nested["rank"] != float64(3) {
		t.Fatalf("nested metadata = %+v", job.Metadata["boardSpecific"])
	}
}

func TestCrawledJobPersistsCompanyMetadata(t *testing.T) {
	body := []byte(`{"jobs":[{
		"title":"Eng","description":"Build","applyLink":"https://jobs.example/a",
		"company":{"name":"North","logo":"https://cdn.example/n.png","website":"https://north.example","size":"51-200","hq":"Chicago","founded":"2014"},
		"metadata":{"companyAbout":"We build tools.","companySocial":{"linkedin":"https://linkedin.com/company/north"}}
	}]}`)
	batch, err := ParseCrawlerBatch(body)
	if err != nil {
		t.Fatal(err)
	}
	job := batch.Jobs[0]
	if job.Company.Metadata["website"] != "https://north.example" ||
		job.Company.Metadata["size"] != "51-200" ||
		job.Company.Metadata["hq"] != "Chicago" ||
		job.Company.Metadata["founded"] != "2014" ||
		job.Company.Metadata["about"] != "We build tools." {
		t.Fatalf("company metadata = %+v", job.Company.Metadata)
	}
}

func TestCrawledJobLiftsCrawledAtAndBuiltinSocials(t *testing.T) {
	body := []byte(`{"jobs":[{
		"title":"Eng","description":"Build","applyLink":"https://builtin.com/job/1",
		"crawledAt":"2026-10-12T18:00:00.000Z",
		"company":{"name":"North","logo":"https://cdn.example/n.png","website":"https://north.example","profileUrl":"https://builtin.com/company/north","socials":{"linkedin":"https://linkedin.com/company/north"}},
		"metadata":{"postedAtSource":"jsonld+ago"}
	}]}`)
	batch, err := ParseCrawlerBatch(body)
	if err != nil {
		t.Fatal(err)
	}
	job := batch.Jobs[0]
	if job.CrawledAt != "2026-10-12T18:00:00.000Z" {
		t.Fatalf("crawledAt = %q", job.CrawledAt)
	}
	if job.Company.Metadata["website"] != "https://north.example" ||
		job.Company.Metadata["profileUrl"] != "https://builtin.com/company/north" {
		t.Fatalf("company metadata = %+v", job.Company.Metadata)
	}
	socials, _ := job.Company.Metadata["socials"].(map[string]any)
	if socials["linkedin"] != "https://linkedin.com/company/north" {
		t.Fatalf("socials = %+v", job.Company.Metadata["socials"])
	}
}

func TestCrawledJobRejectsOversizedMetadata(t *testing.T) {
	job := crawledJob("https://acme.com/apply/1")
	job.Metadata = map[string]any{"blob": strings.Repeat("x", maxCrawlerJobMetadataBytes+1)}
	if got := crawledJobProblem(job); got != "metadata is too large" {
		t.Fatalf("got %q", got)
	}
}

func TestCrawledJobRejectsOversizedCompanyMetadata(t *testing.T) {
	job := crawledJob("https://acme.com/apply/1")
	job.Company.Metadata = map[string]any{"blob": strings.Repeat("x", maxCrawlerJobMetadataBytes+1)}
	if got := crawledJobProblem(job); got != "metadata is too large" {
		t.Fatalf("got %q", got)
	}
}

func TestParseCrawledPostedAtPrefersAbsolute(t *testing.T) {
	now := time.Date(2026, 10, 12, 12, 0, 0, 0, time.UTC)
	job := CrawledJob{PostedAt: "2026-10-12 16:50:46", PostedAgo: "3 hours ago"}
	got := parseCrawledPostedAt(job, now)
	want := time.Date(2026, 10, 12, 16, 50, 46, 0, time.UTC)
	if !got.Equal(want) {
		t.Fatalf("got %s want %s", got, want)
	}
	relative := parseCrawledPostedAt(CrawledJob{PostedAgo: "3 hours ago"}, now)
	if !relative.Equal(now.Add(-3 * time.Hour)) {
		t.Fatalf("relative = %s", relative)
	}
}

func TestNormalizeCrawledJobJSONRoundTrip(t *testing.T) {
	raw := json.RawMessage(`{"applyUrl":"https://a.example/x","title":"T","description":"D","companyName":"C","location":"NY"}`)
	var job CrawledJob
	if err := json.Unmarshal(raw, &job); err != nil {
		t.Fatal(err)
	}
	if job.ApplyLink != "https://a.example/x" || job.Company.Name != "C" {
		t.Fatalf("aliases = %+v", job)
	}
	if job.Metadata["location"] != "NY" || job.Details["location"] != "NY" {
		t.Fatalf("location = meta %+v details %+v", job.Metadata, job.Details)
	}
}
