package httpapi

import (
	"context"
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"
	"time"

	"github.com/sid0709/OpenSeat/opened-backend/internal/jobs"
)

const (
	requestTimeout = 30 * time.Second
	copyTimeout    = 20 * time.Minute
	pingTimeout    = 3 * time.Second
)

type Server struct {
	store   *jobs.Store
	origins map[string]struct{}
}

func New(store *jobs.Store, origins []string) http.Handler {
	allowed := make(map[string]struct{}, len(origins))
	for _, origin := range origins {
		allowed[origin] = struct{}{}
	}
	server := &Server{store: store, origins: allowed}
	mux := http.NewServeMux()
	mux.HandleFunc("GET /health", server.health)
	mux.HandleFunc("GET /v1/jobs/temp", server.listTempJobs)
	mux.HandleFunc("GET /v1/jobs/temp/{id}", server.getTempJob)
	mux.HandleFunc("POST /v1/jobs/temp/sync", server.syncTempJobs)
	return server.withCORS(mux)
}

func (s *Server) health(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), pingTimeout)
	defer cancel()
	if err := s.store.Ping(ctx); err != nil {
		slog.Error("health", "error", err)
		writeError(w, http.StatusServiceUnavailable, "database unavailable")
		return
	}
	writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
}

func (s *Server) listTempJobs(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), requestTimeout)
	defer cancel()

	query := r.URL.Query()
	result, err := s.store.List(ctx, jobs.ParseListQuery(query.Get("page"), query.Get("pageSize"), query.Get("q")))
	if err != nil {
		slog.Error("list temp jobs", "error", err)
		writeError(w, http.StatusInternalServerError, "could not load temp jobs")
		return
	}
	writeJSON(w, http.StatusOK, result)
}

func (s *Server) getTempJob(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), requestTimeout)
	defer cancel()

	job, err := s.store.Get(ctx, r.PathValue("id"))
	if errors.Is(err, jobs.ErrInvalidID) {
		writeError(w, http.StatusBadRequest, "invalid job id")
		return
	}
	if errors.Is(err, jobs.ErrNotFound) {
		writeError(w, http.StatusNotFound, "job not found")
		return
	}
	if err != nil {
		slog.Error("get temp job", "error", err)
		writeError(w, http.StatusInternalServerError, "could not load job")
		return
	}
	writeJSON(w, http.StatusOK, map[string]json.RawMessage{"job": job})
}

func (s *Server) syncTempJobs(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(context.Background(), copyTimeout)
	defer cancel()

	result, err := s.store.Copy(ctx)
	if errors.Is(err, jobs.ErrCopyInProgress) {
		writeError(w, http.StatusConflict, err.Error())
		return
	}
	if err != nil {
		slog.Error("sync temp jobs", "error", err)
		writeError(w, http.StatusInternalServerError, "could not copy jobs")
		return
	}
	writeJSON(w, http.StatusOK, result)
}

func (s *Server) withCORS(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if origin := r.Header.Get("Origin"); origin != "" {
			if _, ok := s.origins[origin]; ok {
				w.Header().Set("Access-Control-Allow-Origin", origin)
				w.Header().Set("Vary", "Origin")
				w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
				w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Accept")
			}
		}
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}

func writeJSON(w http.ResponseWriter, status int, value any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	if err := json.NewEncoder(w).Encode(value); err != nil {
		slog.Error("write json", "error", err)
	}
}

func writeError(w http.ResponseWriter, status int, message string) {
	writeJSON(w, status, map[string]string{"error": message})
}
