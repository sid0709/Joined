// Package httpapi is the Joined API: accounts, job search, the job hunter's
// workspace, and the recruiter workspace, for joined-frontend.
package httpapi

import (
	"context"
	"log/slog"
	"net/http"
	"time"

	"github.com/sid0709/OpenSeat/backend-core/auth"
	"github.com/sid0709/OpenSeat/backend-core/authapi"
	"github.com/sid0709/OpenSeat/backend-core/candidate"
	"github.com/sid0709/OpenSeat/backend-core/employer"
	"github.com/sid0709/OpenSeat/backend-core/google"
	"github.com/sid0709/OpenSeat/backend-core/httpkit"
	"github.com/sid0709/OpenSeat/backend-core/jobs"
	"github.com/sid0709/OpenSeat/backend-core/staff"
)

type sessionLookup interface {
	Session(ctx context.Context, token string, now time.Time) (auth.Session, error)
}

type Server struct {
	store       *jobs.Store
	auth        *auth.Store
	sessions    sessionLookup
	people      *candidate.Store
	hiring      *employer.Store
	staff       staff.API
	reader      jobs.ModelReader
	frontend    string
	companyMode bool
}

// Options are the HTTP server's settings.
type Options struct {
	Origins []string
	// Frontend is joined-frontend's origin, for links and redirects back to it.
	Frontend string
	// Google is the OAuth client behind Sign in with Google and the calendar.
	Google *google.Client
	// GoogleRedirectURL is joined-frontend's Google sign-in callback page.
	GoogleRedirectURL string
	// CompanyMode lets recruiter accounts use /v1/company/*. Off for launch.
	CompanyMode bool
	// Sessions, when set, is used for role checks instead of accounts.
	Sessions sessionLookup
	// EmailSender delivers transactional email.
	EmailSender auth.EmailSender
}

func New(store *jobs.Store, accounts *auth.Store, people *candidate.Store, hiring *employer.Store, moderation staff.API, reader jobs.ModelReader, opts Options) http.Handler {
	var sessions sessionLookup
	if opts.Sessions != nil {
		sessions = opts.Sessions
	} else if accounts != nil {
		sessions = accounts
	}
	server := &Server{
		store:       store,
		auth:        accounts,
		sessions:    sessions,
		people:      people,
		hiring:      hiring,
		staff:       moderation,
		reader:      reader,
		frontend:    opts.Frontend,
		companyMode: opts.CompanyMode,
	}
	identity := authapi.Handlers{
		Accounts:       accounts,
		Audience:       auth.AudienceJoined,
		CompanyCreated: server.noteNewCompany,
		// Google is the only way in. A sign-up is a job hunter unless it asks to be a
		// recruiter, who then links or creates a company on the hiring setup page.
		// A job hunter's consent screen also asks for the calendar interviews sync with.
		Google: &authapi.GoogleSignIn{
			OAuth:       opts.Google,
			RedirectURL: opts.GoogleRedirectURL,
			Roles:       []string{auth.RoleCandidate, auth.RoleEmployee},
			Scopes:      []string{google.ScopeCalendarEvents},
			Granted:     server.attachCalendar,
		},
		Email: &authapi.EmailAuth{
			Sender: emailSenderOrDev(opts.EmailSender),
		},
	}
	mux := http.NewServeMux()
	identity.Register(mux)
	identity.RegisterCompanies(mux)
	mux.HandleFunc("GET /health", httpkit.Health(store))
	mux.HandleFunc("GET /v1/schedule/{key}", server.getPublicSchedule)
	mux.HandleFunc("POST /v1/schedule/{key}/accept", server.acceptPublicSchedule)
	mux.HandleFunc("GET /v1/search/jobs", server.listSearchCatalog)
	mux.HandleFunc("GET /v1/search/jobs/{id}", server.getSearchCatalogJob)
	mux.HandleFunc("GET /v1/search/companies/{id}/logo", httpkit.CompanyLogo(store))
	mux.HandleFunc("GET /v1/search/companies/{id}", server.getSearchCompany)

	candidateMux := http.NewServeMux()
	candidateMux.HandleFunc("GET /v1/me/profile", server.getProfile)
	candidateMux.HandleFunc("PATCH /v1/me/profile", server.patchProfile)
	candidateMux.HandleFunc("GET /v1/me/saved-jobs", server.getSavedJobs)
	candidateMux.HandleFunc("PUT /v1/me/saved-jobs/{jobId}", server.putSavedJob)
	candidateMux.HandleFunc("DELETE /v1/me/saved-jobs/{jobId}", server.deleteSavedJob)
	candidateMux.HandleFunc("GET /v1/me/applications", server.getApplications)
	candidateMux.HandleFunc("POST /v1/me/applications", server.postApplication)
	candidateMux.HandleFunc("PATCH /v1/me/applications/{id}", server.patchApplication)
	candidateMux.HandleFunc("GET /v1/me/applications/{id}/offer/esign", server.getMyOfferEsign)
	candidateMux.HandleFunc("POST /v1/me/applications/{id}/offer/esign", server.postMyOfferEsign)
	candidateMux.HandleFunc("DELETE /v1/me/applications/{id}", server.deleteApplication)
	candidateMux.HandleFunc("GET /v1/me/interviews", server.getInterviews)
	candidateMux.HandleFunc("POST /v1/me/interviews", server.postInterview)
	candidateMux.HandleFunc("PATCH /v1/me/interviews/{id}", server.patchInterview)
	candidateMux.HandleFunc("GET /v1/me/calendar", server.getCalendar)
	candidateMux.HandleFunc("GET /v1/me/calendar/events", server.getCalendarEvents)
	candidateMux.HandleFunc("GET /v1/me/calendar/google/start", server.startGoogleCalendar)
	candidateMux.HandleFunc("DELETE /v1/me/calendar/google", server.disconnectGoogleCalendar)
	candidateMux.HandleFunc("POST /v1/me/calendar/google/sync", server.syncGoogleCalendar)
	candidateMux.HandleFunc("GET /v1/me/threads", server.getMyThreads)
	candidateMux.HandleFunc("GET /v1/me/threads/{id}", server.getMyThread)
	candidateMux.HandleFunc("POST /v1/me/threads/{id}/messages", server.postMyMessage)
	candidateMux.HandleFunc("GET /v1/me/unread", server.getMyUnread)
	// Google's OAuth redirect has no Authorization header; it authenticates via state.
	mux.HandleFunc("GET /v1/me/calendar/google/callback", server.googleCalendarCallback)
	mux.Handle("/v1/me/", authapi.RequireRole(sessions, []string{auth.RoleCandidate}, candidateMux))

	companyMux := http.NewServeMux()
	companyMux.HandleFunc("GET /v1/company/threads", server.getCompanyThreads)
	companyMux.HandleFunc("GET /v1/company/threads/{id}", server.getCompanyThread)
	companyMux.HandleFunc("POST /v1/company/threads/{id}/messages", server.postCompanyMessage)
	companyMux.HandleFunc("GET /v1/company/unread", server.getCompanyUnread)
	server.registerEmployer(companyMux)
	mux.Handle("/v1/company/", authapi.RequireRole(sessions, []string{auth.RoleEmployee}, requireCompanyMode(opts.CompanyMode, companyMux)))

	return httpkit.CORS(opts.Origins, mux)
}

func emailSenderOrDev(sender auth.EmailSender) auth.EmailSender {
	if sender == nil {
		return auth.DevEmailSender{}
	}
	return sender
}

// attachCalendar keeps the calendar a job hunter granted while signing in with
// Google. Google sends a refresh token only the first time, so a returning job
// hunter keeps the connection they have, or the disconnect they chose.
func (s *Server) attachCalendar(ctx context.Context, session auth.Session, profile google.Profile, token google.Token) {
	if s.people == nil || session.User.Role != auth.RoleCandidate ||
		!token.Granted(google.ScopeCalendarEvents) || token.RefreshToken == "" {
		return
	}
	account := candidate.GoogleAccount{Email: profile.Email, RefreshToken: token.RefreshToken}
	if err := s.people.ConnectGoogle(ctx, session.User.ID, account, time.Now()); err != nil {
		slog.Error("attach google calendar", "user", session.User.ID, "error", err)
	}
}

// noteNewCompany queues a company page someone just created for staff verification.
func (s *Server) noteNewCompany(ctx context.Context, session auth.Session) {
	if s.staff == nil || session.Company == nil || !session.Company.IsCreator {
		return
	}
	if err := s.staff.NoteCompanyCreated(ctx, session.Company.ID, session.User.ID, session.Company.URL, time.Now()); err != nil {
		slog.Error("company verification", "company", session.Company.ID, "error", err)
	}
}
