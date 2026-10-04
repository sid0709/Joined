package httpapi

import (
	"net/http"
	"time"

	"github.com/sid0709/OpenSeat/backend-core/auth"
	"github.com/sid0709/OpenSeat/backend-core/employer"
	"github.com/sid0709/OpenSeat/backend-core/httpkit"
)

func (s *Server) getMyThreads(w http.ResponseWriter, r *http.Request) {
	session, ok := s.requireCandidate(w, r)
	if !ok {
		return
	}
	threads, err := s.people.ListThreads(r.Context(), session.User.ID, "", time.Now())
	if !writeCandidate(w, err) {
		return
	}
	httpkit.WriteJSON(w, http.StatusOK, map[string]any{"threads": threads})
}

func (s *Server) getMyThread(w http.ResponseWriter, r *http.Request) {
	session, ok := s.requireCandidate(w, r)
	if !ok {
		return
	}
	thread, err := s.people.GetThread(r.Context(), session.User.ID, "", r.PathValue("id"), time.Now())
	if !writeCandidate(w, err) {
		return
	}
	httpkit.WriteJSON(w, http.StatusOK, thread)
}

func (s *Server) postMyMessage(w http.ResponseWriter, r *http.Request) {
	session, ok := s.requireCandidate(w, r)
	if !ok {
		return
	}
	var body struct {
		Body string `json:"body"`
	}
	if !decodeBody(w, r, &body) {
		return
	}
	msg, err := s.people.PostMessage(r.Context(), session.User.ID, "", r.PathValue("id"), body.Body, time.Now())
	if !writeCandidate(w, err) {
		return
	}
	httpkit.WriteJSON(w, http.StatusOK, msg)
}

func (s *Server) getCompanyThreads(w http.ResponseWriter, r *http.Request) {
	session, allow, ok := s.openCompanyThreads(w, r)
	if !ok {
		return
	}
	threads, err := s.people.ListThreads(r.Context(), session.User.ID, session.Company.ID, time.Now())
	if !writeCandidate(w, err) {
		return
	}
	visible, _ := visibleCompanyThreads(threads, allow)
	httpkit.WriteJSON(w, http.StatusOK, map[string]any{"threads": visible})
}

func (s *Server) getCompanyThread(w http.ResponseWriter, r *http.Request) {
	session, allow, ok := s.openCompanyThreads(w, r)
	if !ok {
		return
	}
	if !s.allowCompanyThread(w, r, allow, session.Company.ID, r.PathValue("id")) {
		return
	}
	thread, err := s.people.GetThread(r.Context(), session.User.ID, session.Company.ID, r.PathValue("id"), time.Now())
	if !writeCandidate(w, err) {
		return
	}
	httpkit.WriteJSON(w, http.StatusOK, thread)
}

func (s *Server) postCompanyMessage(w http.ResponseWriter, r *http.Request) {
	session, allow, ok := s.openCompanyThreads(w, r)
	if !ok {
		return
	}
	if !s.allowCompanyThread(w, r, allow, session.Company.ID, r.PathValue("id")) {
		return
	}
	var body struct {
		Body string `json:"body"`
	}
	if !decodeBody(w, r, &body) {
		return
	}
	msg, err := s.people.PostMessage(r.Context(), session.User.ID, session.Company.ID, r.PathValue("id"), body.Body, time.Now())
	if !writeCandidate(w, err) {
		return
	}
	httpkit.WriteJSON(w, http.StatusOK, msg)
}

func (s *Server) getMyUnread(w http.ResponseWriter, r *http.Request) {
	session, ok := s.requireCandidate(w, r)
	if !ok {
		return
	}
	count, err := s.people.UnreadCount(r.Context(), session.User.ID, "", time.Now())
	if !writeCandidate(w, err) {
		return
	}
	httpkit.WriteJSON(w, http.StatusOK, map[string]int{"unread": count})
}

func (s *Server) getCompanyUnread(w http.ResponseWriter, r *http.Request) {
	session, allow, ok := s.openCompanyThreads(w, r)
	if !ok {
		return
	}
	threads, err := s.people.ListThreads(r.Context(), session.User.ID, session.Company.ID, time.Now())
	if !writeCandidate(w, err) {
		return
	}
	_, count := visibleCompanyThreads(threads, allow)
	httpkit.WriteJSON(w, http.StatusOK, map[string]int{"unread": count})
}

func (s *Server) openCompanyThreads(w http.ResponseWriter, r *http.Request) (auth.Session, func(string) bool, bool) {
	session, actor, ok := s.hiringActor(w, r)
	if !ok {
		return auth.Session{}, nil, false
	}
	idx, err := s.hiring.Access(r.Context(), session.Company.ID)
	if !writeEmployer(w, err) {
		return auth.Session{}, nil, false
	}
	return session, allowApplicantThread(idx, actor.ID, actor.Role), true
}

func (s *Server) allowCompanyThread(w http.ResponseWriter, r *http.Request, allow func(string) bool, companyID, threadID string) bool {
	jobID, err := s.people.CompanyThreadJob(r.Context(), companyID, threadID)
	if !writeCandidate(w, err) {
		return false
	}
	if !allow(jobID) {
		writeEmployer(w, employer.Forbidden("Missing permission: "+employer.PermApplicantsView))
		return false
	}
	return true
}
