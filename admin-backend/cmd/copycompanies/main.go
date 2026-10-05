package main

import (
	"context"
	"log/slog"
	"os"
	"time"

	"github.com/sid0709/OpenSeat/backend-core/config"
	"github.com/sid0709/OpenSeat/backend-core/database"
	"github.com/sid0709/OpenSeat/backend-core/jobs"
	"github.com/sid0709/OpenSeat/backend-core/killswitch"
)

const copyTimeout = 20 * time.Minute

func main() {
	config.LoadEnvFile()
	cfg, err := config.LoadDatabase()
	if err != nil {
		slog.Error("config", "error", err)
		os.Exit(1)
	}

	client, err := database.Connect(context.Background(), cfg.MongoURI)
	if err != nil {
		slog.Error("mongo", "error", config.Redact(err, cfg.MongoURI))
		os.Exit(1)
	}
	defer client.Disconnect(context.Background())

	store := jobs.NewStore(
		client,
		cfg.SourceDB,
		cfg.SourceCollection,
		cfg.DestDB,
		cfg.DestCollection,
		cfg.JobsCollection,
		cfg.SourceCompanies,
		cfg.CompaniesCollection,
		cfg.TempCompaniesCollection,
	)
	ctx, cancel := context.WithTimeout(context.Background(), copyTimeout)
	defer cancel()
	if err := killswitch.Check(ctx, killswitch.NewStore(client, cfg.DestDB, killswitch.LoadDefaults()), killswitch.JobImports); err != nil {
		slog.Error("job imports", "error", err)
		os.Exit(1)
	}

	slog.Info("copying companies", "source", cfg.SourceDB+"."+cfg.SourceCompanies, "staging", cfg.DestDB+"."+cfg.TempCompaniesCollection)
	result, err := store.CopyCompanies(ctx, nil)
	if err != nil {
		slog.Error("copy failed", "error", config.Redact(err, cfg.MongoURI))
		os.Exit(1)
	}
	slog.Info("copy finished", "copied", result.Copied, "staged", result.Staged, "refreshed", result.Refreshed, "unpublished", result.Unpublished, "linked", result.Linked)
}
