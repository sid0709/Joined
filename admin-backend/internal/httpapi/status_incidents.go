package httpapi

import (
	"errors"
	"log/slog"
	"net/http"
	"strings"
	"time"

	"github.com/sid0709/OpenSeat/backend-core/httpkit"
	"github.com/sid0709/OpenSeat/backend-core/statuspage"
)

const statusPageUnavailable = "The status page store is unavailable."

func (s *Server) registerStatusIncidents(mux *http.ServeMux) {
	mux.HandleFunc("GET /v1/admin/status/incidents", s.listStatusIncidents)
	mux.HandleFunc("POST /v1/admin/status/incidents", s.createStatusIncident)
	mux.HandleFunc("POST /v1/admin/status/incidents/{id}/updates", s.updateStatusIncident)
}

type statusComponent struct {
	ID   string `json:"id"`
	Name string `json:"name"`
}

// listStatusIncidents is every unresolved incident and every one from the page's
// history window, with the components an incident can name.
func (s *Server) listStatusIncidents(w http.ResponseWriter, r *http.Request) {
	if s.statusPage == nil {
		httpkit.WriteError(w, http.StatusServiceUnavailable, statusPageUnavailable)
		return
	}
	since := time.Now().AddDate(0, 0, -statuspage.HistoryDays)
	incidents, err := s.statusPage.Incidents(r.Context(), since)
	if err != nil {
		slog.Error("list status incidents", "error", err)
		httpkit.WriteProblem(w, httpkit.NewProblem(http.StatusInternalServerError, "internal_error", "Something went wrong. Try again."))
		return
	}
	components := make([]statusComponent, len(statuspage.Components))
	for i, c := range statuspage.Components {
		components[i] = statusComponent{ID: c.ID, Name: c.Name}
	}
	if incidents == nil {
		incidents = []statuspage.Incident{}
	}
	httpkit.WriteJSON(w, http.StatusOK, map[string]any{"incidents": incidents, "components": components})
}

func (s *Server) createStatusIncident(w http.ResponseWriter, r *http.Request) {
	if s.statusPage == nil {
		httpkit.WriteError(w, http.StatusServiceUnavailable, statusPageUnavailable)
		return
	}
	var body statuspage.NewIncident
	if !httpkit.DecodeJSON(w, r, httpkit.MaxWriteBody, &body) {
		return
	}
	incident, err := s.statusPage.CreateIncident(r.Context(), body, adminActor(r), time.Now())
	if writeStatusError(w, err) {
		return
	}
	httpkit.WriteJSON(w, http.StatusCreated, incident)
}

func (s *Server) updateStatusIncident(w http.ResponseWriter, r *http.Request) {
	if s.statusPage == nil {
		httpkit.WriteError(w, http.StatusServiceUnavailable, statusPageUnavailable)
		return
	}
	var body statuspage.NewUpdate
	if !httpkit.DecodeJSON(w, r, httpkit.MaxWriteBody, &body) {
		return
	}
	incident, err := s.statusPage.UpdateIncident(r.Context(), r.PathValue("id"), body, adminActor(r), time.Now())
	if writeStatusError(w, err) {
		return
	}
	httpkit.WriteJSON(w, http.StatusOK, incident)
}

// writeStatusError answers a failed incident write and reports whether it did.
func writeStatusError(w http.ResponseWriter, err error) bool {
	switch {
	case err == nil:
		return false
	case errors.Is(err, statuspage.ErrInvalid):
		reason := strings.TrimPrefix(err.Error(), statuspage.ErrInvalid.Error()+": ")
		httpkit.WriteProblem(w, httpkit.NewProblem(http.StatusUnprocessableEntity, "validation_failed", capitalize(reason)+"."))
	case errors.Is(err, statuspage.ErrNotFound):
		httpkit.WriteProblem(w, httpkit.NewProblem(http.StatusNotFound, "not_found", "That incident does not exist."))
	default:
		slog.Error("status incident write", "error", err)
		httpkit.WriteProblem(w, httpkit.NewProblem(http.StatusInternalServerError, "internal_error", "Something went wrong. Try again."))
	}
	return true
}

func capitalize(s string) string {
	if s == "" {
		return s
	}
	return strings.ToUpper(s[:1]) + s[1:]
}
