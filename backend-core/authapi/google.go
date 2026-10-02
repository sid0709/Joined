package authapi

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"time"

	"github.com/sid0709/OpenSeat/backend-core/auth"
	"github.com/sid0709/OpenSeat/backend-core/google"
	"github.com/sid0709/OpenSeat/backend-core/httpkit"
)

// googleTimeout bounds the code exchange and profile read with Google.
const googleTimeout = 30 * time.Second

// GoogleSignIn is Sign in with Google for one app. The app's frontend owns the
// redirect: it starts the trip, checks the state on the way back, and posts the
// code here, so the session cookie lands on the app's own domain.
type GoogleSignIn struct {
	OAuth *google.Client
	// RedirectURL is the frontend's callback page, registered in Google Cloud.
	RedirectURL string
	// Role is the only kind of account this sign-in creates or accepts.
	Role string
	// Scopes asks for more than signing in, like the job hunter's calendar.
	Scopes []string
	// Granted, when set, receives the tokens after a successful sign-in, so the
	// app can keep the extra scopes. A failure there never fails the sign-in.
	Granted func(ctx context.Context, session auth.Session, profile google.Profile, token google.Token)
}

var signInScopes = []string{google.ScopeOpenID, google.ScopeEmail, google.ScopeProfile}

func (g *GoogleSignIn) configured() bool {
	return g != nil && g.OAuth.Configured() && g.RedirectURL != "" && g.Role != ""
}

type googleStart struct {
	URL   string `json:"url"`
	State string `json:"state"`
}

// startGoogle answers the URL to send the browser to, and the state the
// frontend keeps in a cookie to check the redirect against.
func (h Handlers) startGoogle(w http.ResponseWriter, r *http.Request) {
	if !h.Google.configured() {
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
	if err := h.Accounts.SaveGoogleState(r.Context(), state, verifier, time.Now()); err != nil {
		slog.Error("save google state", "error", err)
		httpkit.WriteError(w, http.StatusInternalServerError, "could not start Google sign-in")
		return
	}
	scopes := append(append([]string{}, signInScopes...), h.Google.Scopes...)
	httpkit.WriteJSON(w, http.StatusOK, googleStart{
		URL: h.Google.OAuth.AuthURL(google.AuthRequest{
			RedirectURL:   h.Google.RedirectURL,
			Scopes:        scopes,
			State:         state,
			CodeChallenge: challenge,
			// Extra scopes are used later, without the person, so they need a refresh token.
			Offline: len(h.Google.Scopes) > 0,
		}),
		State: state,
	})
}

// finishGoogle trades the code from Google's redirect for a session.
func (h Handlers) finishGoogle(w http.ResponseWriter, r *http.Request) {
	if !h.Google.configured() {
		httpkit.WriteError(w, http.StatusServiceUnavailable, "Google sign-in is not set up")
		return
	}
	var body struct {
		Code  string `json:"code"`
		State string `json:"state"`
	}
	if !decodeAuth(w, r, &body) {
		return
	}
	now := time.Now()
	verifier, err := h.Accounts.TakeGoogleState(r.Context(), body.State, now)
	if err != nil {
		writeGoogleFailure(w, err)
		return
	}
	ctx, cancel := context.WithTimeout(r.Context(), googleTimeout)
	defer cancel()
	token, err := h.Google.OAuth.Exchange(ctx, body.Code, h.Google.RedirectURL, verifier)
	if err != nil {
		writeGoogleFailure(w, err)
		return
	}
	profile, err := h.Google.OAuth.Profile(ctx, token.AccessToken)
	if err != nil {
		writeGoogleFailure(w, err)
		return
	}
	sessionToken, session, err := h.Accounts.GoogleSignin(ctx, auth.GoogleIdentity{
		Subject:       profile.Subject,
		Email:         profile.Email,
		EmailVerified: profile.EmailVerified,
		Name:          profile.Name,
	}, h.Google.Role, now)
	if err == nil && h.Google.Granted != nil {
		h.Google.Granted(ctx, session, profile, token)
	}
	writeAuthResult(w, sessionToken, session, err)
}

// writeGoogleFailure answers a sign-in that never reached an account.
func writeGoogleFailure(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, auth.ErrGoogleState), errors.Is(err, google.ErrInvalidGrant):
		httpkit.WriteError(w, http.StatusBadRequest, auth.ErrGoogleState.Error())
	default:
		slog.Error("google sign-in", "error", err)
		httpkit.WriteError(w, http.StatusBadGateway, "could not reach Google; try again")
	}
}
