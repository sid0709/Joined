package jobs

import (
	"context"
	"encoding/json"
	"testing"
)

type stubReader struct {
	payload []byte
}

func (s stubReader) Model() string { return "test" }

func (s stubReader) JSON(context.Context, string, string, json.RawMessage) ([]byte, error) {
	return s.payload, nil
}

func TestParsePostedJobFillsDraft(t *testing.T) {
	payload := []byte(`{
		"title": "Product Designer",
		"location": "Chicago",
		"workplace": "hybrid",
		"pay": {"min": 130000, "max": 160000, "currency": "usd", "period": "year"},
		"seniority": "Middle",
		"visa": false,
		"team": "Design",
		"skills": ["Figma", "Research"],
		"summary": "Shape the hiring product.",
		"responsibilities": ["Ship files"],
		"requirements": ["Portfolio"]
	}`)
	text := "We are hiring a Product Designer in Chicago. Hybrid. $130k-$160k. Figma and research. Ship files. Portfolio required. Extra padding so the pasted description is long enough to parse."
	got, err := ParsePostedJob(context.Background(), stubReader{payload: payload}, "Acme", text)
	if err != nil {
		t.Fatal(err)
	}
	if got.Title != "Product Designer" || got.Team != "Design" || got.Location != "Chicago" {
		t.Fatalf("identity = %+v", got)
	}
	if got.PayMin != 130000 || got.Currency != "USD" || got.Workplace != workplaceHybrid {
		t.Fatalf("pay = %+v", got)
	}
	if got.Description != text {
		t.Fatalf("description kept = %q", got.Description)
	}
}

func TestParsePostedJobRejectsShortText(t *testing.T) {
	if _, err := ParsePostedJob(context.Background(), stubReader{}, "Acme", "too short"); err != ErrInvalidInput {
		t.Fatalf("err = %v", err)
	}
}
