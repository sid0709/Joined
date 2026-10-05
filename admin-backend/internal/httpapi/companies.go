package httpapi

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"log/slog"
	"net/http"

	"github.com/sid0709/OpenSeat/backend-core/httpkit"
	"github.com/sid0709/OpenSeat/backend-core/jobs"
)

// maxCompanyTransferBody caps the staged-company import file.
const maxCompanyTransferBody = 32 << 20

const stagedCompaniesFile = "staged-companies.json"

func (s *Server) listCompanies(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), httpkit.RequestTimeout)
	defer cancel()

	result, err := s.store.ListCompanies(ctx, jobs.ParseCompanyQuery(r.URL.Query()))
	if err != nil {
		slog.Error("list companies", "error", err)
		httpkit.WriteError(w, http.StatusInternalServerError, "could not load companies")
		return
	}
	httpkit.WriteJSON(w, http.StatusOK, result)
}

func (s *Server) listStagedCompanies(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), httpkit.RequestTimeout)
	defer cancel()

	result, err := s.store.ListStagedCompanies(ctx, jobs.ParseStagedCompanyQuery(r.URL.Query()))
	if err != nil {
		slog.Error("list staged companies", "error", err)
		httpkit.WriteError(w, http.StatusInternalServerError, "could not load staged companies")
		return
	}
	httpkit.WriteJSON(w, http.StatusOK, result)
}

func (s *Server) exportStagedCompanies(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), httpkit.RequestTimeout)
	defer cancel()

	rows, err := s.store.ExportStagedCompanies(ctx)
	if err != nil {
		slog.Error("export staged companies", "error", err)
		httpkit.WriteError(w, http.StatusInternalServerError, "could not export staged companies")
		return
	}
	if rows == nil {
		rows = []jobs.CompanyTransfer{}
	}
	raw, err := json.MarshalIndent(rows, "", "  ")
	if err != nil {
		slog.Error("encode staged companies", "error", err)
		httpkit.WriteError(w, http.StatusInternalServerError, "could not export staged companies")
		return
	}
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Content-Disposition", `attachment; filename="`+stagedCompaniesFile+`"`)
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write(append(raw, '\n'))
}

func (s *Server) importStagedCompanies(w http.ResponseWriter, r *http.Request) {
	body, err := io.ReadAll(http.MaxBytesReader(w, r.Body, maxCompanyTransferBody))
	if err != nil {
		httpkit.WriteError(w, http.StatusBadRequest, "invalid company file")
		return
	}
	ctx, cancel := context.WithTimeout(r.Context(), httpkit.RequestTimeout)
	defer cancel()
	result, err := s.store.ImportStagedCompanies(ctx, body)
	if errors.Is(err, jobs.ErrInvalidInput) {
		httpkit.WriteError(w, http.StatusBadRequest, err.Error())
		return
	}
	if err != nil {
		slog.Error("import staged companies", "error", err)
		httpkit.WriteError(w, http.StatusInternalServerError, "could not import companies")
		return
	}
	httpkit.WriteJSON(w, http.StatusOK, result)
}

func (s *Server) getAdminCompany(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), httpkit.RequestTimeout)
	defer cancel()

	company, err := s.store.GetAdminCompany(ctx, r.PathValue("id"))
	if errors.Is(err, jobs.ErrNotFound) {
		httpkit.WriteError(w, http.StatusNotFound, "company not found")
		return
	}
	if err != nil {
		slog.Error("get company", "error", err)
		httpkit.WriteError(w, http.StatusInternalServerError, "could not load company")
		return
	}
	httpkit.WriteJSON(w, http.StatusOK, company)
}

func (s *Server) updateCompany(w http.ResponseWriter, r *http.Request) {
	var input jobs.CompanyWrite
	decoder := json.NewDecoder(http.MaxBytesReader(w, r.Body, httpkit.MaxWriteBody))
	if err := decoder.Decode(&input); err != nil {
		httpkit.WriteError(w, http.StatusBadRequest, "invalid company")
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), httpkit.RequestTimeout)
	defer cancel()
	company, err := s.store.UpdateCompany(ctx, r.PathValue("id"), input)
	if errors.Is(err, jobs.ErrInvalidInput) {
		httpkit.WriteError(w, http.StatusBadRequest, err.Error())
		return
	}
	if errors.Is(err, jobs.ErrNotFound) {
		httpkit.WriteError(w, http.StatusNotFound, "company not found")
		return
	}
	if err != nil {
		slog.Error("update company", "error", err)
		httpkit.WriteError(w, http.StatusInternalServerError, "could not save company")
		return
	}
	httpkit.WriteJSON(w, http.StatusOK, company)
}

func (s *Server) uploadCompanyLogo(w http.ResponseWriter, r *http.Request) {
	data, contentType, ok := httpkit.ReadLogoUpload(w, r)
	if !ok {
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), httpkit.RequestTimeout)
	defer cancel()
	company, err := s.store.SaveCompanyLogo(ctx, r.PathValue("id"), contentType, data)
	if errors.Is(err, jobs.ErrInvalidInput) {
		httpkit.WriteError(w, http.StatusBadRequest, httpkit.InvalidLogo)
		return
	}
	if errors.Is(err, jobs.ErrNotFound) {
		httpkit.WriteError(w, http.StatusNotFound, "company not found")
		return
	}
	if err != nil {
		slog.Error("upload company logo", "error", err)
		httpkit.WriteError(w, http.StatusInternalServerError, "could not save logo")
		return
	}
	httpkit.WriteJSON(w, http.StatusOK, company)
}

func (s *Server) deleteCompanyLogo(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), httpkit.RequestTimeout)
	defer cancel()
	company, err := s.store.ClearCompanyLogo(ctx, r.PathValue("id"))
	if errors.Is(err, jobs.ErrNotFound) {
		httpkit.WriteError(w, http.StatusNotFound, "company not found")
		return
	}
	if err != nil {
		slog.Error("delete company logo", "error", err)
		httpkit.WriteError(w, http.StatusInternalServerError, "could not remove logo")
		return
	}
	httpkit.WriteJSON(w, http.StatusOK, company)
}
