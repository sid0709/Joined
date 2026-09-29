package httpapi

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"time"

	"github.com/sid0709/OpenSeat/opened-backend/internal/auth"
	"github.com/sid0709/OpenSeat/opened-backend/internal/scout"
	"github.com/sid0709/OpenSeat/opened-backend/internal/staff"
)

func (s *Server) registerStaffAdmin(mux *http.ServeMux) {
	mux.HandleFunc("GET /v1/admin/companies", s.admin(s.adminCompanies))
	mux.HandleFunc("GET /v1/admin/companies/{id}", s.admin(s.adminCompany))
	mux.HandleFunc("POST /v1/admin/companies/{id}/decision", s.admin(s.adminCompanyDecision))
	mux.HandleFunc("GET /v1/admin/cases", s.admin(s.adminCases))
	mux.HandleFunc("POST /v1/admin/cases", s.admin(s.adminOpenCase))
	mux.HandleFunc("GET /v1/admin/cases/{id}", s.admin(s.adminCase))
	mux.HandleFunc("POST /v1/admin/cases/{id}/decision", s.admin(s.adminCaseDecision))
	mux.HandleFunc("GET /v1/admin/jobs", s.admin(s.adminDirectJobs))
	mux.HandleFunc("GET /v1/admin/jobs/{id}", s.admin(s.adminDirectJob))
	mux.HandleFunc("POST /v1/admin/jobs/{id}/review", s.admin(s.adminReviewJob))
	mux.HandleFunc("POST /v1/admin/jobs/{id}/takedown", s.admin(s.adminTakedownJob))
	mux.HandleFunc("POST /v1/admin/jobs/{id}/restore", s.admin(s.adminRestoreJob))
}

func (s *Server) noteNewCompany(ctx context.Context, session auth.Session) {
	if s.staff == nil || session.Company == nil || !session.Company.IsCreator {
		return
	}
	if err := s.staff.NoteCompanyCreated(ctx, session.Company.ID, session.User.ID, session.Company.URL, time.Now()); err != nil {
		slog.Error("company verification case", "company", session.Company.ID, "error", err)
	}
}

func (s *Server) adminCompanies(w http.ResponseWriter, r *http.Request) {
	if !s.staffReady(w) {
		return
	}
	page, size := pageQuery(r)
	query := r.URL.Query()
	list, err := s.staff.ListCompanies(r.Context(), staff.CompanyQuery{
		Status:   query.Get("status"),
		Q:        query.Get("q"),
		Page:     page,
		PageSize: size,
	})
	if !writeStaff(w, err) {
		return
	}
	writeJSON(w, http.StatusOK, list)
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

func (s *Server) adminCompanyDecision(w http.ResponseWriter, r *http.Request) {
	var input staff.CompanyDecision
	if !decodeScout(w, r, maxWriteBody, &input) {
		return
	}
	if err := input.Normalize(); !writeStaff(w, err) {
		return
	}
	if !s.staffReady(w) {
		return
	}
	detail, err := s.staff.DecideCompany(r.Context(), r.PathValue("id"), adminActor(r), input, time.Now())
	if !writeStaff(w, err) {
		return
	}
	writeJSON(w, http.StatusOK, detail)
}

func (s *Server) adminCases(w http.ResponseWriter, r *http.Request) {
	if !s.staffReady(w) {
		return
	}
	page, size := pageQuery(r)
	query := r.URL.Query()
	list, err := s.staff.ListCases(r.Context(), staff.CaseQuery{
		Queue:    query.Get("queue"),
		Status:   query.Get("status"),
		Page:     page,
		PageSize: size,
	})
	if !writeStaff(w, err) {
		return
	}
	writeJSON(w, http.StatusOK, list)
}

func (s *Server) adminOpenCase(w http.ResponseWriter, r *http.Request) {
	var input staff.OpenCase
	if !decodeScout(w, r, maxWriteBody, &input) {
		return
	}
	if !s.staffReady(w) {
		return
	}
	item, created, err := s.staff.OpenCase(r.Context(), adminActor(r), input, time.Now())
	if !writeStaff(w, err) {
		return
	}
	status := http.StatusOK
	if created {
		status = http.StatusCreated
	}
	writeJSON(w, status, item)
}

func (s *Server) adminCase(w http.ResponseWriter, r *http.Request) {
	if !s.staffReady(w) {
		return
	}
	item, err := s.staff.Case(r.Context(), r.PathValue("id"))
	if !writeStaff(w, err) {
		return
	}
	writeJSON(w, http.StatusOK, item)
}

func (s *Server) adminCaseDecision(w http.ResponseWriter, r *http.Request) {
	var input staff.CompanyDecision
	if !decodeScout(w, r, maxWriteBody, &input) {
		return
	}
	if err := input.Normalize(); !writeStaff(w, err) {
		return
	}
	if !s.staffReady(w) {
		return
	}
	item, err := s.staff.DecideCase(r.Context(), r.PathValue("id"), adminActor(r), input, time.Now())
	if !writeStaff(w, err) {
		return
	}
	writeJSON(w, http.StatusOK, item)
}

func (s *Server) adminDirectJobs(w http.ResponseWriter, r *http.Request) {
	if !s.staffReady(w) {
		return
	}
	page, size := pageQuery(r)
	query := r.URL.Query()
	list, err := s.staff.ListDirectJobs(r.Context(), staff.JobQuery{
		Source:   query.Get("source"),
		Status:   query.Get("status"),
		Q:        query.Get("q"),
		Page:     page,
		PageSize: size,
	})
	if !writeStaff(w, err) {
		return
	}
	writeJSON(w, http.StatusOK, list)
}

func (s *Server) adminDirectJob(w http.ResponseWriter, r *http.Request) {
	if !s.staffReady(w) {
		return
	}
	job, err := s.staff.DirectJob(r.Context(), r.PathValue("id"))
	if !writeStaff(w, err) {
		return
	}
	writeJSON(w, http.StatusOK, job)
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
	job, err := s.staff.ReviewDirectJob(r.Context(), r.PathValue("id"), adminActor(r), input, time.Now())
	if !writeStaff(w, err) {
		return
	}
	writeJSON(w, http.StatusOK, job)
}

func (s *Server) adminTakedownJob(w http.ResponseWriter, r *http.Request) {
	var input staff.Note
	if !decodeScout(w, r, maxWriteBody, &input) {
		return
	}
	reason, err := staff.NormalizeReason(input.Reason, true)
	if !writeStaff(w, err) {
		return
	}
	if !s.staffReady(w) {
		return
	}
	job, err := s.staff.TakedownDirectJob(r.Context(), r.PathValue("id"), adminActor(r), reason, time.Now())
	if !writeStaff(w, err) {
		return
	}
	writeJSON(w, http.StatusOK, job)
}

func (s *Server) adminRestoreJob(w http.ResponseWriter, r *http.Request) {
	var input staff.Note
	if !decodeScout(w, r, maxWriteBody, &input) {
		return
	}
	reason, err := staff.NormalizeReason(input.Reason, false)
	if !writeStaff(w, err) {
		return
	}
	if !s.staffReady(w) {
		return
	}
	job, err := s.staff.RestoreDirectJob(r.Context(), r.PathValue("id"), adminActor(r), reason, time.Now())
	if !writeStaff(w, err) {
		return
	}
	writeJSON(w, http.StatusOK, job)
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
