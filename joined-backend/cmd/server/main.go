// Command server runs the Joined API for joined-frontend.
package main

import (
	"context"
	"log/slog"
	"os"
	"strings"
	// Interview times are kept in each job hunter's own zone, so the binary carries
	// the zone database instead of relying on the container's.
	_ "time/tzdata"

	"github.com/sid0709/OpenSeat/backend-core/auth"
	"github.com/sid0709/OpenSeat/backend-core/candidate"
	"github.com/sid0709/OpenSeat/backend-core/config"
	"github.com/sid0709/OpenSeat/backend-core/google"
	"github.com/sid0709/OpenSeat/backend-core/httpkit"
	"github.com/sid0709/OpenSeat/backend-core/openai"
	"github.com/sid0709/OpenSeat/backend-core/platform"
	"github.com/sid0709/OpenSeat/joined-backend/internal/httpapi"
)

const (
	defaultHTTPAddr       = "127.0.0.1:8080"
	defaultFrontendOrigin = "http://localhost:6002"
	companyModeEnv        = "COMPANY_MODE_ENABLED"
)

var defaultOrigins = []string{"http://127.0.0.1:6002", "http://localhost:6002"}

func main() {
	config.LoadEnvFile()
	db, err := config.LoadDatabase()
	if err != nil {
		slog.Error("config", "error", err)
		os.Exit(1)
	}
	server, err := config.LoadHTTP(defaultHTTPAddr, defaultOrigins)
	if err != nil {
		slog.Error("config", "error", err)
		os.Exit(1)
	}
	ai := config.LoadOpenAI()
	frontend := strings.TrimRight(config.Env("FRONTEND_ORIGIN", defaultFrontendOrigin), "/")
	googleConfig := config.LoadGoogle()
	oauth := &google.Client{ClientID: googleConfig.ClientID, ClientSecret: googleConfig.ClientSecret}
	calendar := &candidate.Google{OAuth: oauth, RedirectURL: config.Env("GOOGLE_REDIRECT_URL", "")}

	emailConfig := config.LoadEmail(frontend)
	emailSender, err := auth.NewEmailSender(emailConfig)
	if err != nil {
		slog.Error("email config", "error", err)
		os.Exit(1)
	}

	p, err := platform.Open(context.Background(), db, platform.Options{
		Calendar:          calendar,
		EnsureSearchIndex: config.SearchEnsureIndex(),
	})
	if err != nil {
		slog.Error("platform", "error", config.Redact(err, db.MongoURI))
		os.Exit(1)
	}
	defer p.Close()

	reporter := httpkit.NewReporter(config.LoadErrorReporting().SentryDSN)
	reader := openai.New(ai.APIKey, ai.Model, ai.BaseURL).WithSearchModel(ai.SearchModel)
	handler := httpapi.New(p.Jobs, p.Accounts, p.People, p.Hiring, p.Staff, reader, httpapi.Options{
		Origins:           server.Origins,
		Frontend:          frontend,
		Google:            oauth,
		GoogleRedirectURL: googleConfig.SignInRedirectURL,
		CompanyMode:       companyModeEnabled(config.Env(companyModeEnv, "")),
		EmailSender:       emailSender,
	})
	if err := httpkit.Serve("joined api", server.Addr, httpkit.Wrap(slog.Default(), reporter, handler)); err != nil {
		slog.Error("server", "error", err)
		os.Exit(1)
	}
}

func companyModeEnabled(value string) bool {
	switch strings.ToLower(strings.TrimSpace(value)) {
	case "true", "1":
		return true
	default:
		return false
	}
}
