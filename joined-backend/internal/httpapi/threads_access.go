package httpapi

import (
	"github.com/sid0709/OpenSeat/backend-core/candidate"
	"github.com/sid0709/OpenSeat/backend-core/employer"
)

// visibleCompanyThreads keeps threads whose job the caller may view as applicants.
// A thread with no job stays hidden. The unread total counts only the threads kept.
func visibleCompanyThreads(threads []candidate.Thread, allow func(jobID string) bool) ([]candidate.Thread, int) {
	visible := make([]candidate.Thread, 0, len(threads))
	unread := 0
	for _, thread := range threads {
		if !allow(thread.JobID) {
			continue
		}
		visible = append(visible, thread)
		unread += thread.Unread
	}
	return visible, unread
}

func allowApplicantThread(idx employer.AccessIndex, userID, role string) func(string) bool {
	return func(jobID string) bool {
		if jobID == "" {
			return false
		}
		return idx.Allows(userID, role, jobID, employer.PermApplicantsView)
	}
}
