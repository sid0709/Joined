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
	"github.com/sid0709/OpenSeat/backend-core/killswitch"
)

const maxAuthBody = 16 << 10

// AccountsStore defines the subset of auth.Store methods used by Handlers.
// Both *auth.Store and test mocks implement this interface.
type AccountsStore interface {
	// Email auth methods (AuthStore interface)
	EmailSignup(ctx context.Context, email, password, name, role string, now time.Time) (string, bool, error)
	CreateVerificationToken(ctx context.Context, userID string, now time.Time) (string, error)
	VerifyEmail(ctx context.Context, token string, now time.Time) error
	EmailSignin(ctx context.Context, email, password, audience string, now time.Time) (string, auth.Session, error)
	RequestPasswordReset(ctx context.Context, email string, now time.Time) (string, error)
	ResetPassword(ctx context.Context, token, newPassword string, now time.Time) error

	// Session and account methods
	Signout(ctx context.Context, token string) error
	Session(ctx context.Context, token string, now time.Time) (auth.Session, error)
	DeleteAccount(ctx context.Context, token string, now time.Time) error
	ExportAccount(ctx context.Context, token string, now time.Time) (auth.AccountExport, error)

	// Company methods
	AttachCompany(ctx context.Context, token string, choice auth.CompanyChoice, now time.Time) (auth.Session, error)
	InvitedCompanies(ctx context.Context, token string, now time.Time) ([]auth.Company, error)

	// Google auth methods
	SaveGoogleState(ctx context.Context, state string, saved auth.GoogleState, now time.Time) error
	TakeGoogleState(ctx context.Context, state string, now time.Time) (auth.GoogleState, error)
	GoogleSignin(ctx context.Context, identity auth.GoogleIdentity, audience, newRole string, now time.Time) (string, auth.Session, error)
	GoogleUserExists(ctx context.Context, identity auth.GoogleIdentity) (bool, error)
}

// Handlers are the identity routes of one app.
type Handlers struct {
	Accounts AccountsStore
	// Audience is the app these routes sign in to: auth.AudienceJoined or
	// auth.RoleScout. Sign-in is pinned to it, and sign-up only creates
	// accounts that app can use.
	Audience string
	// CompanyCreated, when set, runs after a sign-up or company link starts a new company page.
	CompanyCreated func(context.Context, auth.Session)
	// Google turns on Sign in with Google. Nil, or without credentials, answers 503.
	Google *GoogleSignIn
	// Email turns on email authentication. Nil answers 503.
	Email *EmailAuth
	// Switches can turn off sign-up and outbound email without a deploy. Nil leaves them on.
	Switches killswitch.Switches
}

type authResponse struct {
	Token   string       `json:"token,omitempty"`
	Session auth.Session `json:"session"`
}

// Register adds Sign in with Google (the only way to sign in or sign up),
// email sign-up and sign-in, sign-out, the session, and account deletion.
func (h Handlers) Register(mux *http.ServeMux) {
	mux.HandleFunc("POST /v1/auth/google/start", h.startGoogle)
	mux.HandleFunc("POST /v1/auth/google/callback", h.finishGoogle)
	mux.HandleFunc("POST /v1/auth/signup", h.signup)
	mux.HandleFunc("POST /v1/auth/verify", h.verifyEmail)
	mux.HandleFunc("POST /v1/auth/signin", h.emailSignin)
	mux.HandleFunc("POST /v1/auth/password/reset-request", h.requestPasswordReset)
	mux.HandleFunc("POST /v1/auth/password/reset", h.resetPassword)
	mux.HandleFunc("POST /v1/auth/signout", h.signout)
	mux.HandleFunc("DELETE /v1/auth/account", h.deleteAccount)
	mux.HandleFunc("GET /v1/auth/account/export", h.exportAccount)
	mux.HandleFunc("GET /v1/auth/session", h.session)
}

// RegisterCompanies adds creating a company, redeeming an invite, and listing those invites.
func (h Handlers) RegisterCompanies(mux *http.ServeMux) {
	mux.HandleFunc("POST /v1/auth/company", h.attachCompany)
	mux.HandleFunc("GET /v1/auth/companies", h.searchCompanies)
}

func (h Handlers) signout(w http.ResponseWriter, r *http.Request) {
	if err := h.Accounts.Signout(r.Context(), httpkit.BearerToken(r)); err != nil {
		slog.Error("sign out", "error", err)
		httpkit.WriteError(w, http.StatusInternalServerError, "could not sign out")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (h Handlers) exportAccount(w http.ResponseWriter, r *http.Request) {
	bundle, err := h.Accounts.ExportAccount(r.Context(), httpkit.BearerToken(r), time.Now())
	if errors.Is(err, auth.ErrInvalidLogin) {
		httpkit.WriteError(w, http.StatusUnauthorized, "sign in required")
		return
	}
	if errors.Is(err, auth.ErrExportLimited) {
		httpkit.WriteError(w, http.StatusTooManyRequests, "export rate limited")
		return
	}
	if err != nil {
		slog.Error("account export", "error", err)
		httpkit.WriteError(w, http.StatusInternalServerError, "could not export the account")
		return
	}
	httpkit.WriteJSON(w, http.StatusOK, bundle)
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
	companies, err := h.Accounts.InvitedCompanies(r.Context(), httpkit.BearerToken(r), time.Now())
	if errors.Is(err, auth.ErrInvalidLogin) || errors.Is(err, auth.ErrWrongRole) {
		writeAuthResult(w, "", auth.Session{}, err)
		return
	}
	if err != nil {
		slog.Error("invited companies", "error", err)
		httpkit.WriteError(w, http.StatusInternalServerError, "could not load company invites")
		return
	}
	httpkit.WriteJSON(w, http.StatusOK, map[string]any{"companies": companies})
}

func (h Handlers) companyCreated(ctx context.Context, session auth.Session) {
	if h.CompanyCreated != nil {
		h.CompanyCreated(ctx, session)
	}
}

func (h Handlers) blocked(w http.ResponseWriter, r *http.Request, name killswitch.Name) bool {
	if killswitch.On(h.Switches, r.Context(), name) {
		return false
	}
	killswitch.WriteDisabled(w, name)
	return true
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
	case errors.Is(err, auth.ErrHasCompany), errors.Is(err, auth.ErrGoogleMismatch):
		httpkit.WriteError(w, http.StatusConflict, err.Error())
	case errors.Is(err, auth.ErrWrongRole), errors.Is(err, auth.ErrInviteRequired):
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

// Ensure auth.Store implements AccountsStore
var _ AccountsStore = (*auth.Store)(nil)
