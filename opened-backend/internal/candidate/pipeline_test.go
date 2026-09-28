package candidate

import "testing"

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
