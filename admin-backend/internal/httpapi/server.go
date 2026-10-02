// Package httpapi is the admin API: the staff routes behind the admin-frontend console.
package httpapi

import (
	"crypto/subtle"
	"net/http"
	"time"

	"github.com/sid0709/OpenSeat/admin-backend/internal/migration"
	"github.com/sid0709/OpenSeat/backend-core/httpkit"
	"github.com/sid0709/OpenSeat/backend-core/jobs"
	"github.com/sid0709/OpenSeat/backend-core/scout"
	"github.com/sid0709/OpenSeat/backend-core/staff"
)

const (
	analyzeTimeout = 15 * time.Minute
	maxAnalyzeBody = 16 << 10
	// missingAPIKey tells staff how to turn on the model-backed tools.
	missingAPIKey = "Set OPENAI_API_KEY in the admin API environment"
)

type Server struct {
	store           *jobs.Store
	scouts          *scout.Store
	staff           staff.API
	reader          jobs.ModelReader
	ai              MigrationModel
	migration       *migration.Runner
	analyzeWorkers  int
	researchWorkers int
	adminToken      string
}

// Options are the HTTP server's settings.
type Options struct {
	Origins []string
	// AdminToken, when set, is required as a bearer token on every route but /health.
	AdminToken string
	Migration  MigrationOptions
}

func New(store *jobs.Store, scouts *scout.Store, moderation staff.API, reader jobs.ModelReader, opts Options) http.Handler {
	server := &Server{
		store:           store,
		scouts:          scouts,
		staff:           moderation,
		reader:          reader,
		ai:              opts.Migration.Model,
		migration:       migration.NewRunner(),
		analyzeWorkers:  opts.Migration.AnalyzeWorkers,
		researchWorkers: opts.Migration.ResearchWorkers,
		adminToken:      opts.AdminToken,
	}
	api := http.NewServeMux()
	api.HandleFunc("GET /v1/settings", server.settings)
	api.HandleFunc("GET /v1/jobs/temp", server.listTempJobs)
	api.HandleFunc("GET /v1/jobs/scout-temp", server.listScoutTempJobs)
	api.HandleFunc("POST /v1/jobs/scout-temp/analyze", server.analyzeScoutJobs)
	api.HandleFunc("GET /v1/jobs/temp/{id}", server.getTempJob)
	api.HandleFunc("PATCH /v1/jobs/temp/{id}", server.updateTempJob)
	api.HandleFunc("GET /v1/companies", server.listCompanies)
	api.HandleFunc("GET /v1/companies/{id}", server.getAdminCompany)
	api.HandleFunc("PATCH /v1/companies/{id}", server.updateCompany)
	api.HandleFunc("POST /v1/companies/{id}/autofill", server.autofillCompany)
	api.HandleFunc("GET /v1/companies/{id}/logo", httpkit.CompanyLogo(store))
	api.HandleFunc("POST /v1/companies/{id}/logo", server.uploadCompanyLogo)
	api.HandleFunc("DELETE /v1/companies/{id}/logo", server.deleteCompanyLogo)
	api.HandleFunc("GET /v1/jobs", server.listSearchJobs)
	api.HandleFunc("GET /v1/jobs/{id}", server.getSearchJob)
	api.HandleFunc("PATCH /v1/jobs/{id}", server.updateSearchJob)
	server.registerMigration(api)
	server.registerScoutAdmin(api)
	server.registerStaffAdmin(api)

	mux := http.NewServeMux()
	mux.HandleFunc("GET /health", httpkit.Health(store))
	mux.Handle("/", server.admin(api))
	return httpkit.CORS(opts.Origins, mux)
}

// admin guards the staff routes. When ADMIN_API_TOKEN is configured, callers
// must send it as a bearer token; the admin console adds it server-side.
func (s *Server) admin(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if s.adminToken != "" {
			token := httpkit.BearerToken(r)
			if subtle.ConstantTimeCompare([]byte(token), []byte(s.adminToken)) != 1 {
				httpkit.WriteError(w, http.StatusUnauthorized, "admin token required")
				return
			}
		}
		next.ServeHTTP(w, r)
	})
}
