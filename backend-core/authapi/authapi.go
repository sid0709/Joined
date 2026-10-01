// Package authapi serves the /v1/auth routes. Joined and Scoutwell share one
// account store, and each service serves these routes for its own audience.
package authapi

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"log/slog"
	"net/http"
	"strings"
	"time"

	"github.com/sid0709/OpenSeat/backend-core/auth"
	"github.com/sid0709/OpenSeat/backend-core/httpkit"
)

const maxAuthBody = 16 << 10

// Handlers are the identity routes of one app.
type Handlers struct {
	Accounts *auth.Store
	// Audience is the app these routes sign in to: auth.AudienceJoined or
	// auth.RoleScout. Sign-in is pinned to it, and sign-up only creates
	// accounts that app can use.
	Audience string
	// CompanyCreated, when set, runs after a sign-up or company link starts a new company page.
	CompanyCreated func(context.Context, auth.Session)
}

type authResponse struct {
	Token   string       `json:"token,omitempty"`
	Session auth.Session `json:"session"`
}

// Register adds sign-up, sign-in, sign-out, the session, and account deletion.
func (h Handlers) Register(mux *http.ServeMux) {
	mux.HandleFunc("POST /v1/auth/signup", h.signup)
	mux.HandleFunc("POST /v1/auth/signin", h.signin)
	mux.HandleFunc("POST /v1/auth/signout", h.signout)
	mux.HandleFunc("DELETE /v1/auth/account", h.deleteAccount)
	mux.HandleFunc("GET /v1/auth/session", h.session)
}

// RegisterCompanies adds linking an account to a company and the search behind it.
func (h Handlers) RegisterCompanies(mux *http.ServeMux) {
	mux.HandleFunc("POST /v1/auth/company", h.attachCompany)
	mux.HandleFunc("GET /v1/auth/companies", h.searchCompanies)
}

func (h Handlers) signup(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Name     string `json:"name"`
		Email    string `json:"email"`
		Password string `json:"password"`
		Mode     string `json:"mode"`
		Company  *struct {
			ID   string `json:"id"`
			Name string `json:"name"`
			URL  string `json:"url"`
		} `json:"company"`
	}
	if !decodeAuth(w, r, &body) {
		return
	}
	mode, ok := h.signupMode(body.Mode)
	if !ok {
		writeAuthResult(w, "", auth.Session{}, auth.ErrInvalidInput)
		return
	}
	input := auth.Signup{Name: body.Name, Email: body.Email, Password: body.Password, Mode: mode}
	if body.Company != nil {
		input.Company = &auth.CompanyChoice{ID: body.Company.ID, Name: body.Company.Name, URL: body.Company.URL}
	}
	token, session, err := h.Accounts.Signup(r.Context(), input, time.Now())
	if err == nil && body.Company != nil && strings.TrimSpace(body.Company.ID) == "" {
		h.companyCreated(r.Context(), session)
	}
	writeAuthResult(w, token, session, err)
}

// signupMode is the kind of account a sign-up through this app creates. Scoutwell
// only creates scouts; Joined creates job hunters and recruiters, never scouts.
func (h Handlers) signupMode(requested string) (string, bool) {
	if h.Audience == auth.RoleScout {
		return auth.RoleScout, true
	}
	return requested, requested != auth.RoleScout
}

func (h Handlers) signin(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Email    string `json:"email"`
		Password string `json:"password"`
	}
	if !decodeAuth(w, r, &body) {
		return
	}
	token, session, err := h.Accounts.Signin(r.Context(), body.Email, body.Password, h.Audience, time.Now())
	writeAuthResult(w, token, session, err)
}

func (h Handlers) signout(w http.ResponseWriter, r *http.Request) {
	if err := h.Accounts.Signout(r.Context(), httpkit.BearerToken(r)); err != nil {
		slog.Error("sign out", "error", err)
		httpkit.WriteError(w, http.StatusInternalServerError, "could not sign out")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (h Handlers) deleteAccount(w http.ResponseWriter, r *http.Request) {
	err := h.Accounts.DeleteAccount(r.Context(), httpkit.BearerToken(r), time.Now())
	if errors.Is(err, auth.ErrInvalidLogin) {
		httpkit.WriteError(w, http.StatusUnauthorized, "sign in required")
		return
	}
	if err != nil {
		slog.Error("delete account", "error", err)
		httpkit.WriteError(w, http.StatusInternalServerError, "could not remove the account")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (h Handlers) session(w http.ResponseWriter, r *http.Request) {
	session, err := h.Accounts.Session(r.Context(), httpkit.BearerToken(r), time.Now())
	if errors.Is(err, auth.ErrInvalidLogin) {
		httpkit.WriteError(w, http.StatusUnauthorized, "sign in required")
		return
	}
	if err != nil {
		slog.Error("session", "error", err)
		httpkit.WriteError(w, http.StatusInternalServerError, "could not load the session")
		return
	}
	httpkit.WriteJSON(w, http.StatusOK, session)
}

func (h Handlers) attachCompany(w http.ResponseWriter, r *http.Request) {
	var body struct {
		ID   string `json:"id"`
		Name string `json:"name"`
		URL  string `json:"url"`
	}
	if !decodeAuth(w, r, &body) {
		return
	}
	session, err := h.Accounts.AttachCompany(r.Context(), httpkit.BearerToken(r), auth.CompanyChoice{
		ID:   body.ID,
		Name: body.Name,
		URL:  body.URL,
	}, time.Now())
	if errors.Is(err, auth.ErrInvalidLogin) {
		httpkit.WriteError(w, http.StatusUnauthorized, "sign in required")
		return
	}
	if err == nil && strings.TrimSpace(body.ID) == "" {
		h.companyCreated(r.Context(), session)
	}
	writeAuthResult(w, "", session, err)
}

func (h Handlers) searchCompanies(w http.ResponseWriter, r *http.Request) {
	companies, err := h.Accounts.SearchCompanies(r.Context(), r.URL.Query().Get("q"))
	if err != nil {
		slog.Error("search companies", "error", err)
		httpkit.WriteError(w, http.StatusInternalServerError, "could not search companies")
		return
	}
	httpkit.WriteJSON(w, http.StatusOK, map[string]any{"companies": companies})
}

func (h Handlers) companyCreated(ctx context.Context, session auth.Session) {
	if h.CompanyCreated != nil {
		h.CompanyCreated(ctx, session)
	}
}

func writeAuthResult(w http.ResponseWriter, token string, session auth.Session, err error) {
	switch {
	case err == nil:
		httpkit.WriteJSON(w, http.StatusOK, authResponse{Token: token, Session: session})
	case errors.Is(err, auth.ErrEmailTaken):
		httpkit.WriteError(w, http.StatusConflict, err.Error())
	case errors.Is(err, auth.ErrInvalidLogin):
		httpkit.WriteError(w, http.StatusUnauthorized, err.Error())
	case errors.Is(err, auth.ErrInvalidInput):
		httpkit.WriteError(w, http.StatusBadRequest, err.Error())
	case errors.Is(err, auth.ErrNotFound):
		httpkit.WriteError(w, http.StatusNotFound, "company not found")
	case errors.Is(err, auth.ErrHasCompany):
		httpkit.WriteError(w, http.StatusConflict, err.Error())
	case errors.Is(err, auth.ErrWrongRole):
		httpkit.WriteError(w, http.StatusForbidden, err.Error())
	default:
		slog.Error("auth", "error", err)
		httpkit.WriteError(w, http.StatusInternalServerError, "could not complete sign in")
	}
}

func decodeAuth(w http.ResponseWriter, r *http.Request, dest any) bool {
	decoder := json.NewDecoder(http.MaxBytesReader(w, r.Body, maxAuthBody))
	if err := decoder.Decode(dest); err != nil && !errors.Is(err, io.EOF) {
		httpkit.WriteError(w, http.StatusBadRequest, "invalid request")
		return false
	}
	return true
}
