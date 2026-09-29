package httpapi

import (
	"net/http"
	"time"

	"github.com/sid0709/OpenSeat/opened-backend/internal/employer"
)

func (s *Server) getCompanyAnalytics(w http.ResponseWriter, r *http.Request) {
	session, actor, ok := s.hiringActor(w, r)
	if !ok {
		return
	}
	idx, err := s.hiring.Access(r.Context(), session.Company.ID)
	if !writeEmployer(w, err) {
		return
	}
	if !employer.AnalyticsAllowed(actor.ID, actor.Role, idx, r.URL.Query().Get("jobId")) {
		writeEmployer(w, employer.Forbidden("Missing permission: "+employer.PermAnalyticsView))
		return
	}
	jobs, err := s.hiring.ListJobs(r.Context(), session.Company.ID)
	if !writeEmployer(w, err) {
		return
	}
	applicants, err := s.hiring.Applicants(r.Context(), session.Company.ID)
	if !writeEmployer(w, err) {
		return
	}
	interviews, err := s.hiring.Interviews(r.Context(), session.Company.ID)
	if !writeEmployer(w, err) {
		return
	}
	snapshot, err := employer.AggregateAnalytics(actor.ID, actor.Role, idx, jobs, applicants, interviews, r.URL.Query(), time.Now(), employer.AnalyticsLocation(employer.DefaultHiringTimeZone))
	if !writeEmployer(w, err) {
		return
	}
	writeJSON(w, http.StatusOK, snapshot)
}
