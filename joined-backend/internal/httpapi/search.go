package httpapi

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"time"

	"github.com/sid0709/OpenSeat/backend-core/httpkit"
	"github.com/sid0709/OpenSeat/backend-core/jobs"
)

func (s *Server) listSearchCatalog(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), httpkit.RequestTimeout)
	defer cancel()

	catalog, err := s.store.ListCatalog(ctx, time.Now())
	if err != nil {
		slog.Error("list search catalog", "error", err)
		httpkit.WriteError(w, http.StatusInternalServerError, "could not load jobs")
		return
	}
	httpkit.WriteJSON(w, http.StatusOK, catalog)
}

func (s *Server) getSearchCatalogJob(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), httpkit.RequestTimeout)
	defer cancel()

	job, err := s.store.GetCatalogJob(ctx, r.PathValue("id"), time.Now())
	if errors.Is(err, jobs.ErrNotFound) {
		httpkit.WriteError(w, http.StatusNotFound, "job not found")
		return
	}
	if err != nil {
		slog.Error("get search catalog job", "error", err)
		httpkit.WriteError(w, http.StatusInternalServerError, "could not load job")
		return
	}
	httpkit.WriteJSON(w, http.StatusOK, job)
}

func (s *Server) getSearchCompany(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), httpkit.RequestTimeout)
	defer cancel()

	page, err := s.store.CompanyPage(ctx, r.PathValue("id"), time.Now())
	if errors.Is(err, jobs.ErrNotFound) {
		httpkit.WriteError(w, http.StatusNotFound, "company not found")
		return
	}
	if err != nil {
		slog.Error("get search company", "error", err)
		httpkit.WriteError(w, http.StatusInternalServerError, "could not load company")
		return
	}
	query := r.URL.Query()
	httpkit.WriteJSON(w, http.StatusOK, page.Filtered(query.Get("department"), query.Get("location")))
}
