package httpapi

import (
	"context"
	"errors"
	"net/http"
	"time"

	"github.com/sid0709/OpenSeat/backend-core/httpkit"
	"github.com/sid0709/OpenSeat/backend-core/jobs"
	"github.com/sid0709/OpenSeat/backend-core/jobscam"
	"github.com/sid0709/OpenSeat/backend-core/scout"
)

const (
	routeJobSources     = "/v1/admin/job-sources"
	routeJobQuality     = "/v1/admin/jobs/quality"
	routeEarningsReport = "/v1/admin/scout/earnings/report"
)

// QualitySnapshot is the read-only job quality window.
type QualitySnapshot struct {
	Held      int64  `json:"held"`
	DeadLink  int64  `json:"dead_link"`
	Duplicate int64  `json:"duplicate"`
	Published int64  `json:"published"`
	Since     string `json:"since"`
}

// QualityReader supplies quality aggregates. Nil answers zeros except scam holds when present.
type QualityReader interface {
	Quality(ctx context.Context, since time.Time) (QualitySnapshot, error)
}

func (s *Server) registerOps(mux *http.ServeMux) {
	mux.HandleFunc("GET "+routeJobSources, s.adminJobSources)
	mux.HandleFunc("PUT "+routeJobSources+"/{id}", s.adminSetJobSource)
	mux.HandleFunc("GET "+routeJobQuality, s.adminJobQuality)
	mux.HandleFunc("GET "+routeEarningsReport, s.adminEarningsReport)
	mux.HandleFunc("POST /v1/admin/scout/earnings/{id}/clawback", s.adminClawbackEarning)
}

func (s *Server) adminJobSources(w http.ResponseWriter, r *http.Request) {
	httpkit.WriteJSON(w, http.StatusOK, map[string]any{"sources": jobs.MergeSourceStatus(s.importSources)})
}

func (s *Server) adminSetJobSource(w http.ResponseWriter, r *http.Request) {
	if !s.staffReady(w) {
		return
	}
	var body struct {
		Enabled bool   `json:"enabled"`
		Reason  string `json:"reason"`
	}
	if !httpkit.DecodeJSON(w, r, httpkit.MaxWriteBody, &body) {
		return
	}
	if body.Reason == "" {
		httpkit.WriteError(w, http.StatusUnprocessableEntity, "reason is required")
		return
	}
	id := r.PathValue("id")
	if err := jobs.SetSourceEnabled(id, body.Enabled, body.Reason); err != nil {
		httpkit.WriteError(w, http.StatusNotFound, "unknown source")
		return
	}
	now := time.Now().UTC()
	auditID, err := s.staff.WriteAudit(r.Context(), "job_source.set", "job_source", id, adminActor(r), body.Reason, now)
	if err != nil {
		httpkit.WriteError(w, http.StatusInternalServerError, "could not audit the source change")
		return
	}
	httpkit.WriteJSON(w, http.StatusOK, map[string]any{
		"id": id, "enabled": body.Enabled, "auditId": auditID,
	})
}

func (s *Server) adminJobQuality(w http.ResponseWriter, r *http.Request) {
	since := time.Now().UTC().Add(-7 * 24 * time.Hour)
	if raw := r.URL.Query().Get("since"); raw != "" {
		parsed, err := time.Parse(time.RFC3339, raw)
		if err != nil {
			httpkit.WriteError(w, http.StatusBadRequest, "since must be RFC3339")
			return
		}
		since = parsed
	}
	if s.quality != nil {
		snapshot, err := s.quality.Quality(r.Context(), since)
		if err != nil {
			httpkit.WriteError(w, http.StatusInternalServerError, "could not load quality")
			return
		}
		snapshot.Since = since.Format(time.RFC3339)
		httpkit.WriteJSON(w, http.StatusOK, snapshot)
		return
	}
	snapshot := QualitySnapshot{Since: since.Format(time.RFC3339)}
	if s.scamHolds != nil {
		list, err := s.scamHolds.List(r.Context(), jobscamListHeld())
		if err != nil {
			httpkit.WriteError(w, http.StatusInternalServerError, "could not load quality")
			return
		}
		snapshot.Held = list.Total
	}
	httpkit.WriteJSON(w, http.StatusOK, snapshot)
}

func (s *Server) adminEarningsReport(w http.ResponseWriter, r *http.Request) {
	if s.scouts == nil {
		httpkit.WriteError(w, http.StatusServiceUnavailable, "scout earnings are unavailable")
		return
	}
	from, to, err := reportWindow(r)
	if err != nil {
		httpkit.WriteError(w, http.StatusBadRequest, "from and to must be RFC3339")
		return
	}
	report, err := s.scouts.EarningsReport(r.Context(), from, to)
	if err != nil {
		httpkit.WriteError(w, http.StatusInternalServerError, "could not build the earnings report")
		return
	}
	httpkit.WriteJSON(w, http.StatusOK, report)
}

func (s *Server) adminClawbackEarning(w http.ResponseWriter, r *http.Request) {
	if !s.staffReady(w) {
		return
	}
	if s.scouts == nil {
		httpkit.WriteError(w, http.StatusServiceUnavailable, "scout earnings are unavailable")
		return
	}
	var body struct {
		Reason string `json:"reason"`
	}
	if !httpkit.DecodeJSON(w, r, httpkit.MaxWriteBody, &body) {
		return
	}
	if body.Reason == "" {
		httpkit.WriteError(w, http.StatusUnprocessableEntity, "reason is required")
		return
	}
	earning, err := s.scouts.ClawbackUnsettled(r.Context(), r.PathValue("id"))
	if errors.Is(err, scout.ErrEarningSettled) {
		httpkit.WriteError(w, http.StatusConflict, err.Error())
		return
	}
	if errors.Is(err, scout.ErrNotFound) {
		httpkit.WriteError(w, http.StatusNotFound, "earning not found")
		return
	}
	if err != nil {
		httpkit.WriteError(w, http.StatusInternalServerError, "could not claw back the earning")
		return
	}
	auditID, err := s.staff.WriteAudit(r.Context(), "earning.clawback", "earning", earning.ID, adminActor(r), body.Reason, time.Now().UTC())
	if err != nil {
		httpkit.WriteError(w, http.StatusInternalServerError, "could not audit the clawback")
		return
	}
	httpkit.WriteJSON(w, http.StatusOK, map[string]any{"status": earning.Status, "auditId": auditID})
}

func jobscamListHeld() jobscam.ListQuery {
	return jobscam.ListQuery{Status: jobscam.StatusHeld}
}

func reportWindow(r *http.Request) (time.Time, time.Time, error) {
	var from, to time.Time
	var err error
	if raw := r.URL.Query().Get("from"); raw != "" {
		from, err = time.Parse(time.RFC3339, raw)
		if err != nil {
			return time.Time{}, time.Time{}, err
		}
	}
	if raw := r.URL.Query().Get("to"); raw != "" {
		to, err = time.Parse(time.RFC3339, raw)
		if err != nil {
			return time.Time{}, time.Time{}, err
		}
	}
	return from, to, nil
}
