package candidate

import (
	"testing"
	"time"
)

func TestBuildApplicationSeedsStageTiming(t *testing.T) {
	when := time.Date(2026, 9, 29, 17, 0, 0, 0, time.FixedZone("EDT", -4*60*60))
	app, err := buildApplication("user-1", ApplyInput{Title: "Designer", Company: "Acme"}, nil, when)
	if err != nil {
		t.Fatal(err)
	}
	if len(app.StageHistory) != 1 || app.StageHistory[0].Stage != "new" {
		t.Fatalf("history = %+v", app.StageHistory)
	}
	if !app.StageEnteredAt.Equal(when.UTC()) || !app.StageHistory[0].EnteredAt.Equal(when.UTC()) {
		t.Fatalf("entered = %s history = %s", app.StageEnteredAt, app.StageHistory[0].EnteredAt)
	}
}

func TestRecordStageEntrySeedsPriorDwell(t *testing.T) {
	applied := time.Date(2026, 9, 1, 15, 0, 0, 0, time.UTC)
	moved := time.Date(2026, 9, 11, 15, 0, 0, 0, time.UTC)
	app := Application{
		ColumnID: StageApplied,
		Updated:  applied,
		Activity: []ApplicationEvent{{Date: applied}},
	}
	prev := CompanyBoardStage(app.ColumnID, app.CompanyStage, app.ClosedReason)
	app.ColumnID = StageScreening
	app.CompanyStage = boardScreening
	next := CompanyBoardStage(app.ColumnID, app.CompanyStage, app.ClosedReason)
	recordStageEntry(&app, prev, next, moved)
	if prev != "new" || next != "screening" {
		t.Fatalf("stages %s -> %s", prev, next)
	}
	if len(app.StageHistory) != 2 || app.StageHistory[0].Stage != "new" || app.StageHistory[1].Stage != "screening" {
		t.Fatalf("history = %+v", app.StageHistory)
	}
	if !app.StageHistory[0].EnteredAt.Equal(applied) || !app.StageEnteredAt.Equal(moved) {
		t.Fatalf("entered prior %s current %s", app.StageHistory[0].EnteredAt, app.StageEnteredAt)
	}
	recordStageEntry(&app, next, next, moved.Add(time.Hour))
	if len(app.StageHistory) != 2 {
		t.Fatalf("same stage appended history: %+v", app.StageHistory)
	}
}

func TestCompanyBoardStage(t *testing.T) {
	if got := CompanyBoardStage(StageApplied, "", ""); got != "new" {
		t.Fatalf("applied -> %s", got)
	}
	if got := CompanyBoardStage(StageClosed, "", "Hired"); got != "hired" {
		t.Fatalf("hired -> %s", got)
	}
	if got := CompanyBoardStage(StageClosed, "offer", "Rejected"); got != "offer" {
		t.Fatalf("stored wins, got %s", got)
	}
	if got := CompanyBoardStage(StageInterview, "phone-screen", ""); got != "phone-screen" {
		t.Fatalf("custom = %s", got)
	}
}
