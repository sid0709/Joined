package jobs

import (
	"encoding/json"
	"testing"
	"time"
)

func TestBuildSearchJobUsesFrontendEnums(t *testing.T) {
	posted := time.Date(2026, 9, 25, 12, 0, 0, 0, time.UTC)
	now := posted.Add(50 * time.Hour)
	job := buildSearchJob("4f1c0b3a-6d2e-4a18-8c77-1b9e0d4a6f21", "9c0e1a55-2b7d-4f3a-9d11-6a4c8e2b7d30", "Senior DevOps Engineer", "CyberProof", posted, now, listingHints{
		Location:   "United States",
		Remote:     "Remote",
		Seniority:  "Senior Level",
		Employment: "Full-time",
	}, Extraction{
		Workplace:  "remote",
		Seniority:  "Senior",
		Employment: "full-time",
		Pay:        extractedPay{Min: 105000, Max: 158000, Currency: "usd", Period: "year"},
		Skills:     []string{"AWS", "AWS", "CI/CD"},
		Summary:    "Owns the cloud platform and the pipelines that ship it.",
		Visa:       false,
	})

	if job.ID != "4f1c0b3a-6d2e-4a18-8c77-1b9e0d4a6f21" || job.CompanyID != "9c0e1a55-2b7d-4f3a-9d11-6a4c8e2b7d30" {
		t.Fatalf("identity = %+v", job)
	}
	if job.Workplace != "remote" || job.Seniority != "Senior" || job.Employment != "full-time" || job.Source != "aggregated" {
		t.Fatalf("enums = %+v", job)
	}
	if job.Pay.Min != 105000 || job.Pay.Max != 158000 || job.Pay.Currency != "USD" || job.Pay.Period != "year" {
		t.Fatalf("pay = %+v", job.Pay)
	}
	if job.PostedHoursAgo != 50 {
		t.Fatalf("postedHoursAgo = %d", job.PostedHoursAgo)
	}
	if len(job.Skills) != 2 || job.Applicants != 0 {
		t.Fatalf("skills = %#v applicants = %d", job.Skills, job.Applicants)
	}
}

func TestNormalizePaySwapsInvertedRange(t *testing.T) {
	pay := normalizePay(extractedPay{Min: 80, Max: 40, Currency: "dollars", Period: "hour"}, "")
	if pay.Min != 40 || pay.Max != 80 || pay.Currency != "USD" || pay.Period != "hour" {
		t.Fatalf("pay = %+v", pay)
	}
}

func TestExtractionSchemaIsJSON(t *testing.T) {
	if !json.Valid([]byte(extractionSchema)) {
		t.Fatal("extraction schema is not valid JSON")
	}
}

func TestNormalizePayFallsBackToSalaryHint(t *testing.T) {
	pay := normalizePay(extractedPay{}, "$120K - $150K a year")
	if pay.Min != 120000 || pay.Max != 150000 || pay.Currency != "USD" || pay.Period != "year" {
		t.Fatalf("pay = %+v", pay)
	}

	hourly := normalizePay(extractedPay{}, "$45 - $60 / hr")
	if hourly.Min != 45 || hourly.Max != 60 || hourly.Period != "hour" {
		t.Fatalf("hourly pay = %+v", hourly)
	}

	// The LLM's own read of the description still wins over the raw hint.
	extracted := normalizePay(extractedPay{Min: 90000, Max: 100000, Currency: "USD", Period: "year"}, "$1 - $2 an hour")
	if extracted.Min != 90000 || extracted.Max != 100000 {
		t.Fatalf("extracted pay overridden by hint: %+v", extracted)
	}

	none := normalizePay(extractedPay{}, "Competitive salary")
	if none.Min != 0 || none.Max != 0 {
		t.Fatalf("expected no pay parsed, got %+v", none)
	}
}

func TestSeniorityFromHintNeverPutsStaffOrPrincipalAtSenior(t *testing.T) {
	cases := map[string]string{
		"Staff Software Engineer":  seniorityLeader,
		"Principal Engineer":       seniorityLeader,
		"Lead Engineer":            seniorityLeader,
		"Engineering Manager":      seniorityManager,
		"Director of Engineering":  seniorityManager,
		"Senior Software Engineer": senioritySenior,
		"Mid-level Engineer":       seniorityMiddle,
		"Junior Engineer":          seniorityJunior,
	}
	for input, want := range cases {
		if got := seniorityFromHint(input); got != want {
			t.Errorf("seniorityFromHint(%q) = %q, want %q", input, got, want)
		}
	}
}
