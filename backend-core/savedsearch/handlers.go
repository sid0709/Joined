package savedsearch

import (
	"encoding/json"
	"errors"
	"io"
	"log/slog"
	"net/http"
	"time"

	"github.com/sid0709/OpenSeat/backend-core/httpkit"
)

const (
	listPath   = "GET /v1/me/saved-searches"
	createPath = "POST /v1/me/saved-searches"
	getPath    = "GET /v1/me/saved-searches/{id}"
	patchPath  = "PATCH /v1/me/saved-searches/{id}"
	deletePath = "DELETE /v1/me/saved-searches/{id}"
)

// CurrentUser resolves the signed-in Joined user. Return ErrUnauthorized
// when the request has no session.
type CurrentUser func(*http.Request) (userID string, err error)

// Handlers expose saved-search CRUD over HTTP. Mount on the authenticated
// candidate mux in joined-backend:
//
//	savedsearch.Handlers{Service: svc, CurrentUser: sessionUser}.Register(mux)
type Handlers struct {
	Service     *Service
	CurrentUser CurrentUser
}

// Register mounts list, create, get, patch, and delete on mux.
func (h Handlers) Register(mux *http.ServeMux) {
	mux.HandleFunc(listPath, h.list)
	mux.HandleFunc(createPath, h.create)
	mux.HandleFunc(getPath, h.get)
	mux.HandleFunc(patchPath, h.patch)
	mux.HandleFunc(deletePath, h.delete)
}

type listResponse struct {
	Searches []SavedSearch `json:"searches"`
}

func (h Handlers) list(w http.ResponseWriter, r *http.Request) {
	userID, ok := h.user(w, r)
	if !ok {
		return
	}
	items, err := h.Service.List(r.Context(), userID)
	if err != nil {
		writeError(w, err)
		return
	}
	httpkit.WriteJSON(w, http.StatusOK, listResponse{Searches: items})
}

func (h Handlers) create(w http.ResponseWriter, r *http.Request) {
	userID, ok := h.user(w, r)
	if !ok {
		return
	}
	var in Input
	if err := decodeJSONBody(r, &in); err != nil {
		httpkit.WriteError(w, http.StatusBadRequest, "invalid request")
		return
	}
	search, err := h.Service.Create(r.Context(), userID, in, time.Now())
	if err != nil {
		writeError(w, err)
		return
	}
	httpkit.WriteJSON(w, http.StatusCreated, search)
}

func (h Handlers) get(w http.ResponseWriter, r *http.Request) {
	userID, ok := h.user(w, r)
	if !ok {
		return
	}
	search, err := h.Service.Get(r.Context(), userID, r.PathValue("id"))
	if err != nil {
		writeError(w, err)
		return
	}
	httpkit.WriteJSON(w, http.StatusOK, search)
}

func (h Handlers) patch(w http.ResponseWriter, r *http.Request) {
	userID, ok := h.user(w, r)
	if !ok {
		return
	}
	var patch Patch
	if err := decodeJSONBody(r, &patch); err != nil {
		httpkit.WriteError(w, http.StatusBadRequest, "invalid request")
		return
	}
	search, err := h.Service.Update(r.Context(), userID, r.PathValue("id"), patch, time.Now())
	if err != nil {
		writeError(w, err)
		return
	}
	httpkit.WriteJSON(w, http.StatusOK, search)
}

func (h Handlers) delete(w http.ResponseWriter, r *http.Request) {
	userID, ok := h.user(w, r)
	if !ok {
		return
	}
	if err := h.Service.Delete(r.Context(), userID, r.PathValue("id")); err != nil {
		writeError(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (h Handlers) user(w http.ResponseWriter, r *http.Request) (string, bool) {
	if h.Service == nil {
		httpkit.WriteError(w, http.StatusServiceUnavailable, ErrMissingStore.Error())
		return "", false
	}
	if h.CurrentUser == nil {
		httpkit.WriteError(w, http.StatusUnauthorized, "sign in required")
		return "", false
	}
	userID, err := h.CurrentUser(r)
	if err != nil {
		writeError(w, err)
		return "", false
	}
	if userID == "" {
		httpkit.WriteError(w, http.StatusUnauthorized, "sign in required")
		return "", false
	}
	return userID, true
}

func decodeJSONBody(r *http.Request, dest any) error {
	defer r.Body.Close()
	limited := io.LimitReader(r.Body, httpkit.MaxWriteBody)
	dec := json.NewDecoder(limited)
	if err := dec.Decode(dest); err != nil {
		if errors.Is(err, io.EOF) {
			return nil
		}
		return err
	}
	return nil
}

func writeError(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, ErrUnauthorized):
		httpkit.WriteError(w, http.StatusUnauthorized, "sign in required")
	case errors.Is(err, ErrNotFound):
		httpkit.WriteError(w, http.StatusNotFound, err.Error())
	case errors.Is(err, ErrInvalidInput):
		httpkit.WriteError(w, http.StatusBadRequest, err.Error())
	case errors.Is(err, ErrLimitReached):
		httpkit.WriteError(w, http.StatusConflict, err.Error())
	case errors.Is(err, ErrMissingStore):
		httpkit.WriteError(w, http.StatusServiceUnavailable, err.Error())
	default:
		slog.Error("saved search", "error", err)
		httpkit.WriteError(w, http.StatusInternalServerError, "could not complete the request")
	}
}
