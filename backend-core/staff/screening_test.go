package staff

import (
	"testing"

	"github.com/sid0709/OpenSeat/backend-core/jobs"
)

func TestSearchJobCopiesScreeningQuestions(t *testing.T) {
	got := searchJob(hiringJob{
		ID:    "job-1",
		Title: "Engineer",
		ScreeningQuestions: []jobs.ScreeningQuestion{{
			ID: "q1", Prompt: "Work auth?", Kind: jobs.ScreeningYesNo, Required: true, KnockoutAnswer: jobs.KnockoutNo,
		}},
	}, "Acme")
	if len(got.ScreeningQuestions) != 1 || got.ScreeningQuestions[0].ID != "q1" || got.ScreeningQuestions[0].Kind != jobs.ScreeningYesNo {
		t.Fatalf("%+v", got.ScreeningQuestions)
	}
	if got.ScreeningQuestions[0].KnockoutAnswer != jobs.KnockoutNo {
		t.Fatalf("knockout = %q", got.ScreeningQuestions[0].KnockoutAnswer)
	}
	if len(searchJob(hiringJob{ID: "job-2"}, "Acme").ScreeningQuestions) != 0 {
		t.Fatal("expected an empty list")
	}
}
