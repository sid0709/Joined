package httpapi

import (
	"bytes"
	"encoding/json"
	"errors"
	"io"
	"log/slog"
	"mime"
	"mime/multipart"
	"net/http"
	"time"

	"github.com/sid0709/OpenSeat/joined-backend/internal/jobs"
	"github.com/sid0709/OpenSeat/joined-backend/internal/scout"
)

const maxCompanyBody = jobs.MaxLogoBytes + 64<<10

func (s *Server) scoutSearchCompanies(w http.ResponseWriter, r *http.Request) {
	if _, ok := s.scoutActor(w, r, sessionOrKey); !ok {
		return
	}
	found, err := s.auth.SearchCompanies(r.Context(), r.URL.Query().Get("q"))
	if err != nil {
		slog.Error("search companies", "error", err)
		writeProblem(w, newProblem(http.StatusInternalServerError, "internal_error", "Could not search companies."))
		return
	}
	companies := make([]jobs.CompanyMatch, 0, len(found))
	for _, company := range found {
		companies = append(companies, jobs.CompanyMatch{
			ID:   company.ID,
			Name: company.Name,
			URL:  company.URL,
			Logo: company.Logo,
		})
	}
	writeJSON(w, http.StatusOK, map[string]any{"companies": companies})
}

func (s *Server) scoutCreateCompany(w http.ResponseWriter, r *http.Request) {
	actor, ok := s.scoutActor(w, r, sessionOrKey)
	if !ok {
		return
	}
	body, ok := readBody(w, r, maxCompanyBody)
	if !ok {
		return
	}
	s.idempotent(w, r, actor, body, func() (int, any) {
		name, website, logo, err := companyParts(r.Header.Get("Content-Type"), body)
		if err != nil {
			return http.StatusBadRequest, newProblem(http.StatusBadRequest, "invalid_request", "Body must be JSON or a multipart form.")
		}
		input, err := scout.NormalizeScoutCompany(name, website, logo)
		if err != nil {
			problem := scoutProblem(err)
			return problem.Status, problem
		}
		company, created, err := s.store.CreateScoutCompany(r.Context(), input, time.Now())
		if errors.Is(err, jobs.ErrInvalidInput) {
			return http.StatusBadRequest, newProblem(http.StatusBadRequest, "invalid_request", err.Error())
		}
		if err != nil {
			slog.Error("create company", "error", err)
			return http.StatusInternalServerError, newProblem(http.StatusInternalServerError, "internal_error", "Could not create the company.")
		}
		if created {
			return http.StatusCreated, company
		}
		return http.StatusOK, company
	})
}

func companyParts(contentType string, body []byte) (string, string, []byte, error) {
	media, params, err := mime.ParseMediaType(contentType)
	if err != nil || media == "application/json" || contentType == "" {
		var input struct {
			LegalName string `json:"legal_name"`
			URL       string `json:"url"`
		}
		if err := json.Unmarshal(body, &input); err != nil && len(bytes.TrimSpace(body)) > 0 {
			return "", "", nil, err
		}
		return input.LegalName, input.URL, nil, nil
	}
	if media != "multipart/form-data" || params["boundary"] == "" {
		return "", "", nil, errors.New("unsupported content type")
	}
	form, err := multipart.NewReader(bytes.NewReader(body), params["boundary"]).ReadForm(maxCompanyBody)
	if err != nil {
		return "", "", nil, err
	}
	defer form.RemoveAll()
	var logo []byte
	if files := form.File["logo"]; len(files) > 0 {
		file, err := files[0].Open()
		if err != nil {
			return "", "", nil, err
		}
		defer file.Close()
		logo, err = io.ReadAll(io.LimitReader(file, jobs.MaxLogoBytes+1))
		if err != nil {
			return "", "", nil, err
		}
	}
	return firstValue(form.Value["legal_name"]), firstValue(form.Value["url"]), logo, nil
}

func firstValue(values []string) string {
	if len(values) == 0 {
		return ""
	}
	return values[0]
}
