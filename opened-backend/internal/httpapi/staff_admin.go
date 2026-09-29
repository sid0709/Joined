package httpapi

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"strconv"
	"time"

	"github.com/sid0709/OpenSeat/opened-backend/internal/auth"
	"github.com/sid0709/OpenSeat/opened-backend/internal/scout"
	"github.com/sid0709/OpenSeat/opened-backend/internal/staff"
)

func (s *Server) registerStaffAdmin(mux *http.ServeMux) {
	mux.HandleFunc("GET /v1/admin/cases", s.admin(s.adminCases))
	mux.HandleFunc("POST /v1/admin/cases", s.admin(s.adminOpenCase))
	mux.HandleFunc("POST /v1/admin/cases/{id}/decision", s.admin(s.adminDecideCase))
	mux.HandleFunc("GET /v1/reports", s.admin(s.adminReports))
	mux.HandleFunc("POST /v1/reports", s.admin(s.adminFileReport))
	mux.HandleFunc("POST /v1/reports/{id}/appeal", s.admin(s.adminAppealReport))
	mux.HandleFunc("GET /v1/admin/companies/verifications", s.admin(s.adminVerifications))
	mux.HandleFunc("GET /v1/admin/companies/verifications/pending-count", s.admin(s.adminVerificationCount))
	mux.HandleFunc("GET /v1/admin/companies/{id}", s.admin(s.adminCompany))
	mux.HandleFunc("POST /v1/admin/companies/{id}/verify", s.admin(s.adminVerifyCompany))
	mux.HandleFunc("GET /v1/admin/jobs", s.admin(s.adminDirectJobs))
	mux.HandleFunc("POST /v1/admin/jobs/{id}/review", s.admin(s.adminReviewJob))
	mux.HandleFunc("POST /v1/admin/jobs/{id}/takedown", s.admin(s.adminTakedownJob))
}

func (s *Server) noteNewCompany(ctx context.Context, session auth.Session) {
	if s.staff == nil || session.Company == nil || !session.Company.IsCreator {
		return
	}
	if err := s.staff.NoteCompanyCreated(ctx, session.Company.ID, session.User.ID, session.Company.URL, time.Now()); err != nil {
		slog.Error("company verification", "company", session.Company.ID, "error", err)
	}
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
	writeJSON(w, http.StatusOK, list)
}

func (s *Server) adminVerificationCount(w http.ResponseWriter, r *http.Request) {
	if !s.staffReady(w) {
		return
	}
	count, err := s.staff.PendingVerifications(r.Context())
	if !writeStaff(w, err) {
		return
	}
	writeJSON(w, http.StatusOK, count)
}

func (s *Server) adminCompany(w http.ResponseWriter, r *http.Request) {
	if !s.staffReady(w) {
		return
	}
	detail, err := s.staff.Company(r.Context(), r.PathValue("id"))
	if !writeStaff(w, err) {
		return
	}
	writeJSON(w, http.StatusOK, detail)
}

func (s *Server) adminVerifyCompany(w http.ResponseWriter, r *http.Request) {
	var input staff.CompanyVerify
	if !decodeScout(w, r, maxWriteBody, &input) {
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
	writeJSON(w, http.StatusOK, result)
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
	writeJSON(w, http.StatusOK, list)
}

func (s *Server) adminReviewJob(w http.ResponseWriter, r *http.Request) {
	var input staff.JobReview
	if !decodeScout(w, r, maxWriteBody, &input) {
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
	writeJSON(w, http.StatusOK, result)
}

func (s *Server) adminTakedownJob(w http.ResponseWriter, r *http.Request) {
	var input staff.Takedown
	if !decodeScout(w, r, maxWriteBody, &input) {
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
	writeJSON(w, http.StatusOK, result)
}

func (s *Server) staffReady(w http.ResponseWriter) bool {
	if s.staff == nil {
		writeProblem(w, newProblem(http.StatusServiceUnavailable, "internal_error", "Staff review is unavailable."))
		return false
	}
	return true
}

func writeStaff(w http.ResponseWriter, err error) bool {
	if err == nil {
		return true
	}
	writeProblem(w, staffProblem(err))
	return false
}

func staffProblem(err error) problem {
	var fields *staff.ValidationError
	switch {
	case errors.As(err, &fields):
		p := newProblem(http.StatusUnprocessableEntity, "validation_failed", "One or more fields are invalid.")
		p.Errors = scoutFields(fields.Fields)
		return p
	case errors.Is(err, staff.ErrIdempotency):
		return newProblem(http.StatusConflict, "idempotency_key_reused", err.Error())
	case errors.Is(err, staff.ErrIdempotencyInFlight):
		return newProblem(http.StatusConflict, "idempotency_in_progress", err.Error())
	case errors.Is(err, staff.ErrNotFound):
		return newProblem(http.StatusNotFound, "not_found", "Not found.")
	case errors.Is(err, staff.ErrConflict):
		return newProblem(http.StatusConflict, "conflict", err.Error())
	default:
		slog.Error("staff", "error", err)
		return newProblem(http.StatusInternalServerError, "internal_error", "Something went wrong. Try again.")
	}
}

func scoutFields(fields []staff.FieldError) []scout.FieldError {
	out := make([]scout.FieldError, len(fields))
	for i, field := range fields {
		out[i] = scout.FieldError{Field: field.Field, Detail: field.Detail}
	}
	return out
}
