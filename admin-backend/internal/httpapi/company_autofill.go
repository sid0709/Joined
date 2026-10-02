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

// A web search reads several pages, so it gets more time than an ordinary request.
const autofillTimeout = 3 * time.Minute

// autofillRequest carries what the admin has typed so far, which may not be saved yet.
// Blank fields fall back to the saved company.
type autofillRequest struct {
	Name string `json:"name"`
	URL  string `json:"url"`
}

// autofillCompany researches a company on the web and returns a draft for the edit form.
// It saves nothing: a person reviews the draft and saves it.
func (s *Server) autofillCompany(w http.ResponseWriter, r *http.Request) {
	var body autofillRequest
	decoder := json.NewDecoder(http.MaxBytesReader(w, r.Body, httpkit.MaxWriteBody))
	if err := decoder.Decode(&body); err != nil && !errors.Is(err, io.EOF) {
		httpkit.WriteError(w, http.StatusBadRequest, "invalid autofill request")
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), autofillTimeout)
	defer cancel()
	company, err := s.store.GetAdminCompany(ctx, r.PathValue("id"))
	if errors.Is(err, jobs.ErrNotFound) {
		httpkit.WriteError(w, http.StatusNotFound, "company not found")
		return
	}
	if err != nil {
		slog.Error("autofill: load company", "error", err)
		httpkit.WriteError(w, http.StatusInternalServerError, "could not load company")
		return
	}
	name, website := body.Name, body.URL
	if name == "" {
		name = company.Name
	}
	if website == "" {
		website = company.URL
	}

	var researcher jobs.WebResearcher
	if s.ai != nil {
		researcher = s.ai
	}
	result, err := jobs.ResearchCompany(ctx, researcher, name, website)
	if err != nil {
		status, message := autofillFailure(err)
		if status >= http.StatusInternalServerError {
			slog.Error("autofill company", "error", err)
		}
		httpkit.WriteError(w, status, message)
		return
	}
	httpkit.WriteJSON(w, http.StatusOK, result)
}

// autofillFailure maps a research error to what the admin sees.
func autofillFailure(err error) (int, string) {
	switch {
	case jobs.IsMissingAPIKey(err), errors.Is(err, jobs.ErrMissingResearcher):
		return http.StatusServiceUnavailable, missingMigrationKey
	case errors.Is(err, jobs.ErrInvalidInput):
		return http.StatusBadRequest, "Add a company name or a valid website first"
	case errors.Is(err, context.DeadlineExceeded):
		return http.StatusGatewayTimeout, "The web search took too long. Try again"
	default:
		return http.StatusBadGateway, "Could not research this company. Try again"
	}
}
