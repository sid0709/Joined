package employer

import (
	"errors"
	"testing"
	"time"

	"github.com/sid0709/OpenSeat/backend-core/jobs"
	"github.com/sid0709/OpenSeat/backend-core/jobschema"
)

func TestNormalizeJobStoresCurrencyAndLists(t *testing.T) {
	got, err := normalizeJob(JobInput{
		Title:            "Product Designer",
		Team:             " Design ",
		Location:         "Chicago, IL",
		Workplace:        jobschema.WorkplaceHybrid,
		PayMin:           130000,
		PayMax:           160000,
		Currency:         "eur",
		Summary:          "Shape the product.",
		Skills:           []string{"Figma", "figma", "Research", "Prototyping"},
		Responsibilities: []string{" Ship files "},
		Requirements:     []string{"Portfolio"},
		Description:      "Full posting.",
		Status:           statusOpen,
	}, time.Now())
	if err != nil {
		t.Fatal(err)
	}
	if got.Currency != jobschema.CurrencyEUR || got.Team != "Design" || got.Policy != policyAccept {
		t.Fatalf("job = %+v", got)
	}
	if len(got.Skills) != 3 || got.Skills[0] != "Figma" {
		t.Fatalf("skills = %v", got.Skills)
	}
	if len(got.Responsibilities) != 1 || got.Description != "Full posting." {
		t.Fatalf("copy = %+v", got)
	}
}

func TestNormalizeJobStoresScreeningQuestions(t *testing.T) {
	got, err := normalizeJob(JobInput{
		Title:  "Engineer",
		Status: statusDraft,
		ScreeningQuestions: []jobs.ScreeningQuestion{
			{ID: "q1", Prompt: "  Can you work onsite? ", Kind: jobs.ScreeningYesNo, Required: true, KnockoutAnswer: "no"},
			{ID: "q2", Prompt: "Portfolio", Kind: jobs.ScreeningShortText},
		},
	}, time.Now())
	if err != nil {
		t.Fatal(err)
	}
	if len(got.ScreeningQuestions) != 2 || got.ScreeningQuestions[0].Prompt != "Can you work onsite?" || got.ScreeningQuestions[0].Kind != jobs.ScreeningYesNo || got.ScreeningQuestions[0].KnockoutAnswer != jobs.KnockoutNo {
		t.Fatalf("questions = %+v", got.ScreeningQuestions)
	}
	published := searchJob(got, "Acme")
	if len(published.ScreeningQuestions) != 2 || published.ScreeningQuestions[1].ID != "q2" {
		t.Fatalf("search questions = %+v", published.ScreeningQuestions)
	}
	view := viewJob(got, Pipeline{})
	if len(view.ScreeningQuestions) != 2 {
		t.Fatalf("view questions = %+v", view.ScreeningQuestions)
	}

	_, err = normalizeJob(JobInput{
		Title:              "Engineer",
		Status:             statusDraft,
		ScreeningQuestions: []jobs.ScreeningQuestion{{ID: "q", Prompt: "Essay", Kind: "essay"}},
	}, time.Now())
	if !errors.Is(err, ErrInvalidInput) {
		t.Fatalf("err = %v", err)
	}
}

func TestNormalizeJobStoresAssistedPolicy(t *testing.T) {
	capped, err := normalizeJob(JobInput{
		Title:    "Engineer",
		Policy:   policyCap,
		DailyCap: 8,
		Status:   statusDraft,
	}, time.Now())
	if err != nil {
		t.Fatal(err)
	}
	if capped.Policy != policyCap || capped.DailyCap != 8 {
		t.Fatalf("capped = %+v", capped)
	}

	direct, err := normalizeJob(JobInput{
		Title:    "Engineer",
		Policy:   policyDirect,
		DailyCap: 8,
		Status:   statusDraft,
	}, time.Now())
	if err != nil {
		t.Fatal(err)
	}
	if direct.Policy != policyDirect || direct.DailyCap != 8 {
		t.Fatalf("direct = %+v", direct)
	}

	_, err = normalizeJob(JobInput{
		Title:    "Engineer",
		Policy:   policyCap,
		DailyCap: 0,
		Status:   statusDraft,
	}, time.Now())
	if !errors.Is(err, ErrInvalidInput) {
		t.Fatalf("err = %v", err)
	}
}

func TestWorkspaceStatusAllowsPendingReview(t *testing.T) {
	if !validStatus(statusPendingReview) {
		t.Fatal("pending_review is a workspace status")
	}
	if validStatus(statusRemoved) {
		t.Fatal("removed is staff-only")
	}
}

func TestReplaceTeamRenamesAndDedupes(t *testing.T) {
	got := replaceTeam([]string{"Design", "Data"}, "Data", "Analytics")
	if len(got) != 2 || got[0] != "Design" || got[1] != "Analytics" {
		t.Fatalf("got = %v", got)
	}
}

func TestReadyToPublishNeedsTheFullDescription(t *testing.T) {
	doc := readyJob(statusOpen)
	if err := readyToPublish(doc); err != nil {
		t.Fatalf("ready job rejected: %v", err)
	}
	doc.Description = "  "
	if err := readyToPublish(doc); !errors.Is(err, ErrInvalidInput) {
		t.Fatalf("err = %v, want ErrInvalidInput", err)
	}
}
