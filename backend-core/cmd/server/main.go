// Command server runs backend-core's own API, the one at api.joinedhq.com. Each
// product it serves owns a path prefix: Acorn's routes and Socket.IO gateway live
// under /acorn (see routes.go).
package main

import (
	"context"
	"log/slog"
	"os"

	"github.com/sid0709/OpenSeat/backend-core/acorn"
	"github.com/sid0709/OpenSeat/backend-core/acornapi"
	"github.com/sid0709/OpenSeat/backend-core/aisettings"
	"github.com/sid0709/OpenSeat/backend-core/config"
	"github.com/sid0709/OpenSeat/backend-core/httpkit"
	"github.com/sid0709/OpenSeat/backend-core/platform"
)

const (
	defaultHTTPAddr   = "127.0.0.1:8083"
	defaultRuntimeKey = "runtime_file"
)

// Acorn's UI board dev origins. The Acorn extension is not a browser origin: it calls with host permissions.
var defaultOrigins = []string{"http://127.0.0.1:5173", "http://localhost:5173"}

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
	errorReporting := config.LoadErrorReporting()

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
	var reporter httpkit.ErrorReporter = httpkit.NoOpReporter{}
	if errorReporting.SentryDSN != "" {
		slog.Info("error reporting configured", "service", "sentry")
	}
	logger := slog.Default()
	acornHandler, gateway := acornapi.New(p.Accounts, p.People, p.Jobs, acorn.New(model), acornapi.Options{
		SessionCookie: config.Env("JOINED_SESSION_COOKIE", acornapi.DefaultSessionCookie),
		Runtime: acornapi.RuntimeFile{
			Path: config.Env("ACORN_RUNTIME_FILE_PATH", ""),
			Key:  config.Env("ACORN_RUNTIME_FILE_KEY", defaultRuntimeKey),
		},
	})
	defer gateway.Close()

	handler := routes(server.Origins, httpkit.Health(p.Jobs), acornHandler, logger, reporter)
	if err := httpkit.Serve("core api", server.Addr, handler); err != nil {
		slog.Error("server", "error", err)
		os.Exit(1)
	}
}
