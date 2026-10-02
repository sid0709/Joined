// Command server runs backend-core's own API, the one at api.joinedhq.com. Each
// product it serves owns a path prefix: Bash's routes and Socket.IO gateway live
// under /bash (see routes.go).
package main

import (
	"context"
	"log/slog"
	"os"

	"github.com/sid0709/OpenSeat/backend-core/bash"
	"github.com/sid0709/OpenSeat/backend-core/bashapi"
	"github.com/sid0709/OpenSeat/backend-core/config"
	"github.com/sid0709/OpenSeat/backend-core/httpkit"
	"github.com/sid0709/OpenSeat/backend-core/openai"
	"github.com/sid0709/OpenSeat/backend-core/platform"
)

const (
	defaultHTTPAddr   = "127.0.0.1:8083"
	defaultRuntimeKey = "runtime_file"
)

// Bash's UI board dev origins. The Bash extension is not a browser origin: it calls with host permissions.
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

	p, err := platform.Open(context.Background(), db, platform.Options{})
	if err != nil {
		slog.Error("platform", "error", config.Redact(err, db.MongoURI))
		os.Exit(1)
	}
	defer p.Close()

	model := openai.New(ai.APIKey, ai.Model, ai.BaseURL)
	if !model.Ready() {
		slog.Warn("OPENAI_API_KEY is not set: Bash's AI routes will answer 503")
	}
	bashHandler, gateway := bashapi.New(p.Accounts, p.People, p.Jobs, bash.New(model), bashapi.Options{
		SessionCookie: config.Env("JOINED_SESSION_COOKIE", bashapi.DefaultSessionCookie),
		Runtime: bashapi.RuntimeFile{
			Path: config.Env("BASH_RUNTIME_FILE_PATH", ""),
			Key:  config.Env("BASH_RUNTIME_FILE_KEY", defaultRuntimeKey),
		},
	})
	defer gateway.Close()

	handler := routes(server.Origins, httpkit.Health(p.Jobs), bashHandler)
	if err := httpkit.Serve("core api", server.Addr, handler); err != nil {
		slog.Error("server", "error", err)
		os.Exit(1)
	}
}
