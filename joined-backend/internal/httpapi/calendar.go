package httpapi

import (
	"net/http"
	"time"

	"github.com/sid0709/OpenSeat/backend-core/candidate"
	"github.com/sid0709/OpenSeat/backend-core/httpkit"
)

func (s *Server) getCalendar(w http.ResponseWriter, r *http.Request) {
	session, ok := s.requireCandidate(w, r)
	if !ok {
		return
	}
	status, err := s.people.CalendarStatus(r.Context(), session.User.ID)
	if !writeCandidate(w, err) {
		return
	}
	httpkit.WriteJSON(w, http.StatusOK, status)
}

// getCalendarEvents is the job hunter's own Google Calendar for the Interviews
// page: ?from=YYYY-MM-DD&to=YYYY-MM-DD&tz=<IANA zone>. Recruiters only see
// Joined's interviews, so this is for job hunters alone.
func (s *Server) getCalendarEvents(w http.ResponseWriter, r *http.Request) {
	session, ok := s.requireCandidate(w, r)
	if !ok {
		return
	}
	query := r.URL.Query()
	feed, err := s.people.GoogleEvents(r.Context(), session.User.ID, query.Get("from"), query.Get("to"), query.Get("tz"))
	if !writeCandidate(w, err) {
		return
	}
	httpkit.WriteJSON(w, http.StatusOK, feed)
}

func (s *Server) startGoogleCalendar(w http.ResponseWriter, r *http.Request) {
	session, ok := s.requireCandidate(w, r)
	if !ok {
		return
	}
	url, err := s.people.StartGoogle(r.Context(), session.User.ID, time.Now())
	if !writeCandidate(w, err) {
		return
	}
	httpkit.WriteJSON(w, http.StatusOK, map[string]string{"url": url})
}

func (s *Server) googleCalendarCallback(w http.ResponseWriter, r *http.Request) {
	code := r.URL.Query().Get("code")
	state := r.URL.Query().Get("state")
	if code == "" || state == "" {
		http.Redirect(w, r, candidate.SettingsRedirect(s.frontend, "error"), http.StatusFound)
		return
	}
	_, err := s.people.CompleteGoogle(r.Context(), state, code, time.Now())
	result := "connected"
	if err != nil {
		result = "error"
	}
	http.Redirect(w, r, candidate.SettingsRedirect(s.frontend, result), http.StatusFound)
}

func (s *Server) disconnectGoogleCalendar(w http.ResponseWriter, r *http.Request) {
	session, ok := s.requireCandidate(w, r)
	if !ok {
		return
	}
	err := s.people.DisconnectGoogle(r.Context(), session.User.ID)
	if !writeCandidate(w, err) {
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (s *Server) syncGoogleCalendar(w http.ResponseWriter, r *http.Request) {
	session, ok := s.requireCandidate(w, r)
	if !ok {
		return
	}
	created, err := s.people.SyncGoogle(r.Context(), session.User.ID, time.Now())
	if !writeCandidate(w, err) {
		return
	}
	httpkit.WriteJSON(w, http.StatusOK, map[string]any{"interviews": created})
}
