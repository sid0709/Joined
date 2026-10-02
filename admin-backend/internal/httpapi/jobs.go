package httpapi

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"log/slog"
	"net/http"
	"time"

	"github.com/sid0709/OpenSeat/backend-core/httpkit"
	"github.com/sid0709/OpenSeat/backend-core/jobs"
)

func (s *Server) settings(w http.ResponseWriter, r *http.Request) {
	model := ""
	if s.reader != nil {
		model = s.reader.Model()
	}
	httpkit.WriteJSON(w, http.StatusOK, map[string]string{"model": model})
}

func (s *Server) listTempJobs(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), httpkit.RequestTimeout)
	defer cancel()

	query := r.URL.Query()
	parsed := jobs.ParseListQuery(query.Get("page"), query.Get("pageSize"), query.Get("q"))
	parsed.HideAnalyzed = query.Get("hide") == "analyzed"
	result, err := s.store.List(ctx, parsed)
	if err != nil {
		slog.Error("list temp jobs", "error", err)
		httpkit.WriteError(w, http.StatusInternalServerError, "could not load temp jobs")
		return
	}
	httpkit.WriteJSON(w, http.StatusOK, result)
}

func (s *Server) listScoutTempJobs(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), httpkit.RequestTimeout)
	defer cancel()

	query := r.URL.Query()
	parsed := jobs.ParseListQuery(query.Get("page"), query.Get("pageSize"), query.Get("q"))
	parsed.HideAnalyzed = query.Get("hide") == "analyzed"
	result, err := s.store.ListScoutTemp(ctx, parsed)
	if err != nil {
		slog.Error("list scout temp jobs", "error", err)
		httpkit.WriteError(w, http.StatusInternalServerError, "could not list scout jobs")
		return
	}
	httpkit.WriteJSON(w, http.StatusOK, result)
}

func (s *Server) analyzeScoutJobs(w http.ResponseWriter, r *http.Request) {
	var body struct {
		TempJobIDs []string `json:"tempJobIds"`
	}
	decoder := json.NewDecoder(http.MaxBytesReader(w, r.Body, maxAnalyzeBody))
	if err := decoder.Decode(&body); err != nil && !errors.Is(err, io.EOF) {
		httpkit.WriteError(w, http.StatusBadRequest, "invalid analyze request")
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), analyzeTimeout)
	defer cancel()
	batch, err := s.store.AnalyzeScoutSelected(ctx, s.reader, body.TempJobIDs, time.Now())
	if jobs.IsMissingAPIKey(err) {
		httpkit.WriteError(w, http.StatusServiceUnavailable, missingAPIKey)
		return
	}
	if errors.Is(err, jobs.ErrNoSelection) || errors.Is(err, jobs.ErrTooMany) {
		httpkit.WriteError(w, http.StatusBadRequest, err.Error())
		return
	}
	if errors.Is(err, jobs.ErrAnalyzeInProgress) {
		httpkit.WriteError(w, http.StatusConflict, err.Error())
		return
	}
	if err != nil {
		slog.Error("analyze scout jobs", "error", err)
		httpkit.WriteError(w, http.StatusBadGateway, "could not analyze the job descriptions")
		return
	}
	httpkit.WriteJSON(w, http.StatusOK, batch)
}

func (s *Server) getTempJob(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), httpkit.RequestTimeout)
	defer cancel()

	job, err := s.store.Get(ctx, r.PathValue("id"))
	if errors.Is(err, jobs.ErrInvalidID) {
		httpkit.WriteError(w, http.StatusBadRequest, "invalid job id")
		return
	}
	if errors.Is(err, jobs.ErrNotFound) {
		httpkit.WriteError(w, http.StatusNotFound, "job not found")
		return
	}
	if err != nil {
		slog.Error("get temp job", "error", err)
		httpkit.WriteError(w, http.StatusInternalServerError, "could not load job")
		return
	}
	httpkit.WriteJSON(w, http.StatusOK, map[string]json.RawMessage{"job": job})
}

func (s *Server) updateTempJob(w http.ResponseWriter, r *http.Request) {
	var patch jobs.TempJobPatch
	decoder := json.NewDecoder(http.MaxBytesReader(w, r.Body, httpkit.MaxWriteBody))
	if err := decoder.Decode(&patch); err != nil {
		httpkit.WriteError(w, http.StatusBadRequest, "invalid job")
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), httpkit.RequestTimeout)
	defer cancel()
	job, err := s.store.UpdateTempJob(ctx, r.PathValue("id"), patch, time.Now())
	if errors.Is(err, jobs.ErrInvalidID) {
		httpkit.WriteError(w, http.StatusBadRequest, "invalid job id")
		return
	}
	if errors.Is(err, jobs.ErrInvalidInput) {
		httpkit.WriteError(w, http.StatusBadRequest, err.Error())
		return
	}
	if errors.Is(err, jobs.ErrNotFound) {
		httpkit.WriteError(w, http.StatusNotFound, "job not found")
		return
	}
	if err != nil {
		slog.Error("update temp job", "error", err)
		httpkit.WriteError(w, http.StatusInternalServerError, "could not save job")
		return
	}
	httpkit.WriteJSON(w, http.StatusOK, map[string]json.RawMessage{"job": job})
}

func (s *Server) listSearchJobs(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), httpkit.RequestTimeout)
	defer cancel()

	result, err := s.store.ListSearch(ctx, jobs.ParseJobQuery(r.URL.Query()), time.Now())
	if err != nil {
		slog.Error("list search jobs", "error", err)
		httpkit.WriteError(w, http.StatusInternalServerError, "could not load jobs")
		return
	}
	httpkit.WriteJSON(w, http.StatusOK, result)
}

func (s *Server) getSearchJob(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), httpkit.RequestTimeout)
	defer cancel()

	record, err := s.store.GetSearch(ctx, r.PathValue("id"), time.Now())
	if errors.Is(err, jobs.ErrNotFound) {
		httpkit.WriteError(w, http.StatusNotFound, "job not found")
		return
	}
	if err != nil {
		slog.Error("get search job", "error", err)
		httpkit.WriteError(w, http.StatusInternalServerError, "could not load job")
		return
	}
	httpkit.WriteJSON(w, http.StatusOK, record)
}

func (s *Server) updateSearchJob(w http.ResponseWriter, r *http.Request) {
	var patch jobs.SearchJobPatch
	decoder := json.NewDecoder(http.MaxBytesReader(w, r.Body, httpkit.MaxWriteBody))
	if err := decoder.Decode(&patch); err != nil {
		httpkit.WriteError(w, http.StatusBadRequest, "invalid job")
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), httpkit.RequestTimeout)
	defer cancel()
	record, err := s.store.UpdateSearchJob(ctx, r.PathValue("id"), patch, time.Now())
	if errors.Is(err, jobs.ErrNotFound) {
		httpkit.WriteError(w, http.StatusNotFound, "job not found")
		return
	}
	if err != nil {
		slog.Error("update search job", "error", err)
		httpkit.WriteError(w, http.StatusInternalServerError, "could not save job")
		return
	}
	httpkit.WriteJSON(w, http.StatusOK, record)
}
