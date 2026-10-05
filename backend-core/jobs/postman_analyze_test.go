package jobs

import (
	"strings"
	"testing"
	"time"
)

func validSearchRecordBody(t *testing.T) []byte {
	t.Helper()
	when := time.Date(2026, 3, 1, 12, 0, 0, 0, time.UTC).Format(time.RFC3339)
	return []byte(`{
		"tempJobId":"507f1f77bcf86cd799439011",
		"applyLink":"https://jobs.example/apply",
		"analyzedAt":"` + when + `",
		"model":"postman",
		"createdBy":"analyzer",
		"source":"Greenhouse",
		"job":{
			"id":"job-public-1",
			"title":"Software Engineer",
			"company":"Acme",
			"companyId":"company-1",
			"location":"Remote",
			"workplace":"remote",
			"pay":{"min":120000,"max":150000,"currency":"USD","period":"year","estimated":false},
			"equity":false,
			"seniority":"Senior",
			"employment":"full-time",
			"postedHoursAgo":12,
			"source":"aggregated",
			"visa":false,
			"applicants":0,
			"team":"Platform",
			"skills":["Go"],
			"summary":"Build platform services.",
			"responsibilities":["Ship features"],
			"requirements":["5+ years Go"],
			"benefits":["Health insurance"],
			"description":"Long original posting text."
		}
	}`)
}

func TestParseSubmittedSearchRecordAcceptsValidAnalysis(t *testing.T) {
	record, err := ParseSubmittedSearchRecord(validSearchRecordBody(t))
	if err != nil {
		t.Fatal(err)
	}
	if record.TempJobID != "507f1f77bcf86cd799439011" || record.Job.Title != "Software Engineer" {
		t.Fatalf("record = %+v", record)
	}
}

func TestParseSubmittedSearchRecordRejectsInvalidAnalysis(t *testing.T) {
	body := validSearchRecordBody(t)
	body = []byte(strings.Replace(string(body), `"workplace":"remote"`, `"workplace":"mars"`, 1))
	if _, err := ParseSubmittedSearchRecord(body); !strings.Contains(err.Error(), "workplace") {
		t.Fatalf("err = %v", err)
	}
	extra := []byte(`{"tempJobId":"507f1f77bcf86cd799439011","extra":true,"job":{}}`)
	if _, err := ParseSubmittedSearchRecord(extra); !strings.Contains(err.Error(), "unknown field") {
		t.Fatalf("extra field err = %v", err)
	}
}

func TestParseSubmittedCompanyResearchAcceptsValidAnalysis(t *testing.T) {
	body := []byte(`{
		"company":{
			"name":"Acme",
			"url":"https://acme.example",
			"logo":"",
			"tagline":"",
			"about":"Acme builds tools.",
			"industry":"Software",
			"size":"51–200",
			"founded":2010,
			"replyDays":0,
			"headquarters":"",
			"companyType":"Private",
			"locations":"",
			"specialties":[],
			"mission":"",
			"values":[],
			"benefitCategories":[]
		},
		"sources":["https://acme.example/about"]
	}`)
	input, err := ParseSubmittedCompanyResearch(body)
	if err != nil {
		t.Fatal(err)
	}
	if input.Company.Name != "Acme" || len(input.Sources) != 1 {
		t.Fatalf("input = %+v", input)
	}
}

func TestParseSubmittedCompanyResearchRejectsInvalidAnalysis(t *testing.T) {
	body := []byte(`{"company":{"name":""},"sources":[]}`)
	if _, err := ParseSubmittedCompanyResearch(body); err == nil {
		t.Fatal("blank name was accepted")
	}
	withExtra := []byte(`{"company":{"name":"Acme","url":"","logo":"","tagline":"","about":"","industry":"","size":"","founded":0,"replyDays":0,"headquarters":"","companyType":"","locations":"","specialties":[],"mission":"","values":[],"benefitCategories":[]},"sources":[],"note":"x"}`)
	if _, err := ParseSubmittedCompanyResearch(withExtra); !strings.Contains(err.Error(), "unknown field") {
		t.Fatalf("err = %v", err)
	}
}

func TestUnanalyzedCompanyFilterRequiresFreshResearch(t *testing.T) {
	filter := unanalyzedCompanyFilter("")
	if len(filter) != 1 || filter[0].Key != researchedAtField {
		t.Fatalf("filter = %+v", filter)
	}
}
