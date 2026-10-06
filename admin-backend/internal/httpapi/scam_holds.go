package httpapi

import (
	"errors"
	"log/slog"
	"net/http"
	"time"

	"github.com/sid0709/OpenSeat/backend-core/httpkit"
	"github.com/sid0709/OpenSeat/backend-core/jobscam"
	"github.com/sid0709/OpenSeat/backend-core/scout"
)

func (s *Server) registerScamHolds(mux *http.ServeMux) {
	mux.HandleFunc("GET /v1/admin/scam-jobs", s.adminScamJobs)
	mux.HandleFunc("POST /v1/admin/scam-jobs/{id}/review", s.adminReviewScamJob)
}

func (s *Server) adminScamJobs(w http.ResponseWriter, r *http.Request) {
	if !s.scamHoldsReady(w) {
		return
	}
	page, size := staffPageQuery(r)
	list, err := s.scamHolds.List(r.Context(), jobscam.ListQuery{
		Status:   r.URL.Query().Get("status"),
		Page:     page,
		PageSize: size,
	})
	if !writeScamHold(w, err) {
		return
	}
	httpkit.WriteJSON(w, http.StatusOK, list)
}

func (s *Server) adminReviewScamJob(w http.ResponseWriter, r *http.Request) {
	var input jobscam.Review
	if !httpkit.DecodeJSON(w, r, httpkit.MaxWriteBody, &input) {
		return
	}
	if err := input.Normalize(); !writeScamHold(w, err) {
		return
	}
	if !s.scamHoldsReady(w) {
		return
	}
	hold, err := s.scamHolds.Review(r.Context(), r.PathValue("id"), adminActor(r), input, time.Now())
	if !writeScamHold(w, err) {
		return
	}
	httpkit.WriteJSON(w, http.StatusOK, map[string]any{"job": hold})
}

func (s *Server) scamHoldsReady(w http.ResponseWriter) bool {
	if s.scamHolds == nil {
		httpkit.WriteProblem(w, httpkit.NewProblem(http.StatusServiceUnavailable, "internal_error", "Scam review is unavailable."))
		return false
	}
	return true
}

func writeScamHold(w http.ResponseWriter, err error) bool {
	if err == nil {
		return true
	}
	httpkit.WriteProblem(w, scamHoldProblem(err))
	return false
}

func scamHoldProblem(err error) httpkit.Problem {
	var fields *jobscam.ValidationError
	switch {
	case errors.As(err, &fields):
		p := httpkit.NewProblem(http.StatusUnprocessableEntity, "validation_failed", "One or more fields are invalid.")
		p.Errors = scamHoldFields(fields.Fields)
		return p
	case errors.Is(err, jobscam.ErrInvalidID):
		return httpkit.NewProblem(http.StatusBadRequest, "invalid_request", "Invalid job id.")
	case errors.Is(err, jobscam.ErrNotFound):
		return httpkit.NewProblem(http.StatusNotFound, "not_found", "Not found.")
	case errors.Is(err, jobscam.ErrConflict):
		return httpkit.NewProblem(http.StatusConflict, "conflict", err.Error())
	default:
		slog.Error("scam holds", "error", err)
		return httpkit.NewProblem(http.StatusInternalServerError, "internal_error", "Something went wrong. Try again.")
	}
}

func scamHoldFields(fields []jobscam.FieldError) []scout.FieldError {
	out := make([]scout.FieldError, len(fields))
	for i, field := range fields {
		out[i] = scout.FieldError{Field: field.Field, Detail: field.Detail}
	}
	return out
}
