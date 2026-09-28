package httpapi

import (
	"encoding/json"
	"errors"
	"io"
	"log/slog"
	"net/http"
	"time"

	"github.com/sid0709/OpenSeat/opened-backend/internal/auth"
	"github.com/sid0709/OpenSeat/opened-backend/internal/candidate"
)

func (s *Server) requireSession(w http.ResponseWriter, r *http.Request) (auth.Session, bool) {
	session, err := s.auth.Session(r.Context(), bearerToken(r), time.Now())
	if errors.Is(err, auth.ErrInvalidLogin) {
		writeError(w, http.StatusUnauthorized, "sign in required")
		return auth.Session{}, false
	}
	if err != nil {
		slog.Error("session", "error", err)
		writeError(w, http.StatusInternalServerError, "could not load the session")
		return auth.Session{}, false
	}
	return session, true
}

func (s *Server) requireCompany(w http.ResponseWriter, r *http.Request) (auth.Session, bool) {
	session, ok := s.requireSession(w, r)
	if !ok {
		return auth.Session{}, false
	}
	if session.Company == nil {
		writeError(w, http.StatusForbidden, "company account required")
		return auth.Session{}, false
	}
	return session, true
}

func decodeBody(w http.ResponseWriter, r *http.Request, dest any) bool {
	decoder := json.NewDecoder(http.MaxBytesReader(w, r.Body, maxWriteBody))
	if err := decoder.Decode(dest); err != nil && !errors.Is(err, io.EOF) {
		writeError(w, http.StatusBadRequest, "invalid request")
		return false
	}
	return true
}

func writeCandidate(w http.ResponseWriter, err error) bool {
	switch {
	case err == nil:
		return true
	case errors.Is(err, candidate.ErrNotFound):
		writeError(w, http.StatusNotFound, err.Error())
	case errors.Is(err, candidate.ErrInvalidInput), errors.Is(err, candidate.ErrNeedsApplication):
		writeError(w, http.StatusBadRequest, err.Error())
	case errors.Is(err, candidate.ErrAlreadyApplied), errors.Is(err, candidate.ErrDuplicate):
		writeError(w, http.StatusConflict, err.Error())
	case errors.Is(err, candidate.ErrForbidden):
		writeError(w, http.StatusForbidden, err.Error())
	case errors.Is(err, candidate.ErrNotConfigured):
		writeError(w, http.StatusServiceUnavailable, err.Error())
	case errors.Is(err, auth.ErrNotFound), errors.Is(err, auth.ErrInvalidInput):
		writeError(w, http.StatusBadRequest, err.Error())
	default:
		slog.Error("candidate", "error", err)
		writeError(w, http.StatusInternalServerError, "could not complete the request")
	}
	return false
}
