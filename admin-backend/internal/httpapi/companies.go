package httpapi

import (
	"context"
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"

	"github.com/sid0709/OpenSeat/backend-core/httpkit"
	"github.com/sid0709/OpenSeat/backend-core/jobs"
)

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
