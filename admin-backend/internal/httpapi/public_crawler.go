package httpapi

import (
	"context"
	"errors"
	"io"
	"log/slog"
	"net/http"
	"time"

	"github.com/sid0709/OpenSeat/backend-core/httpkit"
	"github.com/sid0709/OpenSeat/backend-core/jobs"
)

const (
	publicCrawlerPrefix = "/v1/public/crawler/"
	// maxCrawlerBody fits a full batch of jobs with long descriptions.
	maxCrawlerBody = 4 << 20
)

// registerPublicCrawler serves the crawler extension, which stages the jobs it
// scrapes in temp_jobs for AI analysis. It needs CRAWLER_INGEST_TOKEN, not a staff session.
func (s *Server) registerPublicCrawler(mux *http.ServeMux) {
	mux.HandleFunc("POST "+publicCrawlerPrefix+"jobs", s.crawlerAuth(s.ingestCrawledJobs))
}

func (s *Server) crawlerAuth(next http.HandlerFunc) http.HandlerFunc {
	return bearerAuth(s.crawlerToken, "CRAWLER_INGEST_TOKEN", "crawler token required", next)
}

func (s *Server) ingestCrawledJobs(w http.ResponseWriter, r *http.Request) {
	body, err := io.ReadAll(http.MaxBytesReader(w, r.Body, maxCrawlerBody))
	if err != nil {
		httpkit.WriteError(w, http.StatusBadRequest, "invalid crawler batch")
		return
	}
	batch, err := jobs.ParseCrawlerBatch(body)
	if err != nil {
		httpkit.WriteError(w, http.StatusBadRequest, err.Error())
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), httpkit.RequestTimeout)
	defer cancel()
	result, err := s.store.IngestCrawledJobs(ctx, batch, time.Now())
	if errors.Is(err, context.DeadlineExceeded) {
		httpkit.WriteError(w, http.StatusServiceUnavailable, "temp jobs are busy, try again")
		return
	}
	if err != nil {
		slog.Error("ingest crawled jobs", "error", err)
		httpkit.WriteError(w, http.StatusInternalServerError, "could not stage crawled jobs")
		return
	}
	slog.Info("ingested crawled jobs",
		"created", result.Summary.Created, "duplicates", result.Summary.Duplicates, "failed", result.Summary.Failed)
	httpkit.WriteJSON(w, http.StatusOK, result)
}
