package acornapi

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"time"

	"github.com/sid0709/OpenSeat/acorn-backend/account"
	"github.com/sid0709/OpenSeat/backend-core/google"
)

// googleTimeout bounds the code exchange and profile read with Google.
const googleTimeout = 30 * time.Second

var googleSignInScopes = []string{google.ScopeOpenID, google.ScopeEmail, google.ScopeProfile}

func (s *Server) googleReady() bool {
	return s.google.Configured() && s.googleRedirect != ""
}

// startGoogle answers the URL to send the browser to, and the state the frontend
// keeps in a cookie to check the redirect against.
func (s *Server) startGoogle(w http.ResponseWriter, r *http.Request) {
	if !s.googleReady() {
		writeError(w, http.StatusServiceUnavailable, "Google sign-in is not set up")
		return
	}
	var body struct {
		Mode string `json:"mode"`
	}
	if !decode(w, r, &body) {
		return
	}
	state, err := google.NewState()
	if err != nil {
		slog.Error("google state", "error", err)
		writeError(w, http.StatusInternalServerError, "could not start Google sign-in")
		return
	}
	verifier, challenge, err := google.NewVerifier()
	if err != nil {
		slog.Error("google verifier", "error", err)
		writeError(w, http.StatusInternalServerError, "could not start Google sign-in")
		return
	}
	if err := s.accounts.SaveGoogleState(r.Context(), state, verifier, time.Now()); err != nil {
		slog.Error("save google state", "error", err)
		writeError(w, http.StatusInternalServerError, "could not start Google sign-in")
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{
		"url": s.google.AuthURL(google.AuthRequest{
			RedirectURL:   s.googleRedirect,
			Scopes:        googleSignInScopes,
			State:         state,
			CodeChallenge: challenge,
		}),
		"state": state,
	})
}

// finishGoogle trades the code from Google's redirect for an Acorn session.
func (s *Server) finishGoogle(w http.ResponseWriter, r *http.Request) {
	if !s.googleReady() {
		writeError(w, http.StatusServiceUnavailable, "Google sign-in is not set up")
		return
	}
	var body struct {
		Code  string `json:"code"`
		State string `json:"state"`
	}
	if !decode(w, r, &body) {
		return
	}
	now := time.Now()
	verifier, err := s.accounts.TakeGoogleState(r.Context(), body.State, now)
	if err != nil {
		writeGoogleAccountError(w, err)
		return
	}
	ctx, cancel := context.WithTimeout(r.Context(), googleTimeout)
	defer cancel()
	token, err := s.google.Exchange(ctx, body.Code, s.googleRedirect, verifier)
	if err != nil {
		writeGoogleReachError(w, err)
		return
	}
	profile, err := s.google.Profile(ctx, token.AccessToken)
	if err != nil {
		writeGoogleReachError(w, err)
		return
	}
	sessionToken, user, err := s.accounts.GoogleSignIn(ctx, account.GoogleIdentity{
		Subject:       profile.Subject,
		Email:         profile.Email,
		EmailVerified: profile.EmailVerified,
		Name:          profile.Name,
	}, now)
	if err != nil {
		writeGoogleAccountError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, sessionBody(sessionToken, user))
}

func writeGoogleAccountError(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, account.ErrGoogleState), errors.Is(err, account.ErrInvalid):
		writeError(w, http.StatusBadRequest, err.Error())
	case errors.Is(err, account.ErrGoogleMismatch), errors.Is(err, account.ErrEmailTaken):
		writeError(w, http.StatusConflict, err.Error())
	default:
		slog.Error("google sign-in", "error", err)
		writeError(w, http.StatusInternalServerError, "could not complete sign in")
	}
}

func writeGoogleReachError(w http.ResponseWriter, err error) {
	if errors.Is(err, google.ErrInvalidGrant) {
		writeError(w, http.StatusBadRequest, account.ErrGoogleState.Error())
		return
	}
	slog.Error("google sign-in", "error", err)
	writeError(w, http.StatusBadGateway, "could not reach Google; try again")
}
