// Package httpapi is the Scoutwell API: scout accounts and the scout submission
// protocol, for scoutwell-frontend and partners holding scout API keys.
package httpapi

import (
	"net/http"

	"github.com/sid0709/OpenSeat/backend-core/auth"
	"github.com/sid0709/OpenSeat/backend-core/authapi"
	"github.com/sid0709/OpenSeat/backend-core/google"
	"github.com/sid0709/OpenSeat/backend-core/httpkit"
	"github.com/sid0709/OpenSeat/backend-core/jobs"
	"github.com/sid0709/OpenSeat/backend-core/scout"
)

type Server struct {
	store  *jobs.Store
	auth   *auth.Store
	scouts *scout.Store
}

// Options are the HTTP server's settings.
type Options struct {
	Origins []string
	// Google is the OAuth client behind Sign in with Google.
	Google *google.Client
	// GoogleRedirectURL is scoutwell-frontend's Google sign-in callback page.
	GoogleRedirectURL string
}

func New(store *jobs.Store, accounts *auth.Store, scouts *scout.Store, opts Options) http.Handler {
	server := &Server{store: store, auth: accounts, scouts: scouts}
	mux := http.NewServeMux()
	mux.HandleFunc("GET /health", httpkit.Health(store))
	authapi.Handlers{
		Accounts: accounts,
		Audience: auth.RoleScout,
		Google: &authapi.GoogleSignIn{
			OAuth:       opts.Google,
			RedirectURL: opts.GoogleRedirectURL,
			Roles:       []string{auth.RoleScout},
		},
	}.Register(mux)
	server.registerScout(mux)
	return httpkit.CORS(opts.Origins, mux)
}
