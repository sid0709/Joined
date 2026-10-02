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

type Server struct {
	store    *jobs.Store
	auth     *auth.Store
	people   *candidate.Store
	hiring   *employer.Store
	staff    staff.API
	reader   jobs.ModelReader
	frontend string
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
}

func New(store *jobs.Store, accounts *auth.Store, people *candidate.Store, hiring *employer.Store, moderation staff.API, reader jobs.ModelReader, opts Options) http.Handler {
	server := &Server{
		store:    store,
		auth:     accounts,
		people:   people,
		hiring:   hiring,
		staff:    moderation,
		reader:   reader,
		frontend: opts.Frontend,
	}
	identity := authapi.Handlers{
		Accounts:       accounts,
		Audience:       auth.AudienceJoined,
		CompanyCreated: server.noteNewCompany,
		// Job hunters only: recruiters need a company, so they sign up with a password.
		// The same consent screen asks for the calendar, which interviews sync with.
		Google: &authapi.GoogleSignIn{
			OAuth:       opts.Google,
			RedirectURL: opts.GoogleRedirectURL,
			Role:        auth.RoleCandidate,
			Scopes:      []string{google.ScopeCalendarEvents},
			Granted:     server.attachCalendar,
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
	mux.HandleFunc("GET /v1/me/profile", server.getProfile)
	mux.HandleFunc("PATCH /v1/me/profile", server.patchProfile)
	mux.HandleFunc("GET /v1/me/saved-jobs", server.getSavedJobs)
	mux.HandleFunc("PUT /v1/me/saved-jobs/{jobId}", server.putSavedJob)
	mux.HandleFunc("DELETE /v1/me/saved-jobs/{jobId}", server.deleteSavedJob)
	mux.HandleFunc("GET /v1/me/applications", server.getApplications)
	mux.HandleFunc("POST /v1/me/applications", server.postApplication)
	mux.HandleFunc("PATCH /v1/me/applications/{id}", server.patchApplication)
	mux.HandleFunc("GET /v1/me/applications/{id}/offer/esign", server.getMyOfferEsign)
	mux.HandleFunc("POST /v1/me/applications/{id}/offer/esign", server.postMyOfferEsign)
	mux.HandleFunc("DELETE /v1/me/applications/{id}", server.deleteApplication)
	mux.HandleFunc("GET /v1/me/interviews", server.getInterviews)
	mux.HandleFunc("POST /v1/me/interviews", server.postInterview)
	mux.HandleFunc("PATCH /v1/me/interviews/{id}", server.patchInterview)
	mux.HandleFunc("GET /v1/me/calendar", server.getCalendar)
	mux.HandleFunc("GET /v1/me/calendar/events", server.getCalendarEvents)
	mux.HandleFunc("GET /v1/me/calendar/google/start", server.startGoogleCalendar)
	mux.HandleFunc("GET /v1/me/calendar/google/callback", server.googleCalendarCallback)
	mux.HandleFunc("DELETE /v1/me/calendar/google", server.disconnectGoogleCalendar)
	mux.HandleFunc("POST /v1/me/calendar/google/sync", server.syncGoogleCalendar)
	mux.HandleFunc("GET /v1/me/threads", server.getMyThreads)
	mux.HandleFunc("GET /v1/me/threads/{id}", server.getMyThread)
	mux.HandleFunc("POST /v1/me/threads/{id}/messages", server.postMyMessage)
	mux.HandleFunc("GET /v1/me/unread", server.getMyUnread)
	mux.HandleFunc("GET /v1/company/threads", server.getCompanyThreads)
	mux.HandleFunc("GET /v1/company/threads/{id}", server.getCompanyThread)
	mux.HandleFunc("POST /v1/company/threads/{id}/messages", server.postCompanyMessage)
	mux.HandleFunc("GET /v1/company/unread", server.getCompanyUnread)
	server.registerEmployer(mux)
	return httpkit.CORS(opts.Origins, mux)
}

// attachCalendar keeps the calendar a job hunter granted while signing in with
// Google. Google sends a refresh token only the first time, so a returning job
// hunter keeps the connection they have, or the disconnect they chose.
func (s *Server) attachCalendar(ctx context.Context, session auth.Session, profile google.Profile, token google.Token) {
	if s.people == nil || !token.Granted(google.ScopeCalendarEvents) || token.RefreshToken == "" {
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
