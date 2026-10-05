package httpapi

import (
	"context"
	"log/slog"
	"net/http"

	"github.com/sid0709/OpenSeat/backend-core/httpkit"
	"github.com/sid0709/OpenSeat/backend-core/jobs"
)

const defaultImportRecentLimit = 20

// ImportOptions is the read-only recent-runs view for scheduled job import.
type ImportOptions struct {
	Enabled     bool
	Sources     []jobs.SourceStatus
	RecentLimit int
	Runs        jobs.ImportRunLog
}

func (s *Server) listImportRuns(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), httpkit.RequestTimeout)
	defer cancel()

	limit := s.importRecentLimit
	if limit < 1 {
		limit = defaultImportRecentLimit
	}
	runs := []jobs.ImportRun{}
	if s.importRuns != nil {
		listed, err := s.importRuns.Recent(ctx, limit)
		if err != nil {
			slog.Error("list import runs", "error", err)
			httpkit.WriteError(w, http.StatusInternalServerError, "could not load import runs")
			return
		}
		if listed != nil {
			runs = listed
		}
	} else if s.store != nil {
		listed, err := s.store.RecentImportRuns(ctx, limit)
		if err != nil {
			slog.Error("list import runs", "error", err)
			httpkit.WriteError(w, http.StatusInternalServerError, "could not load import runs")
			return
		}
		if listed != nil {
			runs = listed
		}
	}
	sources := s.importSources
	if sources == nil {
		sources = []jobs.SourceStatus{}
	}
	httpkit.WriteJSON(w, http.StatusOK, jobs.ImportRunsResponse{
		Enabled: s.importEnabled,
		Sources: sources,
		Runs:    runs,
	})
}
