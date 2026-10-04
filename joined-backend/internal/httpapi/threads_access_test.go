package httpapi

import (
	"testing"

	"github.com/sid0709/OpenSeat/backend-core/candidate"
	"github.com/sid0709/OpenSeat/backend-core/employer"
)

func TestVisibleCompanyThreadsHidesBlockedAndEmptyJobs(t *testing.T) {
	threads := []candidate.Thread{
		{ID: "open", JobID: "job-1", Unread: 2},
		{ID: "blocked", JobID: "job-2", Unread: 5},
		{ID: "blank", JobID: "", Unread: 9},
	}
	visible, unread := visibleCompanyThreads(threads, func(jobID string) bool {
		return jobID == "job-1"
	})
	if len(visible) != 1 || visible[0].ID != "open" || unread != 2 {
		t.Fatalf("visible = %+v unread %d", visible, unread)
	}
}

func TestVisibleCompanyThreadsCountsOnlyVisibleUnread(t *testing.T) {
	threads := []candidate.Thread{
		{ID: "a", JobID: "job-1", Unread: 1},
		{ID: "b", JobID: "job-1", Unread: 0},
		{ID: "c", JobID: "job-2", Unread: 4},
	}
	visible, unread := visibleCompanyThreads(threads, func(jobID string) bool {
		return jobID == "job-1"
	})
	if len(visible) != 2 || unread != 1 {
		t.Fatalf("visible = %d unread %d", len(visible), unread)
	}
}

func TestAllowApplicantThreadUsesJobAccess(t *testing.T) {
	idx := employer.NewAccessIndex(map[string][]employer.JobAccessAssignment{
		"job-blocked": {{
			MemberID:    "user-1",
			Permissions: []string{employer.PermJobsView},
		}},
	})
	allow := allowApplicantThread(idx, "user-1", employer.RoleInterviewer)
	if !allow("job-open") {
		t.Fatal("an interviewer should see a job with no override")
	}
	if allow("job-blocked") {
		t.Fatal("a tighter override should hide the thread")
	}
	if allow("") {
		t.Fatal("a thread with no job should stay hidden")
	}
	finance := allowApplicantThread(employer.NewAccessIndex(nil), "user-1", employer.RoleFinance)
	if finance("job-open") {
		t.Fatal("finance should not see applicant threads")
	}
}
