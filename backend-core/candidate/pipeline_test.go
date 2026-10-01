package candidate

import (
	"errors"
	"testing"
	"time"

	"github.com/sid0709/OpenSeat/backend-core/jobs"
)

func TestBuildApplicationStoresIntake(t *testing.T) {
	when := time.Date(2026, 9, 29, 17, 0, 0, 0, time.FixedZone("EDT", -4*60*60))
	questions := []jobs.ScreeningQuestion{{
		ID: "q1", Prompt: "Authorized?", Kind: jobs.ScreeningYesNo, Required: true, KnockoutAnswer: jobs.KnockoutNo,
	}}
	app, err := buildApplication("user-1", ApplyInput{
		Title:          "Designer",
		Company:        "Acme",
		ReferralSource: " linkedin ",
		ConsentVersion: "joined-apply-v1",
		ConsentAt:      when,
		ScreeningAnswers: []ScreeningAnswer{
			{QuestionID: " q1 ", Prompt: "stale", Value: " no "},
			{QuestionID: "q2", Prompt: "Years with Go", Value: "Five years"},
		},
	}, questions, when)
	if err != nil {
		t.Fatal(err)
	}
	if app.UserID != "user-1" || app.ReferralSource != "linkedin" || app.ConsentVersion != "joined-apply-v1" {
		t.Fatalf("intake = %+v", app)
	}
	if !app.ConsentAt.Equal(when.UTC()) {
		t.Fatalf("consentAt = %s", app.ConsentAt)
	}
	if len(app.ScreeningAnswers) != 2 || app.ScreeningAnswers[0].QuestionID != "q1" || app.ScreeningAnswers[0].Value != "no" {
		t.Fatalf("answers = %+v", app.ScreeningAnswers)
	}
	if app.ScreeningAnswers[0].Prompt != "Authorized?" || !app.ScreeningAnswers[0].KnockedOut {
		t.Fatalf("knockout = %+v", app.ScreeningAnswers[0])
	}
	if app.ScreeningAnswers[1].Prompt != "Years with Go" || app.ScreeningAnswers[1].KnockedOut {
		t.Fatalf("second = %+v", app.ScreeningAnswers[1])
	}

	_, err = buildApplication("user-1", ApplyInput{
		Title:            "Designer",
		Company:          "Acme",
		ConsentAt:        when,
		ScreeningAnswers: []ScreeningAnswer{{QuestionID: "", Value: "yes"}},
	}, nil, when)
	if !errors.Is(err, ErrInvalidInput) {
		t.Fatalf("blank id err = %v", err)
	}
	_, err = buildApplication("user-1", ApplyInput{
		Title:   "Designer",
		Company: "Acme",
		ScreeningAnswers: []ScreeningAnswer{
			{QuestionID: "q1", Value: "yes"},
		},
	}, questions, when)
	if !errors.Is(err, ErrInvalidInput) {
		t.Fatalf("missing consent err = %v", err)
	}
	_, err = buildApplication("user-1", ApplyInput{
		Title:     "Designer",
		Company:   "Acme",
		ConsentAt: when,
	}, questions, when)
	if !errors.Is(err, ErrInvalidInput) {
		t.Fatalf("missing answer err = %v", err)
	}

	manual, err := buildApplication("user-1", ApplyInput{Title: "Designer", Company: "Acme"}, nil, when)
	if err != nil || manual.ConsentVersion != "" || len(manual.ScreeningAnswers) != 0 || !manual.ConsentAt.IsZero() {
		t.Fatalf("manual = %+v %v", manual, err)
	}
}

func TestBoardItemsKeepsSavedOffApplications(t *testing.T) {
	apps := []Application{{ID: "a1", JobID: "job-1", ColumnID: StageApplied, Title: "Designer"}}
	saved := []SavedJob{
		{ID: "s1", JobID: "job-1", Title: "Designer"},
		{ID: "s2", JobID: "job-2", Title: "Engineer"},
	}
	board := BoardItems(apps, saved)
	if len(board) != 2 {
		t.Fatalf("board len = %d", len(board))
	}
	if board[0].ColumnID != StageApplied || board[1].ColumnID != StageSaved {
		t.Fatalf("columns = %s %s", board[0].ColumnID, board[1].ColumnID)
	}
	jobID, ok := IsSavedBoardID(board[1].ID)
	if !ok || jobID != "job-2" {
		t.Fatalf("saved id = %s %v", board[1].ID, ok)
	}
}

func TestSaveDoesNotCreateApplication(t *testing.T) {
	board := BoardItems(nil, []SavedJob{{ID: "s", JobID: "job-9", Title: "Analyst"}})
	if len(board) != 1 || board[0].ColumnID != StageSaved || board[0].JobID != "job-9" {
		t.Fatalf("saved-only board = %+v", board)
	}
}

func TestInterviewMovesOpenApplication(t *testing.T) {
	if stageOnInterviewScheduled(StageApplied) != StageInterview {
		t.Fatal("applied should move to interview")
	}
	if stageOnInterviewScheduled(StageOffer) != StageOffer {
		t.Fatal("offer stays offer")
	}
}

func TestOutcomeStages(t *testing.T) {
	stage, reason := stageOnOutcome(OutcomeAdvanced)
	if stage != StageOffer || reason != "" {
		t.Fatalf("advanced = %s %s", stage, reason)
	}
	stage, reason = stageOnOutcome(OutcomeRejected)
	if stage != StageClosed || reason != "Rejected" {
		t.Fatalf("rejected = %s %s", stage, reason)
	}
}

func TestThreadVisibleToBothSides(t *testing.T) {
	doc := storedThread{CandidateUserID: "cand-1", CompanyID: "co-1"}
	if !threadVisibleTo(doc, "cand-1", "") {
		t.Fatal("candidate should see their thread")
	}
	if !threadVisibleTo(doc, "recruiter-1", "co-1") {
		t.Fatal("company member should see the same thread")
	}
	if threadVisibleTo(doc, "other", "") || threadVisibleTo(doc, "recruiter-1", "co-2") {
		t.Fatal("outsiders must not see the thread")
	}
}
