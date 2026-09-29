package candidate

import (
	"strings"
	"testing"
	"time"
)

func TestCloseNoticeAudienceSkipsTerminal(t *testing.T) {
	apps := []Application{
		{ID: "open", JobID: "job-1", CompanyID: "co", ColumnID: StageApplied},
		{ID: "screen", JobID: "job-1", CompanyID: "co", ColumnID: StageScreening},
		{ID: "talk", JobID: "job-1", CompanyID: "co", ColumnID: StageInterview},
		{ID: "offer", JobID: "job-1", CompanyID: "co", ColumnID: StageOffer},
		{ID: "custom", JobID: "job-1", CompanyID: "co", ColumnID: StageApplied, CompanyStage: "phone-screen"},
		{ID: "withdrawn", JobID: "job-1", CompanyID: "co", ColumnID: StageClosed, ClosedReason: "Withdrawn"},
		{ID: "rejected", JobID: "job-1", CompanyID: "co", ColumnID: StageClosed, ClosedReason: "Rejected"},
		{ID: "hired", JobID: "job-1", CompanyID: "co", ColumnID: StageClosed, ClosedReason: "Hired"},
		{ID: "ghost", JobID: "job-1", CompanyID: "co", ColumnID: StageClosed, ClosedReason: "No response"},
		{ID: "saved", JobID: "job-1", CompanyID: "co", ColumnID: StageSaved},
		{ID: "other-job", JobID: "job-2", CompanyID: "co", ColumnID: StageApplied},
		{ID: "other-co", JobID: "job-1", CompanyID: "other", ColumnID: StageApplied},
		{ID: "stale-reject", JobID: "job-1", CompanyID: "co", ColumnID: StageApplied, CompanyStage: boardRejected},
		{ID: "stale-hire", JobID: "job-1", CompanyID: "co", ColumnID: StageOffer, CompanyStage: boardHired},
		{ID: "", JobID: "job-1", CompanyID: "co", ColumnID: StageApplied},
	}
	got := closeNoticeAudience("co", "job-1", apps)
	want := []string{"open", "screen", "talk", "offer", "custom"}
	if len(got) != len(want) {
		ids := make([]string, len(got))
		for i, app := range got {
			ids[i] = app.ID
		}
		t.Fatalf("audience = %v", ids)
	}
	for i, id := range want {
		if got[i].ID != id {
			t.Fatalf("audience[%d] = %s", i, got[i].ID)
		}
	}
	if closeNoticeAudience("", "job-1", apps) != nil || closeNoticeAudience("co", " ", apps) != nil {
		t.Fatal("blank company or job should notify nobody")
	}
}

func TestJobClosedNotice(t *testing.T) {
	if got := jobClosedNotice(" Northwind ", " Engineer ", ""); got != "Northwind closed Engineer. It is no longer accepting applications." {
		t.Fatalf("plain = %q", got)
	}
	if got := jobClosedNotice("Northwind", "Engineer", " role filled "); got != "Northwind closed Engineer: role filled. It is no longer accepting applications." {
		t.Fatalf("reason = %q", got)
	}
	if got := jobClosedNotice("", "  ", "filled"); got != "this role is closed: filled. It is no longer accepting applications." {
		t.Fatalf("fallback = %q", got)
	}
	if got := jobClosedNotice("", "Engineer", ""); got != "Engineer is closed and no longer accepting applications." {
		t.Fatalf("title only = %q", got)
	}
	clipped := jobClosedNotice(strings.Repeat("C", maxMessage), "Engineer", "filled")
	if len([]rune(clipped)) != maxMessage {
		t.Fatalf("len = %d", len([]rune(clipped)))
	}
}

func TestMessageUnreadCountsCloseNoticeForCandidateOnly(t *testing.T) {
	at := time.Date(2026, 9, 29, 12, 0, 0, 0, time.UTC)
	read := at.Add(-time.Minute)
	notice := Message{From: AuthorEvent, Notice: true, Text: "closed", CreatedAt: at}
	quiet := Message{From: AuthorEvent, Text: "scheduled", CreatedAt: at}
	reply := Message{From: AuthorCompany, AuthorID: "recruiter", Text: "hello", CreatedAt: at}
	own := Message{From: AuthorCandidate, AuthorID: "cand", Text: "thanks", CreatedAt: at}
	seen := Message{From: AuthorEvent, Notice: true, CreatedAt: read}

	if !messageUnread(notice, "cand", "", read) {
		t.Fatal("candidate should see a close notice as unread")
	}
	if messageUnread(notice, "recruiter", "co", read) {
		t.Fatal("hiring team should not badge a system notice")
	}
	if messageUnread(quiet, "cand", "", read) {
		t.Fatal("ordinary events stay quiet")
	}
	if !messageUnread(reply, "cand", "", read) {
		t.Fatal("company replies still count")
	}
	if messageUnread(reply, "recruiter", "co", read) {
		t.Fatal("author should not see their own reply as unread")
	}
	if messageUnread(own, "cand", "", read) || messageUnread(seen, "cand", "", read) {
		t.Fatal("own messages and already-read notices stay read")
	}
}
