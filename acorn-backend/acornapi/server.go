// Package acornapi is Acorn's HTTP API. Every route and the Socket.IO gateway live
// under Prefix, and acorn-backend's server mounts this package. Sign-in belongs
// to Acorn: acorn-frontend and the extension share that session.
package acornapi

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"strings"
	"time"

	"github.com/sid0709/OpenSeat/acorn-backend/account"
	"github.com/sid0709/OpenSeat/acorn-backend/acorn"
	"github.com/sid0709/OpenSeat/acorn-backend/acornapi/gateway"
	"github.com/sid0709/OpenSeat/backend-core/google"
	"github.com/sid0709/OpenSeat/backend-core/httpkit"
	"github.com/sid0709/OpenSeat/backend-core/jobs"
	"github.com/sid0709/OpenSeat/backend-core/killswitch"
)

const (
	// Prefix is the path every Acorn route starts with.
	Prefix = "/acorn"

	// GooglePrefix is where @joined/google-signin calls this API. The frontend
	// owns the browser redirect; these two routes only start and finish it.
	GooglePrefix = "/v1/auth/google"

	// DefaultSessionCookie is the cookie acorn-frontend keeps the Acorn session token in.
	DefaultSessionCookie = "acorn_session"

	// maxBody bounds a request body; a pure tree is the largest thing the extension sends.
	maxBody = 16 << 20
)

// Accounts is Acorn's own sign-in and the jobs that account has saved or applied to.
// *account.Store is the real one.
type Accounts interface {
	Session(ctx context.Context, token string, now time.Time) (account.Session, error)
	SignUp(ctx context.Context, name, email, password string, now time.Time) (string, account.User, error)
	SignIn(ctx context.Context, email, password string, now time.Time) (string, account.User, error)
	Revoke(ctx context.Context, token string) error
	SavedJobIDs(ctx context.Context, userID string) ([]string, error)
	AppliedJobIDs(ctx context.Context, userID string) ([]string, error)
	MarkApplied(ctx context.Context, userID, jobID string) error
	SaveGoogleState(ctx context.Context, state, verifier string, now time.Time) error
	TakeGoogleState(ctx context.Context, state string, now time.Time) (string, error)
	GoogleSignIn(ctx context.Context, id account.GoogleIdentity, now time.Time) (string, account.User, error)
}

type Server struct {
	accounts       Accounts
	listings       *jobs.Store
	acorn          *acorn.Service
	files          RuntimeFile
	cookie         string
	switches       killswitch.Switches
	google         *google.Client
	googleRedirect string
}

// Options are the Acorn API's settings. CORS is the server's: see acorn-backend/cmd/server.
type Options struct {
	// SessionCookie is the Acorn session cookie's name.
	SessionCookie string
	// Runtime is the file the extension attaches when no résumé is available.
	Runtime RuntimeFile
	// KillSwitches turns off Acorn's model routes. Nil leaves them on.
	KillSwitches killswitch.Switches
	// Google is Sign in with Google. An unconfigured client answers 503.
	Google *google.Client
	// GoogleRedirectURL is acorn-frontend's callback, registered in Google Cloud.
	GoogleRedirectURL string
}

func New(accounts Accounts, listings *jobs.Store, brain *acorn.Service, opts Options) (http.Handler, *gateway.Gateway) {
	s := &Server{
		accounts: accounts, listings: listings, acorn: brain, files: opts.Runtime,
		cookie: opts.SessionCookie, switches: opts.KillSwitches,
		google: opts.Google, googleRedirect: opts.GoogleRedirectURL,
	}
	if s.cookie == "" {
		s.cookie = DefaultSessionCookie
	}
	gw := gateway.New(s.authenticateSocket)

	mux := http.NewServeMux()
	mux.HandleFunc("GET /acorn/health", s.health)
	mux.HandleFunc("POST /acorn/auth/signup", s.signUp)
	mux.HandleFunc("POST /acorn/auth/signin", s.signIn)
	mux.HandleFunc("GET /acorn/auth/me", s.me)
	mux.HandleFunc("POST /acorn/auth/signout", s.signOut)
	mux.HandleFunc("POST /v1/auth/google/start", s.startGoogle)
	mux.HandleFunc("POST /v1/auth/google/callback", s.finishGoogle)

	mux.HandleFunc("POST /acorn/ai-analyze", s.requireAI(s.aiAnalyze))
	mux.HandleFunc("POST /acorn/match-option", s.requireAI(s.matchOption))
	mux.HandleFunc("POST /acorn/qa", s.requireAI(s.qa))
	mux.HandleFunc("GET /acorn/runtime-file", s.runtimeFile)

	mux.HandleFunc("GET /acorn/jobs", s.listJobs)
	mux.HandleFunc("GET /acorn/jobs/{jobId}", s.getJob)
	mux.HandleFunc("POST /acorn/jobs/{jobId}/generate", s.requireAI(s.generateForJob))
	mux.HandleFunc("POST /acorn/jobs/{jobId}/mark-applied", s.markApplied)
	mux.HandleFunc("GET /acorn/jobs/{jobId}/resume-preview", s.emptyPreview)
	mux.HandleFunc("GET /acorn/jobs/{jobId}/recommended-resume", s.noJobResume)

	mux.HandleFunc("POST /acorn/custom/extract-jd", s.requireAI(s.extractJD))
	mux.HandleFunc("POST /acorn/custom/analyze-meta", s.requireAI(s.analyzeMeta))
	mux.HandleFunc("POST /acorn/custom/generate", s.noGenerate)
	mux.HandleFunc("POST /acorn/custom/generate/{inputId}/continue", s.noContinue)
	mux.HandleFunc("GET /acorn/custom/generate/{inputId}", s.noPoll)
	mux.HandleFunc("POST /acorn/custom/recommend", s.noRecommend)
	mux.HandleFunc("GET /acorn/custom/library-resumes/{resumeId}/preview", s.emptyPreview)
	mux.HandleFunc("GET /acorn/custom/library-resumes/{resumeId}", s.noLibraryResume)
	mux.HandleFunc("GET /acorn/custom/resumes/{generationId}/preview", s.emptyPreview)
	mux.HandleFunc("GET /acorn/custom/resumes/{generationId}", s.noGeneratedResume)

	socket := gw.Handler()
	mux.Handle(gateway.Path, socket)
	mux.Handle(gateway.Path+"/", socket)
	return mux, gw
}

// token is the Acorn session token: a bearer header from the extension, or the
// acorn_session cookie when the caller is acorn-frontend.
func (s *Server) token(r *http.Request) string {
	if token := httpkit.BearerToken(r); token != "" {
		return token
	}
	if cookie, err := r.Cookie(s.cookie); err == nil {
		return strings.TrimSpace(cookie.Value)
	}
	return ""
}

// session answers 401 unless the request carries a live Acorn session.
func (s *Server) session(w http.ResponseWriter, r *http.Request) (account.Session, bool) {
	session, err := s.accounts.Session(r.Context(), s.token(r), time.Now())
	if errors.Is(err, account.ErrInvalidLogin) {
		writeError(w, http.StatusUnauthorized, "Sign in to Acorn required")
		return account.Session{}, false
	}
	if err != nil {
		slog.Error("acorn session", "error", err)
		writeError(w, http.StatusInternalServerError, "could not load the session")
		return account.Session{}, false
	}
	return session, true
}

func (s *Server) requireAI(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if !killswitch.On(s.switches, r.Context(), killswitch.AcornAI) {
			writeError(w, http.StatusServiceUnavailable, killswitch.Message(killswitch.AcornAI))
			return
		}
		next(w, r)
	}
}

func (s *Server) authenticateSocket(ctx context.Context, token string) (gateway.Account, error) {
	session, err := s.accounts.Session(ctx, token, time.Now())
	if errors.Is(err, account.ErrInvalidLogin) {
		return gateway.Account{}, gateway.ErrUnauthorized
	}
	if err != nil {
		return gateway.Account{}, err
	}
	return gateway.Account{ID: session.User.ID, Name: session.User.Name}, nil
}

func writeError(w http.ResponseWriter, status int, message string) {
	httpkit.WriteJSON(w, status, map[string]any{"success": false, "error": message, "message": message})
}

func writeJSON(w http.ResponseWriter, status int, value any) {
	httpkit.WriteJSON(w, status, value)
}
