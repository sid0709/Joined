// Package bashapi is Bash's HTTP API: every route and the Socket.IO gateway live
// under Prefix, which backend-core's server hands to this package. Bash has no
// accounts of its own: it signs in with the Joined session that joined-frontend
// and joined-backend share, and reads the applicant's profile from the same database.
package bashapi

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"strings"
	"time"

	"github.com/sid0709/OpenSeat/backend-core/auth"
	"github.com/sid0709/OpenSeat/backend-core/bash"
	"github.com/sid0709/OpenSeat/backend-core/bashapi/gateway"
	"github.com/sid0709/OpenSeat/backend-core/candidate"
	"github.com/sid0709/OpenSeat/backend-core/httpkit"
	"github.com/sid0709/OpenSeat/backend-core/jobs"
)

const (
	// Prefix is the path every Bash route starts with: api.joinedhq.com/bash/...
	Prefix = "/bash"

	// DefaultSessionCookie is the cookie joined-frontend keeps the Joined session token in.
	DefaultSessionCookie = "joined_session"

	// maxBody bounds a request body; a pure tree is the largest thing the extension sends.
	maxBody = 16 << 20
)

// Sessions resolves a Joined session token. *auth.Store is the real one.
type Sessions interface {
	Session(ctx context.Context, token string, now time.Time) (auth.Session, error)
}

// People is the job hunter's workspace Bash reads and writes. *candidate.Store is the real one.
type People interface {
	GetProfile(ctx context.Context, userID string, now time.Time) (candidate.Profile, error)
	SavedJobIDs(ctx context.Context, userID string) ([]string, error)
	AppliedJobIDs(ctx context.Context, userID string) ([]string, error)
	Apply(ctx context.Context, userID string, input candidate.ApplyInput, now time.Time) (candidate.Application, error)
}

type Server struct {
	accounts Sessions
	people   People
	listings *jobs.Store
	bash     *bash.Service
	files    RuntimeFile
	cookie   string
}

// Options are the Bash API's settings. CORS is the server's: see backend-core/cmd/server.
type Options struct {
	// SessionCookie is the Joined session cookie's name.
	SessionCookie string
	// Runtime is the file the extension attaches when no résumé is available.
	Runtime RuntimeFile
}

func New(accounts Sessions, people People, listings *jobs.Store, brain *bash.Service, opts Options) (http.Handler, *gateway.Gateway) {
	s := &Server{accounts: accounts, people: people, listings: listings, bash: brain, files: opts.Runtime, cookie: opts.SessionCookie}
	if s.cookie == "" {
		s.cookie = DefaultSessionCookie
	}
	gw := gateway.New(s.authenticateSocket)

	mux := http.NewServeMux()
	mux.HandleFunc("GET /bash/health", s.health)
	mux.HandleFunc("GET /bash/auth/me", s.me)
	mux.HandleFunc("POST /bash/auth/signout", s.signOut)

	mux.HandleFunc("POST /bash/ai-analyze", s.aiAnalyze)
	mux.HandleFunc("POST /bash/match-option", s.matchOption)
	mux.HandleFunc("POST /bash/qa", s.qa)
	mux.HandleFunc("GET /bash/runtime-file", s.runtimeFile)

	mux.HandleFunc("GET /bash/jobs", s.listJobs)
	mux.HandleFunc("GET /bash/jobs/{jobId}", s.getJob)
	mux.HandleFunc("POST /bash/jobs/{jobId}/generate", s.generateForJob)
	mux.HandleFunc("POST /bash/jobs/{jobId}/mark-applied", s.markApplied)
	mux.HandleFunc("GET /bash/jobs/{jobId}/resume-preview", s.emptyPreview)
	mux.HandleFunc("GET /bash/jobs/{jobId}/recommended-resume", s.noJobResume)

	mux.HandleFunc("POST /bash/custom/extract-jd", s.extractJD)
	mux.HandleFunc("POST /bash/custom/analyze-meta", s.analyzeMeta)
	mux.HandleFunc("POST /bash/custom/generate", s.noGenerate)
	mux.HandleFunc("POST /bash/custom/generate/{inputId}/continue", s.noContinue)
	mux.HandleFunc("GET /bash/custom/generate/{inputId}", s.noPoll)
	mux.HandleFunc("POST /bash/custom/recommend", s.noRecommend)
	mux.HandleFunc("GET /bash/custom/library-resumes/{resumeId}/preview", s.emptyPreview)
	mux.HandleFunc("GET /bash/custom/library-resumes/{resumeId}", s.noLibraryResume)
	mux.HandleFunc("GET /bash/custom/resumes/{generationId}/preview", s.emptyPreview)
	mux.HandleFunc("GET /bash/custom/resumes/{generationId}", s.noGeneratedResume)

	socket := gw.Handler()
	mux.Handle(gateway.Path, socket)
	mux.Handle(gateway.Path+"/", socket)
	return mux, gw
}

// token is the Joined session token: a bearer header from the extension, or the
// Joined cookie when the caller is a page on the same site.
func (s *Server) token(r *http.Request) string {
	if token := httpkit.BearerToken(r); token != "" {
		return token
	}
	if cookie, err := r.Cookie(s.cookie); err == nil {
		return strings.TrimSpace(cookie.Value)
	}
	return ""
}

// session answers 401 unless the request carries a live Joined session of a job hunter.
func (s *Server) session(w http.ResponseWriter, r *http.Request) (auth.Session, bool) {
	session, err := s.accounts.Session(r.Context(), s.token(r), time.Now())
	if errors.Is(err, auth.ErrInvalidLogin) {
		writeError(w, http.StatusUnauthorized, "Sign in to Joined required")
		return auth.Session{}, false
	}
	if err != nil {
		slog.Error("bash session", "error", err)
		writeError(w, http.StatusInternalServerError, "could not load the session")
		return auth.Session{}, false
	}
	if session.User.Role != auth.RoleCandidate {
		writeError(w, http.StatusForbidden, "job hunter account required")
		return auth.Session{}, false
	}
	return session, true
}

func (s *Server) authenticateSocket(ctx context.Context, token string) (gateway.Account, error) {
	session, err := s.accounts.Session(ctx, token, time.Now())
	if errors.Is(err, auth.ErrInvalidLogin) {
		return gateway.Account{}, gateway.ErrUnauthorized
	}
	if err != nil {
		return gateway.Account{}, err
	}
	if session.User.Role != auth.RoleCandidate {
		return gateway.Account{}, gateway.ErrUnauthorized
	}
	return gateway.Account{ID: session.User.ID, Name: session.User.Name}, nil
}

func writeError(w http.ResponseWriter, status int, message string) {
	httpkit.WriteJSON(w, status, map[string]any{"success": false, "error": message, "message": message})
}

func writeJSON(w http.ResponseWriter, status int, value any) {
	httpkit.WriteJSON(w, status, value)
}
