package jobs

import (
	"encoding/json"
	"testing"
)

func TestParseTitleTopKKeepsKnownIdsAndCaps(t *testing.T) {
	known := map[string]JobBrief{
		"a": {ID: "a", Title: "Platform Engineer", Company: "Acme"},
		"b": {ID: "b", Title: "Staff Platform Engineer", Company: "Acme"},
		"c": {ID: "c", Title: "Accountant", Company: "Other"},
		"d": {ID: "d", Title: "Platform", Company: "Acme"},
		"e": {ID: "e", Title: "SRE", Company: "Acme"},
		"f": {ID: "f", Title: "Extra", Company: "Acme"},
	}
	payload, err := json.Marshal(titleTopKReply{IDs: []string{" missing ", "a", "a", "nope", "b", "c", "d", "e", "f"}})
	if err != nil {
		t.Fatal(err)
	}
	got := parseTitleTopK(payload, known)
	if len(got) != DuplicateTitleTopK {
		t.Fatalf("len = %d, want %d (%#v)", len(got), DuplicateTitleTopK, got)
	}
	if got[0].JobID != "a" || got[1].JobID != "b" || got[2].JobID != "c" {
		t.Fatalf("order = %#v", got)
	}
}

func TestParseSamePositionIgnoresUnknownIds(t *testing.T) {
	known := map[string]JobBrief{"job-1": {ID: "job-1", Title: "Engineer", Company: "Acme"}}
	hit, err := parseSamePosition([]byte(`{"same_position":true,"job_id":"other","reason":"looks similar"}`), known)
	if err != nil || hit != nil {
		t.Fatalf("hit = %#v err = %v", hit, err)
	}
	hit, err = parseSamePosition([]byte(`{"same_position":true,"job_id":"job-1","reason":"same opening"}`), known)
	if err != nil || hit == nil || hit.JobID != "job-1" || hit.Reason != "same opening" {
		t.Fatalf("hit = %#v err = %v", hit, err)
	}
	hit, err = parseSamePosition([]byte(`{"same_position":false,"job_id":"job-1","reason":"different team"}`), known)
	if err != nil || hit != nil {
		t.Fatalf("negative hit = %#v err = %v", hit, err)
	}
}

func TestTitleTopKAndSamePositionSchemasAreJSON(t *testing.T) {
	if !json.Valid([]byte(titleTopKSchema)) {
		t.Fatal("title top-k schema is not valid JSON")
	}
	if !json.Valid([]byte(samePositionSchema)) {
		t.Fatal("same-position schema is not valid JSON")
	}
}

func TestTitleSearchRegexUsesWords(t *testing.T) {
	pattern := titleSearchRegex("Senior Platform Engineer")
	if pattern == "" {
		t.Fatal("empty pattern")
	}
	if titleSearchRegex("   ") != "" {
		t.Fatal("blank title should have no pattern")
	}
}
