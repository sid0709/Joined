package jobs

import (
	"encoding/json"
	"errors"
	"strings"
	"testing"
	"time"
)

func TestNormalizeScreeningQuestionsKeepsIntakeShape(t *testing.T) {
	got, err := NormalizeScreeningQuestions([]ScreeningQuestion{
		{ID: " q1 ", Prompt: "  Authorized to work? ", Kind: ScreeningYesNo, Required: true, KnockoutAnswer: " NO "},
		{ID: "q2", Prompt: "Years with Go", Kind: ScreeningShortText, KnockoutAnswer: "no"},
	})
	if err != nil {
		t.Fatal(err)
	}
	if len(got) != 2 || got[0].ID != "q1" || got[0].Prompt != "Authorized to work?" || got[0].Kind != ScreeningYesNo || !got[0].Required {
		t.Fatalf("first = %+v", got[0])
	}
	if got[0].KnockoutAnswer != KnockoutNo {
		t.Fatalf("knockout = %q", got[0].KnockoutAnswer)
	}
	if got[1].Kind != ScreeningShortText || got[1].KnockoutAnswer != "" {
		t.Fatalf("second = %+v", got[1])
	}

	body, err := json.Marshal(got[0])
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(string(body), `"kind":"yes_no"`) || !strings.Contains(string(body), `"knockoutAnswer":"no"`) || strings.Contains(string(body), `"type"`) {
		t.Fatalf("json = %s", body)
	}

	plain, err := json.Marshal(ScreeningQuestion{ID: "q", Prompt: "Name", Kind: ScreeningShortText, Required: true})
	if err != nil {
		t.Fatal(err)
	}
	if strings.Contains(string(plain), "knockout") {
		t.Fatalf("omitted knockout leaked: %s", plain)
	}
}

func TestNormalizeScreeningQuestionsRejectsBadInput(t *testing.T) {
	_, err := NormalizeScreeningQuestions([]ScreeningQuestion{{ID: "q", Prompt: "Hi", Kind: "essay"}})
	if !errors.Is(err, ErrInvalidInput) {
		t.Fatalf("kind err = %v", err)
	}
	_, err = NormalizeScreeningQuestions([]ScreeningQuestion{{ID: "q", Prompt: "  ", Kind: ScreeningYesNo}})
	if !errors.Is(err, ErrInvalidInput) {
		t.Fatalf("prompt err = %v", err)
	}
	_, err = NormalizeScreeningQuestions([]ScreeningQuestion{{ID: "q", Prompt: "Auth?", Kind: ScreeningYesNo, KnockoutAnswer: "maybe"}})
	if !errors.Is(err, ErrInvalidInput) {
		t.Fatalf("knockout err = %v", err)
	}
	_, err = NormalizeScreeningQuestions([]ScreeningQuestion{
		{ID: "q", Prompt: "One", Kind: ScreeningYesNo},
		{ID: "q", Prompt: "Two", Kind: ScreeningShortText},
	})
	if !errors.Is(err, ErrInvalidInput) {
		t.Fatalf("dup err = %v", err)
	}
	tooMany := make([]ScreeningQuestion, maxScreeningQuestions+1)
	for i := range tooMany {
		tooMany[i] = ScreeningQuestion{ID: string(rune('a' + i)), Prompt: "Q", Kind: ScreeningYesNo}
	}
	_, err = NormalizeScreeningQuestions(tooMany)
	if !errors.Is(err, ErrInvalidInput) {
		t.Fatalf("limit err = %v", err)
	}
}

func TestSearchViewIncludesScreeningQuestions(t *testing.T) {
	record := (storedSearchJob{Job: SearchJob{
		ScreeningQuestions: []ScreeningQuestion{{
			ID: "q", Prompt: "Auth?", Kind: ScreeningYesNo, Required: true, KnockoutAnswer: KnockoutNo,
		}},
	}}).view(time.Now())
	if len(record.Job.ScreeningQuestions) != 1 || !record.Job.ScreeningQuestions[0].Required || record.Job.ScreeningQuestions[0].KnockoutAnswer != KnockoutNo {
		t.Fatalf("%+v", record.Job.ScreeningQuestions)
	}
	empty := (storedSearchJob{}).view(time.Now())
	if empty.Job.ScreeningQuestions == nil {
		t.Fatal("nil screeningQuestions")
	}
}

func TestNormalizeScreeningQuestionsFillsBlankID(t *testing.T) {
	got, err := NormalizeScreeningQuestions(nil)
	if err != nil || len(got) != 0 {
		t.Fatalf("empty = %+v %v", got, err)
	}
	got, err = NormalizeScreeningQuestions([]ScreeningQuestion{{Prompt: "Portfolio link", Kind: ScreeningShortText}})
	if err != nil {
		t.Fatal(err)
	}
	if !isPublicID(got[0].ID) {
		t.Fatalf("id = %s", got[0].ID)
	}
}
