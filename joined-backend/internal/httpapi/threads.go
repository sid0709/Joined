package httpapi

import (
	"net/http"
	"time"

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
	session, ok := s.requireCompany(w, r)
	if !ok {
		return
	}
	threads, err := s.people.ListThreads(r.Context(), session.User.ID, session.Company.ID, time.Now())
	if !writeCandidate(w, err) {
		return
	}
	httpkit.WriteJSON(w, http.StatusOK, map[string]any{"threads": threads})
}

func (s *Server) getCompanyThread(w http.ResponseWriter, r *http.Request) {
	session, ok := s.requireCompany(w, r)
	if !ok {
		return
	}
	thread, err := s.people.GetThread(r.Context(), session.User.ID, session.Company.ID, r.PathValue("id"), time.Now())
	if !writeCandidate(w, err) {
		return
	}
	httpkit.WriteJSON(w, http.StatusOK, thread)
}

func (s *Server) postCompanyMessage(w http.ResponseWriter, r *http.Request) {
	session, ok := s.requireCompany(w, r)
	if !ok {
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
	session, ok := s.requireCompany(w, r)
	if !ok {
		return
	}
	count, err := s.people.UnreadCount(r.Context(), session.User.ID, session.Company.ID, time.Now())
	if !writeCandidate(w, err) {
		return
	}
	httpkit.WriteJSON(w, http.StatusOK, map[string]int{"unread": count})
}
