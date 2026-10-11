package httpapi

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"strconv"
	"time"

	"github.com/sid0709/OpenSeat/backend-core/httpkit"
	"github.com/sid0709/OpenSeat/backend-core/jobs"
)

func (s *Server) listSearchCatalog(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), httpkit.RequestTimeout)
	defer cancel()

	query := parseSearchQuery(r)
	userID := s.searchUser(r)

	if query.HasCriteria() && s.rankedSearch(ctx, w, query, userID) {
		return
	}

	if !query.HasCriteria() {
		catalog, err := s.store.ListCatalog(ctx, time.Now())
		if err != nil {
			slog.Error("list search catalog", "error", err)
			httpkit.WriteError(w, http.StatusInternalServerError, "could not load jobs")
			return
		}
		httpkit.WriteJSON(w, http.StatusOK, catalog)
		return
	}

	results, err := s.store.SearchJobs(ctx, query, time.Now())
	if err != nil {
		if errors.Is(err, jobs.ErrCursorNotSupportedForRelevance) {
			httpkit.WriteError(w, http.StatusBadRequest, "cursor-based paging not supported with relevance sort")
			return
		}
		slog.Error("search jobs", "error", err, "query", query)
		httpkit.WriteError(w, http.StatusInternalServerError, "could not search jobs")
		return
	}
	page := make([]jobs.SearchJob, len(results.Jobs))
	for i := range results.Jobs {
		page[i] = results.Jobs[i].SearchJob
	}
	if userID != "" {
		w.Header().Set("Cache-Control", privateCache)
	}
	httpkit.WriteJSON(w, http.StatusOK, fallbackSearchResponse{SearchResults: results, Fits: s.pageFits(ctx, userID, page)})
}

func parseSearchQuery(r *http.Request) jobs.SearchQuery {
	q := r.URL.Query()

	query := jobs.SearchQuery{
		Keyword:    q.Get("q"),
		Location:   q.Get("location"),
		Workplace:  q.Get("workplace"),
		Employment: q.Get("employment"),
		Seniority:  q.Get("seniority"),
		Company:    q.Get("company"),
		Currency:   q.Get("currency"),
		SortBy:     q.Get("sort"),
		Cursor:     q.Get("cursor"),
		Remote:     q.Get("remote") == "true",
		Source:     q.Get("source"),
		List:       q.Get("list"),
		Region:     q.Get("region"),
	}

	if salaryMin := q.Get("salaryMin"); salaryMin != "" {
		if val, err := strconv.Atoi(salaryMin); err == nil && val > 0 {
			query.SalaryMin = val
		}
	}

	if salaryMax := q.Get("salaryMax"); salaryMax != "" {
		if val, err := strconv.Atoi(salaryMax); err == nil && val > 0 {
			query.SalaryMax = val
		}
	}

	if postedDays := q.Get("postedDays"); postedDays != "" {
		if val, err := strconv.Atoi(postedDays); err == nil && val > 0 {
			query.PostedDays = val
		}
	}

	if limit := q.Get("limit"); limit != "" {
		if val, err := strconv.Atoi(limit); err == nil && val > 0 {
			query.Limit = val
		}
	}

	if page := q.Get("page"); page != "" {
		if val, err := strconv.Atoi(page); err == nil && val > 1 {
			query.Page = val
		}
	}

	if visa := q.Get("visa"); visa == "1" || visa == "true" {
		query.Visa = true
	}

	return query
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
