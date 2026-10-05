package authapi

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"slices"
	"time"

	"github.com/sid0709/OpenSeat/backend-core/auth"
	"github.com/sid0709/OpenSeat/backend-core/google"
	"github.com/sid0709/OpenSeat/backend-core/httpkit"
	"github.com/sid0709/OpenSeat/backend-core/killswitch"
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
	// Roles are the kinds of account a sign-up may create, asked for as "mode" when
	// the sign-in starts. The first is the default. Existing accounts sign in as
	// whatever they are, if the app's audience accepts it.
	Roles []string
	// Scopes asks for more than signing in, like the job hunter's calendar. They are
	// asked for unless the sign-up chose another role than the default.
	Scopes []string
	// Granted, when set, receives the tokens after a successful sign-in, so the
	// app can keep the extra scopes. A failure there never fails the sign-in.
	Granted func(ctx context.Context, session auth.Session, profile google.Profile, token google.Token)
}

var signInScopes = []string{google.ScopeOpenID, google.ScopeEmail, google.ScopeProfile}

func (g *GoogleSignIn) configured() bool {
	return g != nil && g.OAuth.Configured() && g.RedirectURL != "" && len(g.Roles) > 0
}

// newRole is the kind of account a sign-up that asked for mode creates: mode when
// this app offers it, otherwise the app's default.
func (g *GoogleSignIn) newRole(mode string) string {
	if slices.Contains(g.Roles, mode) {
		return mode
	}
	return g.Roles[0]
}

type googleStart struct {
	URL   string `json:"url"`
	State string `json:"state"`
}

// startGoogle answers the URL to send the browser to, and the state the
// frontend keeps in a cookie to check the redirect against. The body may ask for
// the kind of account ("mode") to create if this is someone new.
func (h Handlers) startGoogle(w http.ResponseWriter, r *http.Request) {
	if !h.Google.configured() {
		httpkit.WriteError(w, http.StatusServiceUnavailable, "Google sign-in is not set up")
		return
	}
	var body struct {
		Mode string `json:"mode"`
	}
	if !decodeAuth(w, r, &body) {
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
	saved := auth.GoogleState{Verifier: verifier, Role: h.Google.newRole(body.Mode)}
	if err := h.Accounts.SaveGoogleState(r.Context(), state, saved, time.Now()); err != nil {
		slog.Error("save google state", "error", err)
		httpkit.WriteError(w, http.StatusInternalServerError, "could not start Google sign-in")
		return
	}
	scopes := append([]string{}, signInScopes...)
	extra := saved.Role == h.Google.Roles[0]
	if extra {
		scopes = append(scopes, h.Google.Scopes...)
	}
	httpkit.WriteJSON(w, http.StatusOK, googleStart{
		URL: h.Google.OAuth.AuthURL(google.AuthRequest{
			RedirectURL:   h.Google.RedirectURL,
			Scopes:        scopes,
			State:         state,
			CodeChallenge: challenge,
			// Extra scopes are used later, without the person, so they need a refresh token.
			Offline: extra && len(h.Google.Scopes) > 0,
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
	saved, err := h.Accounts.TakeGoogleState(r.Context(), body.State, now)
	if err != nil {
		writeGoogleFailure(w, err)
		return
	}
	ctx, cancel := context.WithTimeout(r.Context(), googleTimeout)
	defer cancel()
	token, err := h.Google.OAuth.Exchange(ctx, body.Code, h.Google.RedirectURL, saved.Verifier)
	if err != nil {
		writeGoogleFailure(w, err)
		return
	}
	profile, err := h.Google.OAuth.Profile(ctx, token.AccessToken)
	if err != nil {
		writeGoogleFailure(w, err)
		return
	}
	identity := auth.GoogleIdentity{
		Subject:       profile.Subject,
		Email:         profile.Email,
		EmailVerified: profile.EmailVerified,
		Name:          profile.Name,
	}
	if !killswitch.On(h.Switches, r.Context(), killswitch.Signup) {
		exists, existsErr := h.Accounts.GoogleUserExists(ctx, identity)
		if existsErr != nil {
			slog.Error("google signup check", "error", existsErr)
			httpkit.WriteError(w, http.StatusInternalServerError, "could not complete sign in")
			return
		}
		if !exists {
			killswitch.WriteDisabled(w, killswitch.Signup)
			return
		}
	}
	sessionToken, session, err := h.Accounts.GoogleSignin(ctx, identity, h.Audience, saved.Role, now)
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
