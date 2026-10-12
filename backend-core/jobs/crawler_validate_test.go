package jobs

import (
	"strings"
	"testing"
	"time"
)

func TestSanitizeCrawledJobDropsBuiltinWebsiteAndInvalidSocials(t *testing.T) {
	job := CrawledJob{
		CompanyLink: "https://builtin.com/company/north",
		CrawledAt:   "not-a-date",
		Company: CrawledCompany{
			Name: "North",
			Metadata: map[string]any{
				"website":    "https://builtin.com/company/north",
				"profileUrl": "https://builtin.com/company/north",
				"socials": map[string]any{
					"linkedin": "https://linkedin.com/company/north",
					"x":        "https://youtube.com/north",
					"tiktok":   "https://tiktok.com/@north",
					"twitter":  "https://x.com/north",
				},
				"about": strings.Repeat("a", maxCrawlerCompanyTextRunes+1),
			},
		},
	}
	sanitizeCrawledJob(&job)
	if job.CompanyLink != "" || job.Company.Metadata["website"] != nil {
		t.Fatalf("kept builtin website: link=%q meta=%+v", job.CompanyLink, job.Company.Metadata)
	}
	if job.Company.Metadata["profileUrl"] != "https://builtin.com/company/north" {
		t.Fatalf("profileUrl = %v", job.Company.Metadata["profileUrl"])
	}
	socials := mapValue(job.Company.Metadata["socials"])
	if socials["linkedin"] != "https://linkedin.com/company/north" || socials["x"] != "https://x.com/north" {
		t.Fatalf("socials = %+v", socials)
	}
	if _, ok := socials["tiktok"]; ok {
		t.Fatalf("kept non-allowlisted social: %+v", socials)
	}
	if job.CrawledAt != "" {
		t.Fatalf("kept invalid crawledAt %q", job.CrawledAt)
	}
	if _, ok := job.Company.Metadata["about"]; ok {
		t.Fatalf("kept oversized about: %+v", job.Company.Metadata)
	}
}

func TestSanitizeCrawledJobKeepsEmployerWebsiteAndRFC3339CrawledAt(t *testing.T) {
	job := CrawledJob{
		CompanyLink: "https://north.example/",
		CrawledAt:   "2026-10-12T18:00:00.000Z",
		Company: CrawledCompany{Metadata: map[string]any{
			"website": "javascript:alert(1)",
			"socials": map[string]any{"linkedin": "ftp://linkedin.com/company/north"},
		}},
	}
	sanitizeCrawledJob(&job)
	if job.CompanyLink != "https://north.example/" || job.Company.Metadata["website"] != "https://north.example/" {
		t.Fatalf("website = %q meta=%+v", job.CompanyLink, job.Company.Metadata)
	}
	if _, ok := job.Company.Metadata["socials"]; ok {
		t.Fatalf("kept non-http socials: %+v", job.Company.Metadata)
	}
	if job.CrawledAt != "2026-10-12T18:00:00Z" {
		t.Fatalf("crawledAt = %q", job.CrawledAt)
	}
}

func TestCrawledAtCountsTowardMetadataSizeCap(t *testing.T) {
	job := crawledJob("https://acme.com/apply/1")
	job.CrawledAt = ""
	job.Metadata = map[string]any{"blob": strings.Repeat("x", 32)}
	without := crawlerJobMetadataBytes(job)
	job.CrawledAt = time.Date(2026, 10, 12, 18, 0, 0, 0, time.UTC).Format(time.RFC3339)
	with := crawlerJobMetadataBytes(job)
	if with <= without {
		t.Fatalf("crawledAt did not count: without=%d with=%d", without, with)
	}

	job.CrawledAt = strings.Repeat("x", maxCrawlerJobMetadataBytes+1)
	if problem := crawledJobProblem(job); problem != "" {
		t.Fatalf("invalid crawledAt should drop, not reject: %q", problem)
	}
}

func TestCrawlerHTTPURLRejectsLongOrNonHTTP(t *testing.T) {
	if _, ok := crawlerHTTPURL("javascript:alert(1)"); ok {
		t.Fatal("accepted javascript URL")
	}
	if _, ok := crawlerCompanyWebsite("https://www.builtin.com/company/north"); ok {
		t.Fatal("accepted builtin website")
	}
	long := "https://north.example/" + strings.Repeat("a", maxCrawlerURLRunes)
	if _, ok := crawlerHTTPURL(long); ok {
		t.Fatal("accepted oversized URL")
	}
	if _, ok := crawlerCompanyWebsite("https://north.example/"); !ok {
		t.Fatal("rejected employer website")
	}
}
