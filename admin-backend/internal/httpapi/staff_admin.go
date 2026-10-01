package httpapi

import (
	"errors"
	"log/slog"
	"net/http"
	"strconv"
	"time"

	"github.com/sid0709/OpenSeat/backend-core/httpkit"
	"github.com/sid0709/OpenSeat/backend-core/scout"
	"github.com/sid0709/OpenSeat/backend-core/staff"
)

func (s *Server) registerStaffAdmin(mux *http.ServeMux) {
	mux.HandleFunc("GET /v1/admin/cases", s.adminCases)
	mux.HandleFunc("POST /v1/admin/cases", s.adminOpenCase)
	mux.HandleFunc("POST /v1/admin/cases/{id}/decision", s.adminDecideCase)
	mux.HandleFunc("GET /v1/reports", s.adminReports)
	mux.HandleFunc("POST /v1/reports", s.adminFileReport)
	mux.HandleFunc("POST /v1/reports/{id}/appeal", s.adminAppealReport)
	mux.HandleFunc("GET /v1/admin/companies/verifications", s.adminVerifications)
	mux.HandleFunc("GET /v1/admin/companies/verifications/pending-count", s.adminVerificationCount)
	mux.HandleFunc("GET /v1/admin/companies/{id}", s.adminCompany)
	mux.HandleFunc("POST /v1/admin/companies/{id}/verify", s.adminVerifyCompany)
	mux.HandleFunc("GET /v1/admin/jobs", s.adminDirectJobs)
	mux.HandleFunc("POST /v1/admin/jobs/{id}/review", s.adminReviewJob)
	mux.HandleFunc("POST /v1/admin/jobs/{id}/takedown", s.adminTakedownJob)
}

func staffPageQuery(r *http.Request) (int64, int64) {
	query := r.URL.Query()
	page, _ := strconv.ParseInt(query.Get("page"), 10, 64)
	size, _ := strconv.ParseInt(query.Get("pageSize"), 10, 64)
	return page, size
}

func (s *Server) adminVerifications(w http.ResponseWriter, r *http.Request) {
	if !s.staffReady(w) {
		return
	}
	page, size := staffPageQuery(r)
	list, err := s.staff.ListVerifications(r.Context(), staff.VerificationQuery{
		Status:   r.URL.Query().Get("status"),
		Page:     page,
		PageSize: size,
	})
	if !writeStaff(w, err) {
		return
	}
	httpkit.WriteJSON(w, http.StatusOK, list)
}

func (s *Server) adminVerificationCount(w http.ResponseWriter, r *http.Request) {
	if !s.staffReady(w) {
		return
	}
	count, err := s.staff.PendingVerifications(r.Context())
	if !writeStaff(w, err) {
		return
	}
	httpkit.WriteJSON(w, http.StatusOK, count)
}

func (s *Server) adminCompany(w http.ResponseWriter, r *http.Request) {
	if !s.staffReady(w) {
		return
	}
	detail, err := s.staff.Company(r.Context(), r.PathValue("id"))
	if !writeStaff(w, err) {
		return
	}
	httpkit.WriteJSON(w, http.StatusOK, detail)
}

func (s *Server) adminVerifyCompany(w http.ResponseWriter, r *http.Request) {
	var input staff.CompanyVerify
	if !httpkit.DecodeJSON(w, r, httpkit.MaxWriteBody, &input) {
		return
	}
	if err := input.Normalize(); !writeStaff(w, err) {
		return
	}
	if !s.staffReady(w) {
		return
	}
	result, err := s.staff.VerifyCompany(r.Context(), r.PathValue("id"), adminActor(r), input, time.Now())
	if !writeStaff(w, err) {
		return
	}
	httpkit.WriteJSON(w, http.StatusOK, result)
}

func (s *Server) adminDirectJobs(w http.ResponseWriter, r *http.Request) {
	if !s.staffReady(w) {
		return
	}
	page, size := staffPageQuery(r)
	query := r.URL.Query()
	list, err := s.staff.ListDirectJobs(r.Context(), staff.JobQuery{
		Source:   query.Get("source"),
		Status:   query.Get("status"),
		Page:     page,
		PageSize: size,
	})
	if !writeStaff(w, err) {
		return
	}
	httpkit.WriteJSON(w, http.StatusOK, list)
}

func (s *Server) adminReviewJob(w http.ResponseWriter, r *http.Request) {
	var input staff.JobReview
	if !httpkit.DecodeJSON(w, r, httpkit.MaxWriteBody, &input) {
		return
	}
	if err := input.Normalize(); !writeStaff(w, err) {
		return
	}
	if !s.staffReady(w) {
		return
	}
	result, err := s.staff.ReviewDirectJob(r.Context(), r.PathValue("id"), adminActor(r), input, time.Now())
	if !writeStaff(w, err) {
		return
	}
	httpkit.WriteJSON(w, http.StatusOK, result)
}

func (s *Server) adminTakedownJob(w http.ResponseWriter, r *http.Request) {
	var input staff.Takedown
	if !httpkit.DecodeJSON(w, r, httpkit.MaxWriteBody, &input) {
		return
	}
	if _, err := staff.NormalizeReason(input.Reason, true); !writeStaff(w, err) {
		return
	}
	if !s.staffReady(w) {
		return
	}
	result, err := s.staff.TakedownDirectJob(r.Context(), r.PathValue("id"), adminActor(r), input.Reason, time.Now())
	if !writeStaff(w, err) {
		return
	}
	httpkit.WriteJSON(w, http.StatusOK, result)
}

func (s *Server) staffReady(w http.ResponseWriter) bool {
	if s.staff == nil {
		httpkit.WriteProblem(w, httpkit.NewProblem(http.StatusServiceUnavailable, "internal_error", "Staff review is unavailable."))
		return false
	}
	return true
}

func writeStaff(w http.ResponseWriter, err error) bool {
	if err == nil {
		return true
	}
	httpkit.WriteProblem(w, staffProblem(err))
	return false
}

func staffProblem(err error) httpkit.Problem {
	var fields *staff.ValidationError
	switch {
	case errors.As(err, &fields):
		p := httpkit.NewProblem(http.StatusUnprocessableEntity, "validation_failed", "One or more fields are invalid.")
		p.Errors = scoutFields(fields.Fields)
		return p
	case errors.Is(err, staff.ErrIdempotency):
		return httpkit.NewProblem(http.StatusConflict, "idempotency_key_reused", err.Error())
	case errors.Is(err, staff.ErrIdempotencyInFlight):
		return httpkit.NewProblem(http.StatusConflict, "idempotency_in_progress", err.Error())
	case errors.Is(err, staff.ErrNotFound):
		return httpkit.NewProblem(http.StatusNotFound, "not_found", "Not found.")
	case errors.Is(err, staff.ErrConflict):
		return httpkit.NewProblem(http.StatusConflict, "conflict", err.Error())
	default:
		slog.Error("staff", "error", err)
		return httpkit.NewProblem(http.StatusInternalServerError, "internal_error", "Something went wrong. Try again.")
	}
}

func scoutFields(fields []staff.FieldError) []scout.FieldError {
	out := make([]scout.FieldError, len(fields))
	for i, field := range fields {
		out[i] = scout.FieldError{Field: field.Field, Detail: field.Detail}
	}
	return out
}
