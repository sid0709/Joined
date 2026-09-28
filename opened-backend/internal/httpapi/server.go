package httpapi

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"log/slog"
	"net/http"
	"time"

	"github.com/sid0709/OpenSeat/opened-backend/internal/auth"
	"github.com/sid0709/OpenSeat/opened-backend/internal/jobs"
)

const (
	requestTimeout = 30 * time.Second
	copyTimeout    = 20 * time.Minute
	analyzeTimeout = 15 * time.Minute
	pingTimeout    = 3 * time.Second
	maxAnalyzeBody = 16 << 10
	maxWriteBody   = 128 << 10
)

type Server struct {
	store   *jobs.Store
	auth    *auth.Store
	reader  jobs.ModelReader
	origins map[string]struct{}
}

func New(store *jobs.Store, accounts *auth.Store, reader jobs.ModelReader, origins []string) http.Handler {
	allowed := make(map[string]struct{}, len(origins))
	for _, origin := range origins {
		allowed[origin] = struct{}{}
	}
	server := &Server{store: store, auth: accounts, reader: reader, origins: allowed}
	mux := http.NewServeMux()
	mux.HandleFunc("POST /v1/auth/signup", server.signup)
	mux.HandleFunc("POST /v1/auth/signin", server.signin)
	mux.HandleFunc("POST /v1/auth/signout", server.signout)
	mux.HandleFunc("DELETE /v1/auth/account", server.deleteAccount)
	mux.HandleFunc("GET /v1/auth/session", server.session)
	mux.HandleFunc("POST /v1/auth/company", server.attachCompany)
	mux.HandleFunc("GET /v1/auth/companies", server.searchCompanies)
	mux.HandleFunc("GET /health", server.health)
	mux.HandleFunc("GET /v1/settings", server.settings)
	mux.HandleFunc("GET /v1/jobs/temp", server.listTempJobs)
	mux.HandleFunc("GET /v1/jobs/temp/{id}", server.getTempJob)
	mux.HandleFunc("PATCH /v1/jobs/temp/{id}", server.updateTempJob)
	mux.HandleFunc("POST /v1/jobs/temp/sync", server.syncTempJobs)
	mux.HandleFunc("GET /v1/companies", server.listCompanies)
	mux.HandleFunc("GET /v1/companies/{id}", server.getAdminCompany)
	mux.HandleFunc("PATCH /v1/companies/{id}", server.updateCompany)
	mux.HandleFunc("GET /v1/jobs", server.listSearchJobs)
	mux.HandleFunc("POST /v1/jobs/analyze", server.analyzeJob)
	mux.HandleFunc("GET /v1/jobs/{id}", server.getSearchJob)
	mux.HandleFunc("PATCH /v1/jobs/{id}", server.updateSearchJob)
	mux.HandleFunc("GET /v1/search/jobs", server.listSearchCatalog)
	mux.HandleFunc("GET /v1/search/jobs/{id}", server.getSearchCatalogJob)
	mux.HandleFunc("GET /v1/search/companies/{id}/logo", server.getCompanyLogo)
	mux.HandleFunc("GET /v1/search/companies/{id}", server.getSearchCompany)
	return server.withCORS(mux)
}

func (s *Server) settings(w http.ResponseWriter, r *http.Request) {
	model := ""
	if s.reader != nil {
		model = s.reader.Model()
	}
	writeJSON(w, http.StatusOK, map[string]string{"model": model})
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
	parsed := jobs.ParseListQuery(query.Get("page"), query.Get("pageSize"), query.Get("q"))
	parsed.HideAnalyzed = query.Get("hide") == "analyzed"
	result, err := s.store.List(ctx, parsed)
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

func (s *Server) updateTempJob(w http.ResponseWriter, r *http.Request) {
	var patch jobs.TempJobPatch
	decoder := json.NewDecoder(http.MaxBytesReader(w, r.Body, maxWriteBody))
	if err := decoder.Decode(&patch); err != nil {
		writeError(w, http.StatusBadRequest, "invalid job")
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), requestTimeout)
	defer cancel()
	job, err := s.store.UpdateTempJob(ctx, r.PathValue("id"), patch, time.Now())
	if errors.Is(err, jobs.ErrInvalidID) {
		writeError(w, http.StatusBadRequest, "invalid job id")
		return
	}
	if errors.Is(err, jobs.ErrInvalidInput) {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	if errors.Is(err, jobs.ErrNotFound) {
		writeError(w, http.StatusNotFound, "job not found")
		return
	}
	if err != nil {
		slog.Error("update temp job", "error", err)
		writeError(w, http.StatusInternalServerError, "could not save job")
		return
	}
	writeJSON(w, http.StatusOK, map[string]json.RawMessage{"job": job})
}

func (s *Server) listCompanies(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), requestTimeout)
	defer cancel()

	query := r.URL.Query()
	result, err := s.store.ListCompanies(ctx, jobs.ParseListQuery(query.Get("page"), query.Get("pageSize"), query.Get("q")))
	if err != nil {
		slog.Error("list companies", "error", err)
		writeError(w, http.StatusInternalServerError, "could not load companies")
		return
	}
	writeJSON(w, http.StatusOK, result)
}

func (s *Server) getAdminCompany(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), requestTimeout)
	defer cancel()

	company, err := s.store.GetAdminCompany(ctx, r.PathValue("id"))
	if errors.Is(err, jobs.ErrNotFound) {
		writeError(w, http.StatusNotFound, "company not found")
		return
	}
	if err != nil {
		slog.Error("get company", "error", err)
		writeError(w, http.StatusInternalServerError, "could not load company")
		return
	}
	writeJSON(w, http.StatusOK, company)
}

func (s *Server) updateCompany(w http.ResponseWriter, r *http.Request) {
	var input jobs.CompanyWrite
	decoder := json.NewDecoder(http.MaxBytesReader(w, r.Body, maxWriteBody))
	if err := decoder.Decode(&input); err != nil {
		writeError(w, http.StatusBadRequest, "invalid company")
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), requestTimeout)
	defer cancel()
	company, err := s.store.UpdateCompany(ctx, r.PathValue("id"), input)
	if errors.Is(err, jobs.ErrInvalidInput) {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	if errors.Is(err, jobs.ErrNotFound) {
		writeError(w, http.StatusNotFound, "company not found")
		return
	}
	if err != nil {
		slog.Error("update company", "error", err)
		writeError(w, http.StatusInternalServerError, "could not save company")
		return
	}
	writeJSON(w, http.StatusOK, company)
}

func (s *Server) listSearchCatalog(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), requestTimeout)
	defer cancel()

	catalog, err := s.store.ListCatalog(ctx, time.Now())
	if err != nil {
		slog.Error("list search catalog", "error", err)
		writeError(w, http.StatusInternalServerError, "could not load jobs")
		return
	}
	writeJSON(w, http.StatusOK, catalog)
}

func (s *Server) getSearchCatalogJob(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), requestTimeout)
	defer cancel()

	job, err := s.store.GetCatalogJob(ctx, r.PathValue("id"), time.Now())
	if errors.Is(err, jobs.ErrNotFound) {
		writeError(w, http.StatusNotFound, "job not found")
		return
	}
	if err != nil {
		slog.Error("get search catalog job", "error", err)
		writeError(w, http.StatusInternalServerError, "could not load job")
		return
	}
	writeJSON(w, http.StatusOK, job)
}

func (s *Server) getCompanyLogo(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), requestTimeout)
	defer cancel()

	body, contentType, err := s.store.OpenCompanyLogo(ctx, r.PathValue("id"))
	if errors.Is(err, jobs.ErrNotFound) {
		writeError(w, http.StatusNotFound, "logo not found")
		return
	}
	if err != nil {
		slog.Error("get company logo", "error", err)
		writeError(w, http.StatusBadGateway, "could not load logo")
		return
	}
	defer body.Close()

	w.Header().Set("Content-Type", contentType)
	w.Header().Set("Cache-Control", "public, max-age=86400")
	if _, err := io.Copy(w, body); err != nil {
		slog.Error("write company logo", "error", err)
	}
}

func (s *Server) getSearchCompany(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), requestTimeout)
	defer cancel()

	page, err := s.store.CompanyPage(ctx, r.PathValue("id"), time.Now())
	if errors.Is(err, jobs.ErrNotFound) {
		writeError(w, http.StatusNotFound, "company not found")
		return
	}
	if err != nil {
		slog.Error("get search company", "error", err)
		writeError(w, http.StatusInternalServerError, "could not load company")
		return
	}
	writeJSON(w, http.StatusOK, page)
}

func (s *Server) listSearchJobs(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), requestTimeout)
	defer cancel()

	query := r.URL.Query()
	result, err := s.store.ListSearch(ctx, jobs.ParseListQuery(query.Get("page"), query.Get("pageSize"), query.Get("q")), time.Now())
	if err != nil {
		slog.Error("list search jobs", "error", err)
		writeError(w, http.StatusInternalServerError, "could not load jobs")
		return
	}
	writeJSON(w, http.StatusOK, result)
}

func (s *Server) getSearchJob(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), requestTimeout)
	defer cancel()

	record, err := s.store.GetSearch(ctx, r.PathValue("id"), time.Now())
	if errors.Is(err, jobs.ErrNotFound) {
		writeError(w, http.StatusNotFound, "job not found")
		return
	}
	if err != nil {
		slog.Error("get search job", "error", err)
		writeError(w, http.StatusInternalServerError, "could not load job")
		return
	}
	writeJSON(w, http.StatusOK, record)
}

func (s *Server) updateSearchJob(w http.ResponseWriter, r *http.Request) {
	var patch jobs.SearchJobPatch
	decoder := json.NewDecoder(http.MaxBytesReader(w, r.Body, maxWriteBody))
	if err := decoder.Decode(&patch); err != nil {
		writeError(w, http.StatusBadRequest, "invalid job")
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), requestTimeout)
	defer cancel()
	record, err := s.store.UpdateSearchJob(ctx, r.PathValue("id"), patch, time.Now())
	if errors.Is(err, jobs.ErrNotFound) {
		writeError(w, http.StatusNotFound, "job not found")
		return
	}
	if err != nil {
		slog.Error("update search job", "error", err)
		writeError(w, http.StatusInternalServerError, "could not save job")
		return
	}
	writeJSON(w, http.StatusOK, record)
}

func (s *Server) analyzeJob(w http.ResponseWriter, r *http.Request) {
	var body struct {
		TempJobIDs []string `json:"tempJobIds"`
	}
	decoder := json.NewDecoder(http.MaxBytesReader(w, r.Body, maxAnalyzeBody))
	if err := decoder.Decode(&body); err != nil && !errors.Is(err, io.EOF) {
		writeError(w, http.StatusBadRequest, "invalid analyze request")
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), analyzeTimeout)
	defer cancel()
	batch, err := s.store.AnalyzeSelected(ctx, s.reader, body.TempJobIDs, time.Now())
	if jobs.IsMissingAPIKey(err) {
		writeError(w, http.StatusServiceUnavailable, "Set OPENAI_API_KEY in the admin API environment")
		return
	}
	if errors.Is(err, jobs.ErrNoSelection) || errors.Is(err, jobs.ErrTooMany) {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	if errors.Is(err, jobs.ErrAnalyzeInProgress) {
		writeError(w, http.StatusConflict, err.Error())
		return
	}
	if err != nil {
		slog.Error("analyze jobs", "error", err)
		writeError(w, http.StatusBadGateway, "could not analyze the job descriptions")
		return
	}
	writeJSON(w, http.StatusOK, batch)
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
				w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PATCH, DELETE, OPTIONS")
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
