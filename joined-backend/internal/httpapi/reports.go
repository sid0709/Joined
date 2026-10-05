package httpapi

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"
	"strings"
	"time"

	"github.com/sid0709/OpenSeat/backend-core/authapi"
	"github.com/sid0709/OpenSeat/backend-core/httpkit"
	"github.com/sid0709/OpenSeat/backend-core/scout"
	"github.com/sid0709/OpenSeat/backend-core/staff"
)

const jobReportSubject = "job"

// seekerJobReportReasons are the objective codes a job hunter may file.
// "not_a_good_fit" is absent on purpose, and staff-only codes stay off this route.
var seekerJobReportReasons = map[string]struct{}{
	"scam_job":            {},
	"fake_company":        {},
	"payment_request":     {},
	"other_with_evidence": {},
}

func (s *Server) postJobReport(w http.ResponseWriter, r *http.Request) {
	session, ok := authapi.Session(r.Context())
	if !ok {
		httpkit.WriteError(w, http.StatusUnauthorized, "sign in required")
		return
	}
	key := strings.TrimSpace(r.Header.Get(httpkit.IdempotencyHeader))
	if !scout.ValidIdempotencyKey(key) {
		httpkit.WriteProblem(w, httpkit.NewProblem(http.StatusBadRequest, "invalid_request", "Idempotency-Key must be 1 to 255 characters."))
		return
	}
	body, ok := httpkit.ReadBody(w, r, httpkit.MaxWriteBody)
	if !ok {
		return
	}
	var input staff.ReportFiling
	if err := json.Unmarshal(body, &input); err != nil {
		httpkit.WriteProblem(w, httpkit.NewProblem(http.StatusBadRequest, "invalid_request", "Body must be valid JSON."))
		return
	}
	if strings.TrimSpace(input.SubjectType) != jobReportSubject {
		httpkit.WriteProblem(w, httpkit.NewProblem(http.StatusUnprocessableEntity, "validation_failed", "Reports from this app are for jobs."))
		return
	}
	if _, allowed := seekerJobReportReasons[strings.TrimSpace(input.ReasonCode)]; !allowed {
		httpkit.WriteProblem(w, httpkit.NewProblem(http.StatusUnprocessableEntity, "validation_failed", "Use an objective job reason."))
		return
	}
	if err := input.Normalize(); err != nil {
		writeJobReportError(w, err)
		return
	}
	if s.staff == nil {
		httpkit.WriteProblem(w, httpkit.NewProblem(http.StatusServiceUnavailable, "internal_error", "Reports are unavailable."))
		return
	}
	sum := sha256.Sum256(body)
	result, replayed, err := s.staff.FileReport(r.Context(), session.User.ID, key, hex.EncodeToString(sum[:]), input, time.Now())
	if err != nil {
		writeJobReportError(w, err)
		return
	}
	if replayed {
		w.Header().Set("Idempotent-Replayed", "true")
	}
	httpkit.WriteJSON(w, http.StatusCreated, result)
}

func writeJobReportError(w http.ResponseWriter, err error) {
	var fields *staff.ValidationError
	switch {
	case errors.As(err, &fields):
		httpkit.WriteProblem(w, httpkit.NewProblem(http.StatusUnprocessableEntity, "validation_failed", "One or more fields are invalid."))
	case errors.Is(err, staff.ErrIdempotency):
		httpkit.WriteProblem(w, httpkit.NewProblem(http.StatusConflict, "idempotency_key_reused", "This report was already filed."))
	case errors.Is(err, staff.ErrIdempotencyInFlight):
		httpkit.WriteProblem(w, httpkit.NewProblem(http.StatusConflict, "idempotency_in_progress", "This report is already being filed."))
	default:
		slog.Error("job report", "error", err)
		httpkit.WriteProblem(w, httpkit.NewProblem(http.StatusInternalServerError, "internal_error", "Could not file the report."))
	}
}
