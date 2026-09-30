package httpapi

import (
	"errors"
	"log/slog"
	"net/http"
	"time"

	"github.com/sid0709/OpenSeat/opened-backend/internal/candidate"
)

func (s *Server) getPublicSchedule(w http.ResponseWriter, r *http.Request) {
	view, err := s.people.PublicSchedule(r.Context(), r.PathValue("key"), time.Now())
	if !writePublicSchedule(w, err) {
		return
	}
	writeJSON(w, http.StatusOK, view)
}

func (s *Server) acceptPublicSchedule(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Date  string `json:"date"`
		Start string `json:"start"`
		End   string `json:"end"`
	}
	if !decodeBody(w, r, &body) {
		return
	}
	view, err := s.people.AcceptPublicSchedule(r.Context(), r.PathValue("key"), body.Date, body.Start, body.End, time.Now())
	if !writePublicSchedule(w, err) {
		return
	}
	writeJSON(w, http.StatusOK, view)
}

func writePublicSchedule(w http.ResponseWriter, err error) bool {
	switch {
	case err == nil:
		return true
	case errors.Is(err, candidate.ErrNotFound):
		writeError(w, http.StatusNotFound, "not found")
	case errors.Is(err, candidate.ErrSlotNotOffered), errors.Is(err, candidate.ErrInvalidInput):
		writeError(w, http.StatusBadRequest, err.Error())
	case errors.Is(err, candidate.ErrScheduleExpired):
		writeError(w, http.StatusGone, err.Error())
	case errors.Is(err, candidate.ErrScheduleTaken):
		writeError(w, http.StatusConflict, err.Error())
	default:
		slog.Error("public schedule", "error", err)
		writeError(w, http.StatusInternalServerError, "could not complete the request")
	}
	return false
}
