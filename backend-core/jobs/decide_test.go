package jobs

import (
	"context"
	"encoding/json"
	"testing"
)

type stubDecider struct {
	answers json.RawMessage
}

func (s stubDecider) Model() string { return "typesafe/jev-1.13" }
func (s stubDecider) JSON(context.Context, string, string, json.RawMessage) ([]byte, error) {
	return nil, nil
}
func (s stubDecider) JSONWebSearch(context.Context, string, string, json.RawMessage) ([]byte, []string, error) {
	return nil, nil, nil
}
func (s stubDecider) Decide(context.Context, string, json.RawMessage) (json.RawMessage, error) {
	return s.answers, nil
}

func TestDecideJobClassifiesEnumsAndLeavesTheWriteupEmpty(t *testing.T) {
	reader := stubDecider{answers: json.RawMessage(`{
		"workplace": {"type": "choice", "choice": "remote", "confidence": 0.8},
		"seniority": {"type": "choice", "choice": "Senior", "confidence": 0.2},
		"employment": {"type": "choice", "choice": "full-time"},
		"visa": {"type": "noul", "noul": 0.9}
	}`)}
	payload, err := readExtraction(context.Background(), reader, tempListing{Description: "Build systems."}, true, approachDecisions)
	if err != nil {
		t.Fatal(err)
	}
	extracted, err := parseExtraction(payload)
	if err != nil {
		t.Fatal(err)
	}
	if extracted.Workplace != "remote" || extracted.Seniority != "" || extracted.Employment != "full-time" || !extracted.Visa || extracted.Summary != "" {
		t.Fatalf("extracted = %+v", extracted)
	}
}

func TestDecideCompanyPublishesAClassification(t *testing.T) {
	reader := stubDecider{answers: json.RawMessage(`{
		"found": {"type": "noul", "noul": 0.95},
		"industry": {"type": "choice", "choice": "Software"},
		"companyType": {"type": "choice", "choice": "Private"},
		"size": {"type": "choice", "choice": "11–50"}
	}`)}
	got, err := researchCompany(context.Background(), reader, "Acme", "https://acme.example", true, approachDecisions)
	if err != nil {
		t.Fatal(err)
	}
	if got.Company.Industry != "Software" || got.Company.Size != "11–50" || got.Company.About != "" || len(got.Sources) != 0 {
		t.Fatalf("company = %+v", got.Company)
	}
}

func TestDecideCompanyMissMarksItNotFound(t *testing.T) {
	reader := stubDecider{answers: json.RawMessage(`{"found": {"type": "noul", "noul": 0.1}}`)}
	got, err := researchCompany(context.Background(), reader, "Acme", "https://acme.example", true, approachDecisions)
	if err != nil {
		t.Fatal(err)
	}
	if foundProfile(got.Company) {
		t.Fatalf("company = %+v", got.Company)
	}
}
