// Command server runs Acorn's API. The extension calls /acorn and the Socket.IO
// gateway on this process. Accounts, sessions, and the rest of Acorn's data live
// in AcornDB, not JoinedDB.
package main

import (
	"context"
	"log/slog"
	"os"

	"github.com/sid0709/OpenSeat/acorn-backend/account"
	"github.com/sid0709/OpenSeat/acorn-backend/acorn"
	"github.com/sid0709/OpenSeat/acorn-backend/acornapi"
	"github.com/sid0709/OpenSeat/backend-core/aisettings"
	"github.com/sid0709/OpenSeat/backend-core/config"
	"github.com/sid0709/OpenSeat/backend-core/google"
	"github.com/sid0709/OpenSeat/backend-core/httpkit"
	"github.com/sid0709/OpenSeat/backend-core/platform"
)

const (
	defaultHTTPAddr   = "127.0.0.1:8083"
	defaultRuntimeKey = "runtime_file"
	// defaultDatabase is Acorn's own database. Joined uses JoinedDB; this process does not.
	defaultDatabase = "AcornDB"
)

// acorn-frontend, plus the older UI board. The extension is not a browser origin.
var defaultOrigins = []string{
	"http://127.0.0.1:6005",
	"http://localhost:6005",
	"http://127.0.0.1:5173",
	"http://localhost:5173",
}

func main() {
	config.LoadEnvFile()
	db, err := config.LoadDatabase()
	if err != nil {
		slog.Error("config", "error", err)
		os.Exit(1)
	}
	// DEST_DB is Joined's database. Acorn reads ACORN_DB so a shared environment
	// cannot point this process at JoinedDB.
	db.DestDB = config.Env("ACORN_DB", defaultDatabase)
	server, err := config.LoadHTTP(defaultHTTPAddr, defaultOrigins)
	if err != nil {
		slog.Error("config", "error", err)
		os.Exit(1)
	}
	ai := config.LoadOpenAI()
	googleConfig := config.LoadGoogle()
	oauth := &google.Client{ClientID: googleConfig.ClientID, ClientSecret: googleConfig.ClientSecret}
	if !oauth.Configured() || googleConfig.SignInRedirectURL == "" {
		slog.Warn("Google sign-in is off until GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_SIGNIN_REDIRECT_URL are set")
	}

	p, err := platform.Open(context.Background(), db, platform.Options{SettingsKey: config.Env("SETTINGS_ENCRYPTION_KEY", "")})
	if err != nil {
		slog.Error("platform", "error", config.Redact(err, db.MongoURI))
		os.Exit(1)
	}
	defer p.Close()

	// Staff save the key in the admin console; OPENAI_API_KEY is the fallback.
	model := aisettings.NewModel(p.AISettings, ai)
	if !model.Ready() {
		slog.Warn("No AI key yet: Acorn's AI routes answer 503 until staff save one in the admin console or OPENAI_API_KEY is set")
	}
	reporter := httpkit.NewReporter(config.LoadErrorReporting().SentryDSN)
	accounts := account.NewStore(p.Mongo(), db.DestDB)
	if err := accounts.EnsureIndexes(context.Background()); err != nil {
		slog.Error("acorn accounts", "error", err)
		os.Exit(1)
	}
	acornHandler, gateway := acornapi.New(accounts, p.Jobs, acorn.New(model), acornapi.Options{
		SessionCookie: config.Env("ACORN_SESSION_COOKIE", acornapi.DefaultSessionCookie),
		Runtime: acornapi.RuntimeFile{
			Path: config.Env("ACORN_RUNTIME_FILE_PATH", ""),
			Key:  config.Env("ACORN_RUNTIME_FILE_KEY", defaultRuntimeKey),
		},
		KillSwitches:      p.KillSwitches,
		Google:            oauth,
		GoogleRedirectURL: googleConfig.SignInRedirectURL,
	})
	defer gateway.Close()

	handler := routes(server.Origins, httpkit.Health(p.Jobs), acornHandler, slog.Default(), reporter)
	if err := httpkit.Serve("acorn api", server.Addr, handler); err != nil {
		slog.Error("server", "error", err)
		os.Exit(1)
	}
}
