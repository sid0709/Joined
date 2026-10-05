// Package httpapi is the Scoutwell API: scout accounts and the scout submission
// protocol, for scoutwell-frontend and partners holding scout API keys.
package httpapi

import (
	"context"
	"net/http"
	"time"

	"github.com/sid0709/OpenSeat/backend-core/auth"
	"github.com/sid0709/OpenSeat/backend-core/authapi"
	"github.com/sid0709/OpenSeat/backend-core/google"
	"github.com/sid0709/OpenSeat/backend-core/httpkit"
	"github.com/sid0709/OpenSeat/backend-core/jobs"
	"github.com/sid0709/OpenSeat/backend-core/scout"
)

// SessionCookie is the Scoutwell session cookie the website and extension send.
const SessionCookie = "scoutwell_session"

// sessions looks up a live session token. *auth.Store implements it.
type sessions interface {
	SessionUserID(ctx context.Context, token string, now time.Time) (string, error)
}

type Server struct {
	store    *jobs.Store
	auth     *auth.Store
	sessions sessions
	scouts   *scout.Store
	cookie   string
}

// Options are the HTTP server's settings.
type Options struct {
	Origins []string
	// ExtensionOrigins are chrome-extension:// origins allowed to call Scoutwell.
	// They are merged into Origins for CORS; there is no wildcard.
	ExtensionOrigins []string
	// SessionCookie overrides the Scoutwell session cookie name.
	SessionCookie string
	// Google is the OAuth client behind Sign in with Google.
	Google *google.Client
	// GoogleRedirectURL is scoutwell-frontend's Google sign-in callback page.
	GoogleRedirectURL string
	// PayoutWebhook receives signed provider status callbacks.
	PayoutWebhook http.Handler
}

func New(store *jobs.Store, accounts *auth.Store, scouts *scout.Store, opts Options) http.Handler {
	var lookups sessions
	if accounts != nil {
		lookups = accounts
	}
	return newHandler(store, accounts, lookups, scouts, opts)
}

func newHandler(store *jobs.Store, accounts *auth.Store, lookups sessions, scouts *scout.Store, opts Options) http.Handler {
	cookie := opts.SessionCookie
	if cookie == "" {
		cookie = SessionCookie
	}
	server := &Server{store: store, auth: accounts, sessions: lookups, scouts: scouts, cookie: cookie}
	mux := http.NewServeMux()
	mux.HandleFunc("GET /health", httpkit.Health(store))
	if accounts != nil {
		authapi.Handlers{
			Accounts: accounts,
			Audience: auth.RoleScout,
			Google: &authapi.GoogleSignIn{
				OAuth:       opts.Google,
				RedirectURL: opts.GoogleRedirectURL,
				Roles:       []string{auth.RoleScout},
			},
		}.Register(mux)
	}
	server.registerScout(mux)
	if opts.PayoutWebhook != nil {
		mux.Handle("POST "+scout.PayoutWebhookPath, opts.PayoutWebhook)
	}
	origins := append(append([]string{}, opts.Origins...), opts.ExtensionOrigins...)
	return httpkit.CORS(origins, mux)
}
