// Package httpapi is the admin API: the staff routes behind the admin-frontend console.
package httpapi

import (
	"crypto/subtle"
	"net/http"
	"time"

	"github.com/sid0709/OpenSeat/admin-backend/internal/migration"
	"github.com/sid0709/OpenSeat/backend-core/aisettings"
	"github.com/sid0709/OpenSeat/backend-core/config"
	"github.com/sid0709/OpenSeat/backend-core/httpkit"
	"github.com/sid0709/OpenSeat/backend-core/jobs"
	"github.com/sid0709/OpenSeat/backend-core/killswitch"
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
	staffAuth       StaffSignIn
	acornAI         *aisettings.Store
	acornAIEnv      config.OpenAI
	deepSeek        *aisettings.Store
	deepSeekEnv     config.DeepSeek
	analyzeWorkers  int
	researchWorkers int
	adminToken      string
	analyzerToken   string
	switches        killswitch.Switches
}

// Options are the HTTP server's settings.
type Options struct {
	Origins []string
	// AdminToken, when set, is required as a bearer token on every route but /health
	// and the public analyzer routes.
	AdminToken string
	// AnalyzerToken secures /v1/public/analyzer/* for external callers such as Postman.
	AnalyzerToken string
	Migration     MigrationOptions
	// Staff turns on Sign in with Google for the console. Once it is set up, every
	// route but sign-in needs a staff session as well as the admin token.
	Staff StaffSignIn
	// AcornAI holds the API key and model Acorn's AI routes use, set from the console.
	AcornAI *aisettings.Store
	// AcornAIEnv is the environment's OpenAI settings: the model Acorn uses until one
	// is saved, and whether OPENAI_API_KEY already covers a missing saved key.
	AcornAIEnv config.OpenAI
	// DeepSeek holds the API key and model job analysis, company research, and
	// company autofill use, set from the console.
	DeepSeek *aisettings.Store
	// DeepSeekEnv is the environment's DeepSeek settings: the model used until one
	// is saved, and whether DEEPSEEK_API_KEY already covers a missing saved key.
	DeepSeekEnv config.DeepSeek
	// KillSwitches are runtime feature toggles staff flip from the API. Nil leaves
	// job imports on and the staff switch routes answering 503.
	KillSwitches killswitch.Switches
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
		staffAuth:       opts.Staff,
		acornAI:         opts.AcornAI,
		acornAIEnv:      opts.AcornAIEnv,
		deepSeek:        opts.DeepSeek,
		deepSeekEnv:     opts.DeepSeekEnv,
		adminToken:      opts.AdminToken,
		analyzerToken:   opts.AnalyzerToken,
		switches:        opts.KillSwitches,
	}
	api := http.NewServeMux()
	api.HandleFunc("GET /v1/settings", server.settings)
	api.HandleFunc("GET /v1/jobs/temp", server.listTempJobs)
	api.HandleFunc("GET /v1/jobs/scout-temp", server.listScoutTempJobs)
	api.HandleFunc("POST /v1/jobs/scout-temp/analyze", server.analyzeScoutJobs)
	api.HandleFunc("GET /v1/jobs/temp/{id}", server.getTempJob)
	api.HandleFunc("PATCH /v1/jobs/temp/{id}", server.updateTempJob)
	api.HandleFunc("GET /v1/companies", server.listCompanies)
	api.HandleFunc("GET /v1/companies/temp", server.listStagedCompanies)
	api.HandleFunc("GET /v1/companies/{id}", server.getAdminCompany)
	api.HandleFunc("PATCH /v1/companies/{id}", server.updateCompany)
	api.HandleFunc("POST /v1/companies/{id}/autofill", server.autofillCompany)
	api.HandleFunc("GET /v1/companies/{id}/logo", httpkit.CompanyLogo(store))
	api.HandleFunc("POST /v1/companies/{id}/logo", server.uploadCompanyLogo)
	api.HandleFunc("DELETE /v1/companies/{id}/logo", server.deleteCompanyLogo)
	api.HandleFunc("GET /v1/jobs", server.listSearchJobs)
	api.HandleFunc("GET /v1/jobs/{id}", server.getSearchJob)
	api.HandleFunc("PATCH /v1/jobs/{id}", server.updateSearchJob)
	server.registerStaffAuth(api)
	server.registerMigration(api)
	server.registerScoutAdmin(api)
	server.registerStaffAdmin(api)
	server.registerKillSwitches(api)
	server.registerAcornAI(api)
	server.registerDeepSeek(api)

	mux := http.NewServeMux()
	mux.HandleFunc("GET /health", httpkit.Health(store))
	server.registerPublicAnalyzer(mux)
	mux.Handle("/", server.admin(server.requireStaff(api)))
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
