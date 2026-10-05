package jobs

import (
	"context"
	"encoding/json"
	"strings"
	"testing"
)

type stubReader struct {
	payload []byte
}

func (s stubReader) Model() string { return "test" }

func (s stubReader) JSON(context.Context, string, string, json.RawMessage) ([]byte, error) {
	return s.payload, nil
}

func (s stubReader) JSONWebSearch(context.Context, string, string, json.RawMessage) ([]byte, []string, error) {
	return s.payload, nil, nil
}

type countingReader struct {
	stubReader
	web, plain             int
	webPrompt, plainPrompt string
}

func (c *countingReader) JSON(_ context.Context, system, _ string, _ json.RawMessage) ([]byte, error) {
	c.plain++
	c.plainPrompt = system
	return c.payload, nil
}

func (c *countingReader) JSONWebSearch(_ context.Context, system, _ string, _ json.RawMessage) ([]byte, []string, error) {
	c.web++
	c.webPrompt = system
	return c.payload, nil, nil
}

func TestReadExtractionFollowsTheWebSearchSwitch(t *testing.T) {
	reader := &countingReader{stubReader: stubReader{payload: []byte(`{}`)}}
	if _, err := readExtraction(context.Background(), reader, tempListing{}, true); err != nil {
		t.Fatal(err)
	}
	if _, err := readExtraction(context.Background(), reader, tempListing{}, false); err != nil {
		t.Fatal(err)
	}
	if reader.web != 1 || reader.plain != 1 {
		t.Fatalf("web=%d plain=%d", reader.web, reader.plain)
	}
	if !strings.Contains(reader.webPrompt, "web search") || strings.Contains(reader.plainPrompt, "web search") {
		t.Fatal("the switch must pick the matching prompt")
	}
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
