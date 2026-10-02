package httpapi

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
	"github.com/sid0709/OpenSeat/backend-core/google"
	"github.com/sid0709/OpenSeat/backend-core/httpkit"
)

const (
	// staffSessionHeader carries the staff member's session. Authorization already
	// carries the admin API token, so the console sends the session beside it.
	staffSessionHeader = "X-Admin-Session"
	staffAuthPrefix    = "/v1/auth/"
	staffGoogleTimeout = 30 * time.Second
	maxStaffAuthBody   = 16 << 10
)

// StaffSignIn is Sign in with Google for the staff console. Only accounts that
// Domain's Google Workspace manages get in.
type StaffSignIn struct {
	Accounts *auth.Store
	OAuth    *google.Client
	// RedirectURL is the console's callback page, registered on the OAuth client.
	RedirectURL string
	// Domain is the staff Google Workspace domain, like joinedhq.com.
	Domain string
}

// Required reports whether the console needs staff to sign in. Without a Google
// client the API trusts whoever holds the admin token, as before.
func (s StaffSignIn) Required() bool {
	return s.Accounts != nil && s.OAuth.Configured() && s.RedirectURL != ""
}

type staffSessionView struct {
	Required bool        `json:"required"`
	Staff    *auth.Staff `json:"staff"`
}

func (s *Server) registerStaffAuth(api *http.ServeMux) {
	api.HandleFunc("POST /v1/auth/google/start", s.startStaffGoogle)
	api.HandleFunc("POST /v1/auth/google/callback", s.finishStaffGoogle)
	api.HandleFunc("GET /v1/auth/session", s.staffSession)
	api.HandleFunc("POST /v1/auth/signout", s.staffSignout)
}

// requireStaff lets a request through only with a live staff session once sign-in
// is required, and records that person as the actor on whatever they decide.
func (s *Server) requireStaff(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if !s.staffAuth.Required() || strings.HasPrefix(r.URL.Path, staffAuthPrefix) {
			next.ServeHTTP(w, r)
			return
		}
		staff, err := s.staffAuth.Accounts.StaffSession(r.Context(), r.Header.Get(staffSessionHeader), time.Now())
		if errors.Is(err, auth.ErrInvalidLogin) {
			httpkit.WriteError(w, http.StatusUnauthorized, "staff sign-in required")
			return
		}
		if err != nil {
			slog.Error("staff session", "error", err)
			httpkit.WriteError(w, http.StatusInternalServerError, "could not check the staff session")
			return
		}
		r.Header.Set(adminActorHeader, staff.Email)
		next.ServeHTTP(w, r)
	})
}

func (s *Server) startStaffGoogle(w http.ResponseWriter, r *http.Request) {
	if !s.staffAuth.Required() {
		httpkit.WriteError(w, http.StatusServiceUnavailable, "Google sign-in is not set up")
		return
	}
	state, err := google.NewState()
	if err != nil {
		slog.Error("google state", "error", err)
		httpkit.WriteError(w, http.StatusInternalServerError, "could not start Google sign-in")
		return
	}
	verifier, challenge, err := google.NewVerifier()
	if err != nil {
		slog.Error("google verifier", "error", err)
		httpkit.WriteError(w, http.StatusInternalServerError, "could not start Google sign-in")
		return
	}
	if err := s.staffAuth.Accounts.SaveGoogleState(r.Context(), state, verifier, time.Now()); err != nil {
		slog.Error("save google state", "error", err)
		httpkit.WriteError(w, http.StatusInternalServerError, "could not start Google sign-in")
		return
	}
	httpkit.WriteJSON(w, http.StatusOK, map[string]string{
		"url": s.staffAuth.OAuth.AuthURL(google.AuthRequest{
			RedirectURL:   s.staffAuth.RedirectURL,
			Scopes:        []string{google.ScopeOpenID, google.ScopeEmail, google.ScopeProfile},
			State:         state,
			CodeChallenge: challenge,
			HostedDomain:  s.staffAuth.Domain,
		}),
		"state": state,
	})
}

// finishStaffGoogle trades the code from Google's redirect for a staff session.
func (s *Server) finishStaffGoogle(w http.ResponseWriter, r *http.Request) {
	if !s.staffAuth.Required() {
		httpkit.WriteError(w, http.StatusServiceUnavailable, "Google sign-in is not set up")
		return
	}
	var body struct {
		Code  string `json:"code"`
		State string `json:"state"`
	}
	decoder := json.NewDecoder(http.MaxBytesReader(w, r.Body, maxStaffAuthBody))
	if err := decoder.Decode(&body); err != nil && !errors.Is(err, io.EOF) {
		httpkit.WriteError(w, http.StatusBadRequest, "invalid request")
		return
	}
	now := time.Now()
	verifier, err := s.staffAuth.Accounts.TakeGoogleState(r.Context(), body.State, now)
	if err != nil {
		writeStaffGoogleFailure(w, err)
		return
	}
	ctx, cancel := context.WithTimeout(r.Context(), staffGoogleTimeout)
	defer cancel()
	token, err := s.staffAuth.OAuth.Exchange(ctx, body.Code, s.staffAuth.RedirectURL, verifier)
	if err != nil {
		writeStaffGoogleFailure(w, err)
		return
	}
	profile, err := s.staffAuth.OAuth.Profile(ctx, token.AccessToken)
	if err != nil {
		writeStaffGoogleFailure(w, err)
		return
	}
	sessionToken, staff, err := s.staffAuth.Accounts.StaffSignin(ctx, auth.GoogleIdentity{
		Subject:       profile.Subject,
		Email:         profile.Email,
		EmailVerified: profile.EmailVerified,
		Name:          profile.Name,
	}, profile.HostedDomain, s.staffAuth.Domain, now)
	if err != nil {
		writeStaffGoogleFailure(w, err)
		return
	}
	slog.Info("staff signed in", "email", staff.Email)
	httpkit.WriteJSON(w, http.StatusOK, map[string]any{"token": sessionToken, "staff": staff})
}

// staffSession says whether the console needs sign-in and who is signed in.
func (s *Server) staffSession(w http.ResponseWriter, r *http.Request) {
	if !s.staffAuth.Required() {
		httpkit.WriteJSON(w, http.StatusOK, staffSessionView{})
		return
	}
	staff, err := s.staffAuth.Accounts.StaffSession(r.Context(), r.Header.Get(staffSessionHeader), time.Now())
	if errors.Is(err, auth.ErrInvalidLogin) {
		httpkit.WriteError(w, http.StatusUnauthorized, "staff sign-in required")
		return
	}
	if err != nil {
		slog.Error("staff session", "error", err)
		httpkit.WriteError(w, http.StatusInternalServerError, "could not check the staff session")
		return
	}
	httpkit.WriteJSON(w, http.StatusOK, staffSessionView{Required: true, Staff: &staff})
}

func (s *Server) staffSignout(w http.ResponseWriter, r *http.Request) {
	if s.staffAuth.Accounts != nil {
		if err := s.staffAuth.Accounts.StaffSignout(r.Context(), r.Header.Get(staffSessionHeader)); err != nil {
			slog.Error("staff sign out", "error", err)
			httpkit.WriteError(w, http.StatusInternalServerError, "could not sign out")
			return
		}
	}
	w.WriteHeader(http.StatusNoContent)
}

// writeStaffGoogleFailure answers a staff sign-in that did not finish. The status
// codes match what @joined/google-signin turns into a message.
func writeStaffGoogleFailure(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, auth.ErrGoogleState), errors.Is(err, google.ErrInvalidGrant):
		httpkit.WriteError(w, http.StatusBadRequest, auth.ErrGoogleState.Error())
	case errors.Is(err, auth.ErrNotStaff), errors.Is(err, auth.ErrInvalidInput):
		httpkit.WriteError(w, http.StatusForbidden, auth.ErrNotStaff.Error())
	default:
		slog.Error("staff google sign-in", "error", err)
		httpkit.WriteError(w, http.StatusBadGateway, "could not reach Google; try again")
	}
}
