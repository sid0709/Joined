// Command server runs the Scoutwell API for scoutwell-frontend and scout partners.
package main

import (
	"context"
	"log/slog"
	"os"

	"github.com/sid0709/OpenSeat/backend-core/config"
	"github.com/sid0709/OpenSeat/backend-core/google"
	"github.com/sid0709/OpenSeat/backend-core/httpkit"
	"github.com/sid0709/OpenSeat/backend-core/platform"
	"github.com/sid0709/OpenSeat/scoutwell-backend/internal/httpapi"
)

const defaultHTTPAddr = "127.0.0.1:8082"

var defaultOrigins = []string{"http://127.0.0.1:6003", "http://localhost:6003"}

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

	p, err := platform.Open(context.Background(), db, platform.Options{})
	if err != nil {
		slog.Error("platform", "error", config.Redact(err, db.MongoURI))
		os.Exit(1)
	}
	defer p.Close()
	// Submissions are checked here, so this service picks up checks a restart interrupted.
	if resumed, err := p.Scouts.ResumePending(context.Background()); err != nil {
		slog.Error("resume scout checks", "error", config.Redact(err, db.MongoURI))
	} else if resumed > 0 {
		slog.Info("resume scout checks", "submissions", resumed)
	}

	googleConfig := config.LoadGoogle()
	handler := httpapi.New(p.Jobs, p.Accounts, p.Scouts, httpapi.Options{
		Origins:           server.Origins,
		Google:            &google.Client{ClientID: googleConfig.ClientID, ClientSecret: googleConfig.ClientSecret},
		GoogleRedirectURL: googleConfig.SignInRedirectURL,
	})
	if err := httpkit.Serve("scoutwell api", server.Addr, handler); err != nil {
		slog.Error("server", "error", err)
		os.Exit(1)
	}
}
