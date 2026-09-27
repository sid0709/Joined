package main

import (
	"context"
	"log/slog"
	"os"
	"time"

	"github.com/sid0709/OpenSeat/opened-backend/internal/config"
	"github.com/sid0709/OpenSeat/opened-backend/internal/database"
	"github.com/sid0709/OpenSeat/opened-backend/internal/jobs"
)

const copyTimeout = 20 * time.Minute

func main() {
	cfg, err := config.Load()
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
	)
	ctx, cancel := context.WithTimeout(context.Background(), copyTimeout)
	defer cancel()

	slog.Info("copying companies", "source", cfg.SourceDB+"."+cfg.SourceCompanies, "destination", cfg.DestDB+"."+cfg.CompaniesCollection)
	result, err := store.CopyCompanies(ctx)
	if err != nil {
		slog.Error("copy failed", "error", config.Redact(err, cfg.MongoURI))
		os.Exit(1)
	}
	slog.Info("copy finished", "copied", result.Copied, "linked", result.Linked, "source", result.Source, "destination", result.Dest)
}
