package httpapi

import (
	"context"
	"crypto/subtle"
	"errors"
	"io"
	"log/slog"
	"net/http"
	"time"

	"github.com/sid0709/OpenSeat/backend-core/httpkit"
	"github.com/sid0709/OpenSeat/backend-core/jobs"
)

const (
	publicAnalyzerPrefix = "/v1/public/analyzer/"
	maxAnalyzerBody      = 512 << 10
)

func (s *Server) registerPublicAnalyzer(mux *http.ServeMux) {
	mux.HandleFunc("GET "+publicAnalyzerPrefix+"jobs", s.analyzerAuth(s.listUnanalyzedJobs))
	mux.HandleFunc("POST "+publicAnalyzerPrefix+"jobs/{id}/analysis", s.analyzerAuth(s.submitJobAnalysis))
	mux.HandleFunc("GET "+publicAnalyzerPrefix+"companies", s.analyzerAuth(s.listUnanalyzedCompanies))
	mux.HandleFunc("POST "+publicAnalyzerPrefix+"companies/{id}/analysis", s.analyzerAuth(s.submitCompanyAnalysis))
}

func (s *Server) analyzerAuth(next http.HandlerFunc) http.HandlerFunc {
	return bearerAuth(s.analyzerToken, "ANALYZER_API_TOKEN", "analyzer token required", next)
}

// bearerAuth guards a public route with its own token: 503 until the token is
// configured (envName says which), 401 without a matching bearer token.
func bearerAuth(want, envName, missing string, next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if want == "" {
			httpkit.WriteError(w, http.StatusServiceUnavailable, envName+" is not configured")
			return
		}
		token := httpkit.BearerToken(r)
		if subtle.ConstantTimeCompare([]byte(token), []byte(want)) == 1 {
			next(w, r)
			return
		}
		httpkit.WriteError(w, http.StatusUnauthorized, missing)
	}
}

func (s *Server) listUnanalyzedJobs(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), httpkit.RequestTimeout)
	defer cancel()

	query := r.URL.Query()
	parsed := jobs.ParseListQuery(query.Get("page"), query.Get("pageSize"), query.Get("q"))
	result, err := s.store.ListUnanalyzedTempJobs(ctx, parsed)
	if err != nil {
		slog.Error("list unanalyzed jobs", "error", err)
		httpkit.WriteError(w, http.StatusInternalServerError, "could not load temp jobs")
		return
	}
	httpkit.WriteJSON(w, http.StatusOK, result)
}

func (s *Server) listUnanalyzedCompanies(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), httpkit.RequestTimeout)
	defer cancel()

	query := r.URL.Query()
	parsed := jobs.ParseListQuery(query.Get("page"), query.Get("pageSize"), query.Get("q"))
	result, err := s.store.ListUnanalyzedCompanies(ctx, parsed)
	if err != nil {
		slog.Error("list unanalyzed companies", "error", err)
		httpkit.WriteError(w, http.StatusInternalServerError, "could not load companies")
		return
	}
	httpkit.WriteJSON(w, http.StatusOK, result)
}

func (s *Server) submitJobAnalysis(w http.ResponseWriter, r *http.Request) {
	body, err := io.ReadAll(http.MaxBytesReader(w, r.Body, maxAnalyzerBody))
	if err != nil {
		httpkit.WriteError(w, http.StatusBadRequest, "invalid job analysis")
		return
	}
	record, err := jobs.ParseSubmittedSearchRecord(body)
	if err != nil {
		httpkit.WriteError(w, http.StatusBadRequest, err.Error())
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), httpkit.RequestTimeout)
	defer cancel()
	saved, err := s.store.SubmitExternalJobAnalysis(ctx, r.PathValue("id"), record, time.Now())
	if errors.Is(err, jobs.ErrInvalidID) {
		httpkit.WriteError(w, http.StatusBadRequest, "invalid job id")
		return
	}
	if errors.Is(err, jobs.ErrNotFound) {
		httpkit.WriteError(w, http.StatusNotFound, "job not found")
		return
	}
	if errors.Is(err, jobs.ErrAlreadyAnalyzed) {
		httpkit.WriteError(w, http.StatusConflict, err.Error())
		return
	}
	if errors.Is(err, jobs.ErrInvalidInput) || errors.Is(err, jobs.ErrMissingDescription) {
		httpkit.WriteError(w, http.StatusBadRequest, err.Error())
		return
	}
	if err != nil {
		slog.Error("submit job analysis", "error", err)
		httpkit.WriteError(w, http.StatusInternalServerError, "could not save job analysis")
		return
	}
	httpkit.WriteJSON(w, http.StatusOK, saved)
}

func (s *Server) submitCompanyAnalysis(w http.ResponseWriter, r *http.Request) {
	body, err := io.ReadAll(http.MaxBytesReader(w, r.Body, maxAnalyzerBody))
	if err != nil {
		httpkit.WriteError(w, http.StatusBadRequest, "invalid company analysis")
		return
	}
	input, err := jobs.ParseSubmittedCompanyResearch(body)
	if err != nil {
		httpkit.WriteError(w, http.StatusBadRequest, err.Error())
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), httpkit.RequestTimeout)
	defer cancel()
	err = s.store.SubmitExternalCompanyAnalysis(ctx, r.PathValue("id"), input, time.Now())
	if errors.Is(err, jobs.ErrNotFound) {
		httpkit.WriteError(w, http.StatusNotFound, "company not found")
		return
	}
	if errors.Is(err, jobs.ErrAlreadyAnalyzed) {
		httpkit.WriteError(w, http.StatusConflict, err.Error())
		return
	}
	if errors.Is(err, jobs.ErrInvalidInput) {
		httpkit.WriteError(w, http.StatusBadRequest, err.Error())
		return
	}
	if err != nil {
		slog.Error("submit company analysis", "error", err)
		httpkit.WriteError(w, http.StatusInternalServerError, "could not save company analysis")
		return
	}
	httpkit.WriteJSON(w, http.StatusOK, map[string]string{"status": "saved"})
}
