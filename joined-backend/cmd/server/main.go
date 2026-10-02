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
	defaultFrontendOrigin = "http://localhost:3002"
)

var defaultOrigins = []string{"http://127.0.0.1:3002", "http://localhost:3002"}

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

	p, err := platform.Open(context.Background(), db, platform.Options{Calendar: calendar})
	if err != nil {
		slog.Error("platform", "error", config.Redact(err, db.MongoURI))
		os.Exit(1)
	}
	defer p.Close()

	reader := openai.New(ai.APIKey, ai.Model, ai.BaseURL).WithSearchModel(ai.SearchModel)
	handler := httpapi.New(p.Jobs, p.Accounts, p.People, p.Hiring, p.Staff, reader, httpapi.Options{
		Origins:           server.Origins,
		Frontend:          frontend,
		Google:            oauth,
		GoogleRedirectURL: googleConfig.SignInRedirectURL,
	})
	if err := httpkit.Serve("joined api", server.Addr, handler); err != nil {
		slog.Error("server", "error", err)
		os.Exit(1)
	}
}
