package httpapi

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"net/http"
	"strings"
	"time"

	"github.com/sid0709/OpenSeat/opened-backend/internal/scout"
	"github.com/sid0709/OpenSeat/opened-backend/internal/staff"
)

func (s *Server) adminCases(w http.ResponseWriter, r *http.Request) {
	if !s.staffReady(w) {
		return
	}
	page, size := staffPageQuery(r)
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
	var input staff.CaseOpening
	if !decodeScout(w, r, maxWriteBody, &input) {
		return
	}
	if err := input.Normalize(); !writeStaff(w, err) {
		return
	}
	if !s.staffReady(w) {
		return
	}
	result, err := s.staff.OpenCase(r.Context(), adminActor(r), input, time.Now())
	if !writeStaff(w, err) {
		return
	}
	writeJSON(w, http.StatusCreated, result)
}

func (s *Server) adminDecideCase(w http.ResponseWriter, r *http.Request) {
	var input staff.CaseDecision
	if !decodeScout(w, r, maxWriteBody, &input) {
		return
	}
	if err := input.Normalize(); !writeStaff(w, err) {
		return
	}
	if !s.staffReady(w) {
		return
	}
	result, err := s.staff.DecideCase(r.Context(), r.PathValue("id"), adminActor(r), input, time.Now())
	if !writeStaff(w, err) {
		return
	}
	writeJSON(w, http.StatusOK, result)
}

func (s *Server) adminReports(w http.ResponseWriter, r *http.Request) {
	if !s.staffReady(w) {
		return
	}
	page, size := staffPageQuery(r)
	list, err := s.staff.ListReports(r.Context(), staff.ReportQuery{
		Status:   r.URL.Query().Get("status"),
		Page:     page,
		PageSize: size,
	})
	if !writeStaff(w, err) {
		return
	}
	writeJSON(w, http.StatusOK, list)
}

func (s *Server) adminFileReport(w http.ResponseWriter, r *http.Request) {
	key := strings.TrimSpace(r.Header.Get(idempotencyHeader))
	if !scout.ValidIdempotencyKey(key) {
		writeProblem(w, newProblem(http.StatusBadRequest, "invalid_request", "Idempotency-Key must be 1 to 255 characters."))
		return
	}
	body, ok := readBody(w, r, maxWriteBody)
	if !ok {
		return
	}
	var input staff.ReportFiling
	if err := json.Unmarshal(body, &input); err != nil {
		writeProblem(w, newProblem(http.StatusBadRequest, "invalid_request", "Body must be valid JSON."))
		return
	}
	if err := input.Normalize(); !writeStaff(w, err) {
		return
	}
	if !s.staffReady(w) {
		return
	}
	sum := sha256.Sum256(body)
	result, replayed, err := s.staff.FileReport(r.Context(), adminActor(r), key, hex.EncodeToString(sum[:]), input, time.Now())
	if !writeStaff(w, err) {
		return
	}
	if replayed {
		w.Header().Set("Idempotent-Replayed", "true")
	}
	writeJSON(w, http.StatusCreated, result)
}

func (s *Server) adminAppealReport(w http.ResponseWriter, r *http.Request) {
	var input staff.ReportAppeal
	if !decodeScout(w, r, maxWriteBody, &input) {
		return
	}
	if err := input.Normalize(); !writeStaff(w, err) {
		return
	}
	if !s.staffReady(w) {
		return
	}
	result, err := s.staff.AppealReport(r.Context(), r.PathValue("id"), adminActor(r), input, time.Now())
	if !writeStaff(w, err) {
		return
	}
	writeJSON(w, http.StatusOK, result)
}
