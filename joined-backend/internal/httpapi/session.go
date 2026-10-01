package httpapi

import (
	"encoding/json"
	"errors"
	"io"
	"log/slog"
	"net/http"
	"time"

	"github.com/sid0709/OpenSeat/backend-core/auth"
	"github.com/sid0709/OpenSeat/backend-core/candidate"
	"github.com/sid0709/OpenSeat/backend-core/httpkit"
)

func (s *Server) requireSession(w http.ResponseWriter, r *http.Request) (auth.Session, bool) {
	session, err := s.auth.Session(r.Context(), httpkit.BearerToken(r), time.Now())
	if errors.Is(err, auth.ErrInvalidLogin) {
		httpkit.WriteError(w, http.StatusUnauthorized, "sign in required")
		return auth.Session{}, false
	}
	if err != nil {
		slog.Error("session", "error", err)
		httpkit.WriteError(w, http.StatusInternalServerError, "could not load the session")
		return auth.Session{}, false
	}
	return session, true
}

func (s *Server) requireCandidate(w http.ResponseWriter, r *http.Request) (auth.Session, bool) {
	session, ok := s.requireSession(w, r)
	if !ok {
		return auth.Session{}, false
	}
	if session.User.Role != auth.RoleCandidate {
		httpkit.WriteError(w, http.StatusForbidden, "job hunter account required")
		return auth.Session{}, false
	}
	return session, true
}

func (s *Server) requireCompany(w http.ResponseWriter, r *http.Request) (auth.Session, bool) {
	session, ok := s.requireSession(w, r)
	if !ok {
		return auth.Session{}, false
	}
	if session.User.Role != auth.RoleEmployee || session.Company == nil {
		httpkit.WriteError(w, http.StatusForbidden, "recruiter account required")
		return auth.Session{}, false
	}
	return session, true
}

func decodeBody(w http.ResponseWriter, r *http.Request, dest any) bool {
	decoder := json.NewDecoder(http.MaxBytesReader(w, r.Body, httpkit.MaxWriteBody))
	if err := decoder.Decode(dest); err != nil && !errors.Is(err, io.EOF) {
		httpkit.WriteError(w, http.StatusBadRequest, "invalid request")
		return false
	}
	return true
}

func writeCandidate(w http.ResponseWriter, err error) bool {
	switch {
	case err == nil:
		return true
	case errors.Is(err, candidate.ErrNotFound):
		httpkit.WriteError(w, http.StatusNotFound, err.Error())
	case errors.Is(err, candidate.ErrInvalidInput), errors.Is(err, candidate.ErrNeedsApplication):
		httpkit.WriteError(w, http.StatusBadRequest, err.Error())
	case errors.Is(err, candidate.ErrAlreadyApplied), errors.Is(err, candidate.ErrDuplicate):
		httpkit.WriteError(w, http.StatusConflict, err.Error())
	case errors.Is(err, candidate.ErrForbidden):
		httpkit.WriteError(w, http.StatusForbidden, err.Error())
	case errors.Is(err, candidate.ErrNotConfigured):
		httpkit.WriteError(w, http.StatusServiceUnavailable, err.Error())
	case errors.Is(err, auth.ErrNotFound), errors.Is(err, auth.ErrInvalidInput):
		httpkit.WriteError(w, http.StatusBadRequest, err.Error())
	default:
		slog.Error("candidate", "error", err)
		httpkit.WriteError(w, http.StatusInternalServerError, "could not complete the request")
	}
	return false
}
