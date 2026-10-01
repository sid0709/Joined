package httpkit

import (
	"context"
	"errors"
	"io"
	"log/slog"
	"net/http"

	"github.com/sid0709/OpenSeat/backend-core/jobs"
)

// InvalidLogo is the message for a logo that is too large or not an image.
const InvalidLogo = "logo must be a PNG, JPEG, WebP, or GIF under 2 MB"

// ReadLogoUpload reads the "logo" file of a multipart form, answering 400 when
// it is missing, too large, or not an image.
func ReadLogoUpload(w http.ResponseWriter, r *http.Request) ([]byte, string, bool) {
	r.Body = http.MaxBytesReader(w, r.Body, jobs.MaxLogoBytes+64<<10)
	if err := r.ParseMultipartForm(jobs.MaxLogoBytes); err != nil {
		WriteError(w, http.StatusBadRequest, InvalidLogo)
		return nil, "", false
	}
	file, _, err := r.FormFile("logo")
	if err != nil {
		WriteError(w, http.StatusBadRequest, "choose a logo image")
		return nil, "", false
	}
	defer file.Close()
	data, err := io.ReadAll(io.LimitReader(file, jobs.MaxLogoBytes+1))
	if err != nil || len(data) > jobs.MaxLogoBytes {
		WriteError(w, http.StatusBadRequest, InvalidLogo)
		return nil, "", false
	}
	contentType := jobs.LogoContentType(data)
	if contentType == "" {
		WriteError(w, http.StatusBadRequest, InvalidLogo)
		return nil, "", false
	}
	return data, contentType, true
}

// CompanyLogo streams the stored logo of the company in the {id} path value.
func CompanyLogo(store *jobs.Store) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ctx, cancel := context.WithTimeout(r.Context(), RequestTimeout)
		defer cancel()

		body, contentType, err := store.OpenCompanyLogo(ctx, r.PathValue("id"))
		if errors.Is(err, jobs.ErrNotFound) {
			WriteError(w, http.StatusNotFound, "logo not found")
			return
		}
		if err != nil {
			slog.Error("get company logo", "error", err)
			WriteError(w, http.StatusBadGateway, "could not load logo")
			return
		}
		defer body.Close()

		w.Header().Set("Content-Type", contentType)
		w.Header().Set("Cache-Control", "private, max-age=60")
		if _, err := io.Copy(w, body); err != nil {
			slog.Error("write company logo", "error", err)
		}
	}
}
