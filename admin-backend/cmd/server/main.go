// Command server runs the admin API for the admin-frontend console.
package main

import (
	"context"
	"log/slog"
	"os"
	"time"

	"github.com/sid0709/OpenSeat/admin-backend/internal/httpapi"
	"github.com/sid0709/OpenSeat/backend-core/config"
	"github.com/sid0709/OpenSeat/backend-core/deepseek"
	"github.com/sid0709/OpenSeat/backend-core/httpkit"
	"github.com/sid0709/OpenSeat/backend-core/jobs"
	"github.com/sid0709/OpenSeat/backend-core/openai"
	"github.com/sid0709/OpenSeat/backend-core/platform"
)

const (
	defaultHTTPAddr = "127.0.0.1:8081"
	backfillTimeout = 2 * time.Minute
	dropTimeout     = 30 * time.Second
	// DeepSeek does not rate-limit by request count, so job reads run wide; each
	// company research runs several web searches, so it runs narrower.
	defaultAnalyzeWorkers  = 64
	defaultResearchWorkers = 24
)

var defaultOrigins = []string{"http://127.0.0.1:3010", "http://localhost:3010"}

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
	migrationAI := deepseek.New(config.LoadDeepSeek())
	adminToken := config.Env("ADMIN_API_TOKEN", "")

	p, err := platform.Open(context.Background(), db, platform.Options{})
	if err != nil {
		slog.Error("platform", "error", config.Redact(err, db.MongoURI))
		os.Exit(1)
	}
	defer p.Close()
	migrateCatalog(p.Jobs, db.MongoURI)

	if adminToken == "" {
		slog.Warn("ADMIN_API_TOKEN is not set: staff endpoints accept unauthenticated requests")
	}
	reader := openai.New(ai.APIKey, ai.Model, ai.BaseURL)
	if !migrationAI.Ready() {
		slog.Warn("DEEPSEEK_API_KEY is not set: migration analysis and company research are off")
	}
	handler := httpapi.New(p.Jobs, p.Scouts, p.Staff, reader, httpapi.Options{
		Origins:    server.Origins,
		AdminToken: adminToken,
		Migration: httpapi.MigrationOptions{
			Model:           migrationAI,
			AnalyzeWorkers:  config.EnvInt("MIGRATION_ANALYZE_WORKERS", defaultAnalyzeWorkers),
			ResearchWorkers: config.EnvInt("MIGRATION_RESEARCH_WORKERS", defaultResearchWorkers),
		},
	})
	if err := httpkit.Serve("admin api", server.Addr, handler); err != nil {
		slog.Error("server", "error", err)
		os.Exit(1)
	}
}

// migrateCatalog brings stored jobs and companies up to the current shape. Staff
// own the catalog, so the admin API runs these. Each is idempotent; a failure is
// logged and the server still starts.
func migrateCatalog(store *jobs.Store, mongoURI string) {
	backfillCtx, cancelBackfill := context.WithTimeout(context.Background(), backfillTimeout)
	updated, err := store.BackfillJobProvenance(backfillCtx)
	cancelBackfill()
	if err != nil {
		slog.Error("backfill job provenance", "error", config.Redact(err, mongoURI))
	} else {
		slog.Info("backfill job provenance", "updated", updated)
	}
	dropCtx, cancelDrop := context.WithTimeout(context.Background(), dropTimeout)
	dropped, err := store.DropCompanyLeadership(dropCtx)
	cancelDrop()
	if err != nil {
		slog.Error("drop company leadership", "error", config.Redact(err, mongoURI))
	} else if dropped > 0 {
		slog.Info("drop company leadership", "companies", dropped)
	}
}
