// Command server runs Oak's API: the /api/oak routes and the /oak Socket.IO gateway.
package main

import (
	"context"
	"log/slog"
	"os"

	"github.com/sid0709/OpenSeat/backend-core/config"
	"github.com/sid0709/OpenSeat/backend-core/httpkit"
	"github.com/sid0709/OpenSeat/backend-core/openai"
	"github.com/sid0709/OpenSeat/backend-core/platform"
	"github.com/sid0709/OpenSeat/bash/backend/internal/httpapi"
	"github.com/sid0709/OpenSeat/bash/backend/internal/oak"
)

const (
	defaultHTTPAddr   = "127.0.0.1:8980"
	defaultRuntimeKey = "runtime_file"
)

// The UI board's dev origins. The extension is not a browser origin: it calls with host permissions.
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
		slog.Warn("OPENAI_API_KEY is not set: Oak's AI routes will answer 503")
	}
	handler, gateway := httpapi.New(p.Accounts, p.People, p.Jobs, oak.New(model), httpapi.Options{
		Origins:       server.Origins,
		SessionCookie: config.Env("JOINED_SESSION_COOKIE", httpapi.DefaultSessionCookie),
		Runtime: httpapi.RuntimeFile{
			Path: config.Env("OAK_RUNTIME_FILE_PATH", ""),
			Key:  config.Env("OAK_RUNTIME_FILE_KEY", defaultRuntimeKey),
		},
	})
	defer gateway.Close()

	if err := httpkit.Serve("oak api", server.Addr, handler); err != nil {
		slog.Error("server", "error", err)
		os.Exit(1)
	}
}
